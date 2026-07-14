import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type AddNoteRequest = { note?: unknown };

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

  const body = (await request.json().catch(() => ({}))) as AddNoteRequest;
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 6000) : "";

  if (note.length < 2) {
    return NextResponse.json({ error: "Escreva uma nota válida." }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("add_patient_note", {
    p_patient_id: patientId,
    p_note: note,
  });

  if (error || !data) {
    return NextResponse.json({ error: error?.message || "Não foi possível registrar a nota." }, { status: 500 });
  }

  return NextResponse.json({ eventId: data });
}
