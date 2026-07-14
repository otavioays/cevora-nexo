import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type SendMessageRequest = {
  content?: unknown;
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ messageId: string }> },
) {
  const { messageId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sua sessão expirou. Entre novamente." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as SendMessageRequest;
  const content = typeof body.content === "string" ? body.content.trim().slice(0, 6000) : "";

  if (content.length < 2) {
    return NextResponse.json({ error: "A mensagem enviada não pode ficar vazia." }, { status: 400 });
  }

  const { error } = await supabase.rpc("mark_conversation_message_sent", {
    p_message_id: messageId,
    p_content: content,
  });

  if (error) {
    return NextResponse.json({ error: error.message || "Não foi possível confirmar o envio." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
