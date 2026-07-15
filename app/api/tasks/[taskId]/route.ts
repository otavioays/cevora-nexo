import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { OperationalTaskPriority, OperationalTaskStatus } from "@/lib/tasks/types";

export const dynamic = "force-dynamic";

const STATUSES: OperationalTaskStatus[] = ["open", "in_progress", "completed", "cancelled"];
const PRIORITIES: OperationalTaskPriority[] = ["low", "normal", "high", "urgent"];

type UpdateTaskRequest = {
  title?: unknown;
  description?: unknown;
  status?: unknown;
  priority?: unknown;
  dueAt?: unknown;
  assignedTo?: unknown;
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> },
) {
  const { taskId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sua sessão expirou. Entre novamente." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as UpdateTaskRequest;
  const title = typeof body.title === "string" ? body.title.trim().slice(0, 180) : "";
  const description = typeof body.description === "string" ? body.description.trim().slice(0, 6000) : "";
  const status = STATUSES.includes(body.status as OperationalTaskStatus)
    ? (body.status as OperationalTaskStatus)
    : null;
  const priority = PRIORITIES.includes(body.priority as OperationalTaskPriority)
    ? (body.priority as OperationalTaskPriority)
    : null;
  const assignedTo = typeof body.assignedTo === "string" && body.assignedTo ? body.assignedTo : null;

  let dueAt: string | null = null;
  if (typeof body.dueAt === "string" && body.dueAt) {
    const parsed = new Date(body.dueAt);
    if (Number.isNaN(parsed.getTime())) {
      return NextResponse.json({ error: "Informe um prazo válido." }, { status: 400 });
    }
    dueAt = parsed.toISOString();
  }

  if (title.length < 2 || !status || !priority) {
    return NextResponse.json({ error: "Preencha os dados obrigatórios da tarefa." }, { status: 400 });
  }

  const { error } = await supabase.rpc("update_operational_task", {
    p_task_id: taskId,
    p_title: title,
    p_description: description,
    p_status: status,
    p_priority: priority,
    p_due_at: dueAt,
    p_assigned_to: assignedTo,
  });

  if (error) {
    return NextResponse.json({ error: error.message || "Não foi possível atualizar a tarefa." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
