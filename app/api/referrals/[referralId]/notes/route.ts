import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ referralId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sua sessão expirou. Entre novamente." }, { status: 401 });

  const { referralId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as { note?: unknown };
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 6000) : "";

  if (note.length < 2) return NextResponse.json({ error: "Escreva uma nota válida." }, { status: 400 });

  const { data, error } = await supabase.rpc("add_medical_referral_note", {
    p_referral_id: referralId,
    p_note: note,
  });

  if (error || !data) {
    return NextResponse.json({ error: error?.message || "Não foi possível registrar a nota." }, { status: 500 });
  }

  return NextResponse.json({ eventId: data });
}
