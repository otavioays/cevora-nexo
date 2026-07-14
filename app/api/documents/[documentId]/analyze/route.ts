import { Buffer } from "node:buffer";
import { NextResponse } from "next/server";
import { getAiProvider, hasAiEnv } from "@/lib/ai/provider";
import { runDocumentIntelligence } from "@/lib/ai/document-intelligence";
import { createClient } from "@/lib/supabase/server";
import type { PatientDocument } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_AI_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png"] as const;

type AnalyzeRequest = {
  privacyConfirmed?: unknown;
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const { documentId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sua sessão expirou. Entre novamente." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as AnalyzeRequest;
  if (body.privacyConfirmed !== true) {
    return NextResponse.json(
      { error: "Confirme que o arquivo é fictício ou foi anonimizado antes de usar a IA." },
      { status: 400 },
    );
  }

  if (!hasAiEnv()) {
    return NextResponse.json({ error: "O provedor de IA não está configurado no servidor." }, { status: 503 });
  }

  const { data: documentRow, error: documentError } = await supabase
    .from("patient_documents")
    .select("*")
    .eq("id", documentId)
    .maybeSingle();

  if (documentError || !documentRow) {
    return NextResponse.json({ error: "Documento não encontrado ou acesso negado." }, { status: 404 });
  }

  const document = documentRow as PatientDocument;
  if (!document.storage_path) {
    return NextResponse.json({ error: "Anexe um arquivo antes de solicitar a análise." }, { status: 400 });
  }
  if (document.status === "cancelled") {
    return NextResponse.json({ error: "Documentos cancelados não podem ser analisados." }, { status: 400 });
  }
  if (!ALLOWED_MIME_TYPES.includes(document.mime_type as (typeof ALLOWED_MIME_TYPES)[number])) {
    return NextResponse.json({ error: "O formato deste arquivo não é compatível com a análise." }, { status: 400 });
  }
  if (document.size_bytes > MAX_AI_FILE_SIZE) {
    return NextResponse.json(
      { error: "Nesta versão, a análise por IA aceita arquivos de até 10 MB. Comprima o arquivo ou faça a revisão manual." },
      { status: 413 },
    );
  }

  const { data: fileBlob, error: fileError } = await supabase.storage
    .from("patient-documents")
    .download(document.storage_path);

  if (fileError || !fileBlob) {
    return NextResponse.json({ error: fileError?.message || "Não foi possível carregar o arquivo privado." }, { status: 500 });
  }

  try {
    const fileBuffer = Buffer.from(await fileBlob.arrayBuffer());
    const { result, model } = await runDocumentIntelligence({
      declaredDocumentType: document.document_type,
      attachment: {
        fileName: document.file_name || "documento",
        mimeType: document.mime_type as (typeof ALLOWED_MIME_TYPES)[number],
        dataBase64: fileBuffer.toString("base64"),
      },
    });

    const provider = getAiProvider();
    const { data: analysisId, error: saveError } = await supabase.rpc("save_patient_document_ai_analysis", {
      p_document_id: document.id,
      p_provider: provider,
      p_model: model,
      p_result: result,
      p_privacy_confirmation: "fictitious_or_anonymized",
    });

    if (saveError || !analysisId) {
      return NextResponse.json(
        { error: saveError?.message || "A análise foi concluída, mas não pôde ser registrada." },
        { status: 500 },
      );
    }

    return NextResponse.json({ analysisId, result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Não foi possível analisar o documento." },
      { status: 500 },
    );
  }
}
