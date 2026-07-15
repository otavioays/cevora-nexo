import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { MedicalReferralStatus } from "@/lib/referrals/types";

export const dynamic = "force-dynamic";

const STATUSES: MedicalReferralStatus[] = [
  "pending",
  "in_review",
  "returned",
  "approved_operationally",
  "signed",
  "cancelled",
];

type RouteContext = { params: Promise<{ referralId: string }> };
type UpdateReferralRequest = {
  status?: unknown;
  medicalResponse?: unknown;
  doctorUserId?: unknown;
  dueAt?: unknown;
};

export async function PATCH(request: Request, context: RouteContext) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sua sessão expirou. Entre novamente." }, { status: 401 });

  const { referralId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as UpdateReferralRequest;
  const status = STATUSES.includes(body.status as MedicalReferralStatus)
    ? (body.status as MedicalReferralStatus)
    : null;
  const medicalResponse = typeof body.medicalResponse === "string"
    ? body.medicalResponse.trim().slice(0, 6000)
    : "";
  const doctorUserId = typeof body.doctorUserId === "string" && body.doctorUserId ? body.doctorUserId : null;
  const dueAt = typeof body.dueAt === "string" && body.dueAt ? body.dueAt : null;

  if (!status) return NextResponse.json({ error: "Selecione um status válido." }, { status: 400 });

  const { error } = await supabase.rpc("update_medical_referral", {
    p_referral_id: referralId,
    p_status: status,
    p_medical_response: medicalResponse,
    p_doctor_user_id: doctorUserId,
    p_due_at: dueAt,
  });

  if (error) {
    return NextResponse.json({ error: error.message || "Não foi possível atualizar o encaminhamento." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
