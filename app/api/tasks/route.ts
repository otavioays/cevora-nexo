import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Membership } from "@/lib/types";
import type { OperationalTaskPriority, OperationalTaskSource } from "@/lib/tasks/types";

export const dynamic = "force-dynamic";

const PRIORITIES: OperationalTaskPriority[] = ["low", "normal", "high", "urgent"];
const SOURCES: OperationalTaskSource[] = ["manual", "conversation_followup", "document_followup", "system_alert"];

type CreateTaskRequest = {
  title?: unknown;
  description?: unknown;
  priority?: unknown;
  dueAt?: unknown;
  assignedTo?: unknown;
  patientId?: unknown;
  conversationId?: unknown;
  documentId?: unknown;
  source?: unknown;
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sua sessão expirou. Entre novamente." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as CreateTaskRequest;
  const title = typeof body.title === "string" ? body.title.trim().slice(0, 180) : "";
  const description = typeof body.description === "string" ? body.description.trim().slice(0, 6000) : "";
  const priority = PRIORITIES.includes(body.priority as OperationalTaskPriority)
    ? (body.priority as OperationalTaskPriority)
    : "normal";
  const source = SOURCES.includes(body.source as OperationalTaskSource)
    ? (body.source as OperationalTaskSource)
    : "manual";
  const assignedTo = typeof body.assignedTo === "string" && body.assignedTo ? body.assignedTo : null;
  const patientId = typeof body.patientId === "string" && body.patientId ? body.patientId : null;
  const conversationId = typeof body.conversationId === "string" && body.conversationId ? body.conversationId : null;
  const documentId = typeof body.documentId === "string" && body.documentId ? body.documentId : null;

  let dueAt: string | null = null;
  if (typeof body.dueAt === "string" && body.dueAt) {
    const parsed = new Date(body.dueAt);
    if (Number.isNaN(parsed.getTime())) {
      return NextResponse.json({ error: "Informe um prazo válido." }, { status: 400 });
    }
    dueAt = parsed.toISOString();
  }

  if (title.length < 2) {
    return NextResponse.json({ error: "Informe um título válido." }, { status: 400 });
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
  const { data, error } = await supabase.rpc("create_operational_task", {
    p_clinic_id: membership.clinic_id,
    p_title: title,
    p_description: description,
    p_priority: priority,
    p_due_at: dueAt,
    p_assigned_to: assignedTo,
    p_patient_id: patientId,
    p_conversation_id: conversationId,
    p_document_id: documentId,
    p_source: source,
  });

  if (error || !data) {
    return NextResponse.json({ error: error?.message || "Não foi possível criar a tarefa." }, { status: 500 });
  }

  return NextResponse.json({ taskId: data });
}
