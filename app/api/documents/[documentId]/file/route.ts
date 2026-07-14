import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { PatientDocument } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_FILE_SIZE = 15 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);

function safeFileName(value: string) {
  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(-140);
  return normalized || "documento";
}

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

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Selecione um arquivo." }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Envie um arquivo PDF, JPG ou PNG." }, { status: 400 });
  }
  if (file.size <= 0 || file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "O arquivo deve possuir no máximo 15 MB." }, { status: 400 });
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
  if (document.storage_path) {
    return NextResponse.json({ error: "Este documento já possui um arquivo anexado." }, { status: 400 });
  }
  if (["sent", "viewed", "cancelled"].includes(document.status)) {
    return NextResponse.json({ error: "O arquivo não pode ser anexado neste estágio." }, { status: 400 });
  }

  const fileName = safeFileName(file.name);
  const storagePath = `${document.clinic_id}/${document.patient_id}/${document.id}/${randomUUID()}-${fileName}`;
  const bytes = await file.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from("patient-documents")
    .upload(storagePath, bytes, { contentType: file.type, upsert: false });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message || "Não foi possível armazenar o arquivo." }, { status: 500 });
  }

  const { error: attachError } = await supabase.rpc("attach_patient_document_file", {
    p_document_id: document.id,
    p_file_name: file.name.slice(0, 255),
    p_storage_path: storagePath,
    p_mime_type: file.type,
    p_size_bytes: file.size,
  });

  if (attachError) {
    await supabase.storage.from("patient-documents").remove([storagePath]);
    return NextResponse.json({ error: attachError.message || "Não foi possível vincular o arquivo." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, fileName: file.name });
}