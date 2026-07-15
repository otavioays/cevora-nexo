import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { OperationalTaskPriority } from "@/lib/tasks/types";
import type { WorkspaceMembership } from "@/lib/workspaces/types";

export const dynamic = "force-dynamic";

const PRIORITIES: OperationalTaskPriority[] = ["low", "normal", "high", "urgent"];

type CreateReferralRequest = {
  patientId?: unknown;
  doctorUserId?: unknown;
  title?: unknown;
  reason?: unknown;
  priority?: unknown;
  dueAt?: unknown;
  documentId?: unknown;
  conversationId?: unknown;
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sua sessão expirou. Entre novamente." }, { status: 401 });
  }

  const { data: membershipRow } = await supabase
    .from("clinic_members")
    .select("id, clinic_id, user_id, role, operational_role, professional_id, status, created_at, updated_at, clinic:clinics(*)")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (!membershipRow) {
    return NextResponse.json({ error: "Nenhuma clínica ativa foi encontrada." }, { status: 403 });
  }

  const membership = membershipRow as unknown as WorkspaceMembership;
  const body = (await request.json().catch(() => ({}))) as CreateReferralRequest;
  const patientId = typeof body.patientId === "string" && body.patientId ? body.patientId : null;
  const doctorUserId = typeof body.doctorUserId === "string" && body.doctorUserId ? body.doctorUserId : null;
  const title = typeof body.title === "string" ? body.title.trim().slice(0, 180) : "";
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 6000) : "";
  const priority = PRIORITIES.includes(body.priority as OperationalTaskPriority)
    ? (body.priority as OperationalTaskPriority)
    : "normal";
  const dueAt = typeof body.dueAt === "string" && body.dueAt ? body.dueAt : null;
  const documentId = typeof body.documentId === "string" && body.documentId ? body.documentId : null;
  const conversationId = typeof body.conversationId === "string" && body.conversationId ? body.conversationId : null;

  if (!patientId) return NextResponse.json({ error: "Selecione um paciente ou lead." }, { status: 400 });
  if (!doctorUserId) return NextResponse.json({ error: "Selecione o médico responsável." }, { status: 400 });
  if (title.length < 2) return NextResponse.json({ error: "Informe um título válido." }, { status: 400 });

  const { data, error } = await supabase.rpc("create_medical_referral", {
    p_clinic_id: membership.clinic_id,
    p_patient_id: patientId,
    p_doctor_user_id: doctorUserId,
    p_title: title,
    p_reason: reason,
    p_priority: priority,
    p_due_at: dueAt,
    p_document_id: documentId,
    p_conversation_id: conversationId,
  });

  if (error || !data) {
    return NextResponse.json({ error: error?.message || "Não foi possível criar o encaminhamento." }, { status: 500 });
  }

  return NextResponse.json({ referralId: data });
}
