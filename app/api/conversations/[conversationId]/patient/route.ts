import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type LinkPatientRequest = { patientId?: unknown };

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  const { conversationId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sua sessão expirou. Entre novamente." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as LinkPatientRequest;
  const patientId = typeof body.patientId === "string" && body.patientId ? body.patientId : null;

  const { error } = await supabase.rpc("link_sales_conversation_patient", {
    p_conversation_id: conversationId,
    p_patient_id: patientId,
  });

  if (error) {
    return NextResponse.json({ error: error.message || "Não foi possível vincular a conversa." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
