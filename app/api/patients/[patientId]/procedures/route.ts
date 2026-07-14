import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { PatientProcedureStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

const INTEREST_STATUSES: PatientProcedureStatus[] = ["interested", "evaluating", "scheduled", "completed", "discarded"];

type ProcedureInterestRequest = {
  procedureId?: unknown;
  status?: unknown;
  notes?: unknown;
};

export async function POST(
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

  const body = (await request.json().catch(() => ({}))) as ProcedureInterestRequest;
  const procedureId = typeof body.procedureId === "string" && body.procedureId ? body.procedureId : null;
  const status = INTEREST_STATUSES.includes(body.status as PatientProcedureStatus)
    ? (body.status as PatientProcedureStatus)
    : "interested";
  const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 3000) : "";

  if (!procedureId) {
    return NextResponse.json({ error: "Selecione um procedimento." }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("upsert_patient_procedure_interest", {
    p_patient_id: patientId,
    p_procedure_id: procedureId,
    p_status: status,
    p_notes: notes,
  });

  if (error || !data) {
    return NextResponse.json({ error: error?.message || "Não foi possível atualizar o interesse." }, { status: 500 });
  }

  return NextResponse.json({ interestId: data });
}
