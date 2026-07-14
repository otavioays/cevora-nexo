import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { PatientDocumentType } from "@/lib/types";

export const dynamic = "force-dynamic";

const DOCUMENT_TYPES: PatientDocumentType[] = [
  "prescription",
  "exam_request",
  "medical_certificate",
  "informed_consent",
  "instructions",
  "report",
  "other",
];

type CreateDocumentRequest = {
  patientId?: unknown;
  documentType?: unknown;
  title?: unknown;
  description?: unknown;
  professionalId?: unknown;
  procedureId?: unknown;
  assignedTo?: unknown;
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sua sessão expirou. Entre novamente." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as CreateDocumentRequest;
  const patientId = typeof body.patientId === "string" && body.patientId ? body.patientId : null;
  const documentType = DOCUMENT_TYPES.includes(body.documentType as PatientDocumentType)
    ? (body.documentType as PatientDocumentType)
    : null;
  const title = typeof body.title === "string" ? body.title.trim().slice(0, 180) : "";
  const description = typeof body.description === "string" ? body.description.trim().slice(0, 6000) : "";
  const professionalId = typeof body.professionalId === "string" && body.professionalId ? body.professionalId : null;
  const procedureId = typeof body.procedureId === "string" && body.procedureId ? body.procedureId : null;
  const assignedTo = typeof body.assignedTo === "string" && body.assignedTo ? body.assignedTo : null;

  if (!patientId) {
    return NextResponse.json({ error: "Selecione um paciente ou lead." }, { status: 400 });
  }
  if (!documentType) {
    return NextResponse.json({ error: "Selecione o tipo de documento." }, { status: 400 });
  }
  if (title.length < 2) {
    return NextResponse.json({ error: "Informe um título válido." }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("create_patient_document", {
    p_patient_id: patientId,
    p_document_type: documentType,
    p_title: title,
    p_description: description,
    p_professional_id: professionalId,
    p_procedure_id: procedureId,
    p_assigned_to: assignedTo,
  });

  if (error || !data) {
    return NextResponse.json({ error: error?.message || "Não foi possível criar o documento." }, { status: 500 });
  }

  return NextResponse.json({ documentId: data });
}