import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { PatientDocument } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const { documentId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
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
    return NextResponse.json({ error: "Este documento ainda não possui arquivo." }, { status: 404 });
  }

  const { data, error } = await supabase.storage
    .from("patient-documents")
    .createSignedUrl(document.storage_path, 60, { download: document.file_name });

  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: error?.message || "Não foi possível liberar o arquivo." }, { status: 500 });
  }

  await supabase.rpc("log_patient_document_download", { p_document_id: document.id });
  return NextResponse.redirect(data.signedUrl);
}