import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Membership, SalesConversationChannel } from "@/lib/types";

export const dynamic = "force-dynamic";

type CreateConversationRequest = {
  contactLabel?: unknown;
  channel?: unknown;
  procedureId?: unknown;
  patientId?: unknown;
};

const CHANNELS: SalesConversationChannel[] = ["whatsapp", "instagram", "phone", "other"];

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sua sessão expirou. Entre novamente." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as CreateConversationRequest;
  const contactLabel = typeof body.contactLabel === "string" ? body.contactLabel.trim().slice(0, 120) : "";
  const channel = CHANNELS.includes(body.channel as SalesConversationChannel)
    ? (body.channel as SalesConversationChannel)
    : "whatsapp";
  const procedureId = typeof body.procedureId === "string" && body.procedureId ? body.procedureId : null;
  const patientId = typeof body.patientId === "string" && body.patientId ? body.patientId : null;

  if (contactLabel.length < 2) {
    return NextResponse.json({ error: "Informe uma referência para identificar a conversa." }, { status: 400 });
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
  const { data, error } = await supabase.rpc("create_sales_conversation_with_patient", {
    p_clinic_id: membership.clinic_id,
    p_contact_label: contactLabel,
    p_channel: channel,
    p_procedure_id: procedureId,
    p_patient_id: patientId,
  });

  if (error || !data) {
    return NextResponse.json({ error: error?.message || "Não foi possível criar a conversa." }, { status: 500 });
  }

  return NextResponse.json({ conversationId: data });
}
