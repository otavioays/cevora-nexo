import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { PatientStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

const PATIENT_STATUSES: PatientStatus[] = ["lead", "qualified", "scheduled", "converted", "inactive", "lost"];

type UpdatePatientRequest = {
  referenceLabel?: unknown;
  status?: unknown;
  source?: unknown;
  assignedTo?: unknown;
  internalNotes?: unknown;
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ patientId: string }> },
) {
  const { patientId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sua sessão expirou. Entre novamente." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as UpdatePatientRequest;
  const referenceLabel = typeof body.referenceLabel === "string" ? body.referenceLabel.trim().slice(0, 120) : "";
  const status = PATIENT_STATUSES.includes(body.status as PatientStatus) ? (body.status as PatientStatus) : null;
  const source = typeof body.source === "string" ? body.source.trim().slice(0, 180) : "";
  const assignedTo = typeof body.assignedTo === "string" && body.assignedTo ? body.assignedTo : null;
  const internalNotes = typeof body.internalNotes === "string" ? body.internalNotes.trim().slice(0, 6000) : "";

  if (referenceLabel.length < 2 || !status) {
    return NextResponse.json({ error: "Preencha a referência e o estágio corretamente." }, { status: 400 });
  }

  const { error } = await supabase.rpc("update_patient_record", {
    p_patient_id: patientId,
    p_reference_label: referenceLabel,
    p_status: status,
    p_source: source,
    p_assigned_to: assignedTo,
    p_internal_notes: internalNotes,
  });

  if (error) {
    return NextResponse.json({ error: error.message || "Não foi possível atualizar o registro." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
