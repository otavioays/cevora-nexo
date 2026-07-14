import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { PatientDocumentStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

const STATUSES: PatientDocumentStatus[] = [
  "created",
  "awaiting_signature",
  "ready_to_send",
  "sent",
  "viewed",
  "cancelled",
];

type UpdateStatusRequest = { status?: unknown };

export async function PATCH(
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

  const body = (await request.json().catch(() => ({}))) as UpdateStatusRequest;
  const status = STATUSES.includes(body.status as PatientDocumentStatus)
    ? (body.status as PatientDocumentStatus)
    : null;

  if (!status) {
    return NextResponse.json({ error: "Status inválido." }, { status: 400 });
  }

  const { error } = await supabase.rpc("update_patient_document_status", {
    p_document_id: documentId,
    p_status: status,
  });

  if (error) {
    return NextResponse.json({ error: error.message || "Não foi possível atualizar o documento." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}