import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { SalesConversationStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

type StatusRequest = {
  status?: unknown;
};

const STATUSES: SalesConversationStatus[] = ["open", "won", "lost", "archived"];

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

  const body = (await request.json().catch(() => ({}))) as StatusRequest;
  if (!STATUSES.includes(body.status as SalesConversationStatus)) {
    return NextResponse.json({ error: "Status de conversa inválido." }, { status: 400 });
  }

  const { error } = await supabase.rpc("update_sales_conversation_status", {
    p_conversation_id: conversationId,
    p_status: body.status,
  });

  if (error) {
    return NextResponse.json({ error: error.message || "Não foi possível atualizar a conversa." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
