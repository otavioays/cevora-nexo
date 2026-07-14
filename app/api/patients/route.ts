import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Membership, PatientStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

const PATIENT_STATUSES: PatientStatus[] = ["lead", "qualified", "scheduled", "converted", "inactive", "lost"];

type CreatePatientRequest = {
  referenceLabel?: unknown;
  status?: unknown;
  source?: unknown;
  assignedTo?: unknown;
  internalNotes?: unknown;
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sua sessão expirou. Entre novamente." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as CreatePatientRequest;
  const referenceLabel = typeof body.referenceLabel === "string" ? body.referenceLabel.trim().slice(0, 120) : "";
  const status = PATIENT_STATUSES.includes(body.status as PatientStatus) ? (body.status as PatientStatus) : "lead";
  const source = typeof body.source === "string" ? body.source.trim().slice(0, 180) : "";
  const assignedTo = typeof body.assignedTo === "string" && body.assignedTo ? body.assignedTo : null;
  const internalNotes = typeof body.internalNotes === "string" ? body.internalNotes.trim().slice(0, 6000) : "";

  if (referenceLabel.length < 2) {
    return NextResponse.json({ error: "Informe uma referência interna válida." }, { status: 400 });
  }

  const { data: membershipRow, error: membershipError } = await supabase
    .from("clinic_members")
    .select("id, clinic_id, user_id, role, status, created_at, updated_at, clinic:clinics(*)")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (membershipError || !membershipRow) {
    return NextResponse.json({ error: "Nenhuma clínica ativa foi encontrada para sua conta." }, { status: 403 });
  }

  const membership = membershipRow as unknown as Membership;
  const { data, error } = await supabase.rpc("create_patient", {
    p_clinic_id: membership.clinic_id,
    p_reference_label: referenceLabel,
    p_status: status,
    p_source: source,
    p_assigned_to: assignedTo,
    p_internal_notes: internalNotes,
  });

  if (error || !data) {
    return NextResponse.json({ error: error?.message || "Não foi possível criar o registro." }, { status: 500 });
  }

  return NextResponse.json({ patientId: data });
}
