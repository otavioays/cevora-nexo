import type { Metadata } from "next";
import { CheckCircle2, ListTodo, Radar } from "lucide-react";
import { TaskWorkspace } from "@/components/tasks/task-workspace";
import { StatusPill } from "@/components/ui/status-pill";
import { requireMembership } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type {
  OperationalAlert,
  OperationalTask,
  OperationalTaskEvent,
  OperationalTaskListItem,
} from "@/lib/tasks/types";
import type {
  ClinicRole,
  Patient,
  PatientAssignee,
  PatientDocument,
  SalesConversation,
} from "@/lib/types";

export const metadata: Metadata = { title: "Fila operacional" };
export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ task?: string }>;
};

type MemberRow = {
  user_id: string;
  role: ClinicRole;
  profile: { display_name: string | null; email: string } | null;
};

function suggestedPriority(value: string) {
  const hours = (Date.now() - new Date(value).getTime()) / 3_600_000;
  return hours >= 72 ? "urgent" as const : "high" as const;
}

export default async function OperationalQueuePage({ searchParams }: PageProps) {
  const { activeMembership } = await requireMembership();
  const supabase = await createClient();
  const params = await searchParams;
  const clinicId = activeMembership.clinic_id;
  const staleThreshold = new Date(Date.now() - 24 * 3_600_000).toISOString();

  const [
    { data: taskRows },
    { data: patientRows },
    { data: conversationRows },
    { data: documentRows },
    { data: staleConversationRows },
    { data: staleDocumentRows },
    { data: memberRows },
  ] = await Promise.all([
    supabase
      .from("operational_tasks")
      .select("*")
      .eq("clinic_id", clinicId)
      .order("due_at", { ascending: true, nullsFirst: false })
      .order("updated_at", { ascending: false })
      .limit(250),
    supabase
      .from("patients")
      .select("*")
      .eq("clinic_id", clinicId)
      .order("last_activity_at", { ascending: false })
      .limit(250),
    supabase
      .from("sales_conversations")
      .select("*")
      .eq("clinic_id", clinicId)
      .order("last_message_at", { ascending: false })
      .limit(250),
    supabase
      .from("patient_documents")
      .select("*")
      .eq("clinic_id", clinicId)
      .order("updated_at", { ascending: false })
      .limit(250),
    supabase
      .from("sales_conversations")
      .select("*")
      .eq("clinic_id", clinicId)
      .eq("status", "open")
      .lt("last_message_at", staleThreshold)
      .order("last_message_at", { ascending: true })
      .limit(80),
    supabase
      .from("patient_documents")
      .select("*")
      .eq("clinic_id", clinicId)
      .in("status", ["created", "awaiting_signature", "ready_to_send"])
      .lt("updated_at", staleThreshold)
      .order("updated_at", { ascending: true })
      .limit(80),
    supabase
      .from("clinic_members")
      .select("user_id, role, profile:profiles!clinic_members_user_id_fkey(display_name, email)")
      .eq("clinic_id", clinicId)
      .eq("status", "active")
      .order("created_at"),
  ]);

  const patients = (patientRows ?? []) as Patient[];
  const conversations = (conversationRows ?? []) as SalesConversation[];
  const documents = (documentRows ?? []) as PatientDocument[];
  const rawTasks = (taskRows ?? []) as OperationalTask[];
  const members = (memberRows ?? []) as unknown as MemberRow[];
  const assignees: PatientAssignee[] = members.map((member) => ({
    id: member.user_id,
    role: member.role,
    name: member.profile?.display_name || member.profile?.email || "Membro da equipe",
  }));

  const patientLabels = new Map(patients.map((patient) => [patient.id, patient.reference_label]));
  const conversationLabels = new Map(conversations.map((conversation) => [conversation.id, conversation.contact_label]));
  const documentTitles = new Map(documents.map((document) => [document.id, document.title]));
  const assigneeNames = new Map(assignees.map((assignee) => [assignee.id, assignee.name]));

  const tasks: OperationalTaskListItem[] = rawTasks.map((task) => ({
    ...task,
    assigned_name: task.assigned_to ? assigneeNames.get(task.assigned_to) ?? null : null,
    patient_label: task.patient_id ? patientLabels.get(task.patient_id) ?? null : null,
    conversation_label: task.conversation_id ? conversationLabels.get(task.conversation_id) ?? null : null,
    document_title: task.document_id ? documentTitles.get(task.document_id) ?? null : null,
  }));

  const activeConversationTasks = new Set(
    rawTasks
      .filter((task) => task.conversation_id && ["open", "in_progress"].includes(task.status))
      .map((task) => task.conversation_id as string),
  );
  const activeDocumentTasks = new Set(
    rawTasks
      .filter((task) => task.document_id && ["open", "in_progress"].includes(task.status))
      .map((task) => task.document_id as string),
  );

  const conversationAlerts: OperationalAlert[] = ((staleConversationRows ?? []) as SalesConversation[])
    .filter((conversation) => !activeConversationTasks.has(conversation.id))
    .map((conversation) => ({
      id: `conversation:${conversation.id}`,
      kind: "conversation",
      title: `Retomar conversa: ${conversation.contact_label}`,
      description: "Conversa aberta sem nova atividade há mais de 24 horas.",
      patient_id: conversation.patient_id,
      patient_label: conversation.patient_id ? patientLabels.get(conversation.patient_id) ?? null : null,
      conversation_id: conversation.id,
      document_id: null,
      stalled_since: conversation.last_message_at,
      suggested_priority: suggestedPriority(conversation.last_message_at),
    }));

  const documentAlerts: OperationalAlert[] = ((staleDocumentRows ?? []) as PatientDocument[])
    .filter((document) => !activeDocumentTasks.has(document.id))
    .map((document) => ({
      id: `document:${document.id}`,
      kind: "document",
      title: `Destravar documento: ${document.title}`,
      description: "Documento pendente sem avanço há mais de 24 horas.",
      patient_id: document.patient_id,
      patient_label: patientLabels.get(document.patient_id) ?? null,
      conversation_id: null,
      document_id: document.id,
      stalled_since: document.updated_at,
      suggested_priority: suggestedPriority(document.updated_at),
    }));

  const alerts = [...conversationAlerts, ...documentAlerts]
    .sort((a, b) => new Date(a.stalled_since).getTime() - new Date(b.stalled_since).getTime())
    .slice(0, 120);

  const requestedTask = params.task;
  const activeTask = tasks.find((task) => task.id === requestedTask) ?? tasks.find((task) => ["open", "in_progress"].includes(task.status)) ?? tasks[0] ?? null;
  let events: OperationalTaskEvent[] = [];

  if (activeTask) {
    const { data: eventRows } = await supabase
      .from("operational_task_events")
      .select("*")
      .eq("clinic_id", clinicId)
      .eq("task_id", activeTask.id)
      .order("created_at", { ascending: false })
      .limit(160);

    events = (eventRows ?? []).map((event) => ({
      ...(event as Omit<OperationalTaskEvent, "author_name">),
      author_name: assigneeNames.get(event.created_by) ?? null,
    }));
  }

  const workspaceKey = `${activeTask?.id ?? "none"}:${events[0]?.id ?? "empty"}:${alerts.length}`;

  return (
    <>
      <header className="page-header task-page-header">
        <div className="page-heading">
          <span className="eyebrow">Prazos, responsáveis e gargalos</span>
          <h1>Fila Operacional</h1>
          <p>
            Transforme pendências em tarefas claras e enxergue conversas ou documentos que ficaram tempo demais sem movimento.
          </p>
        </div>
        <StatusPill tone="success"><CheckCircle2 size={13} /> Iteração 8 ativa</StatusPill>
      </header>

      <div className="permission-note spin-page-note">
        <Radar size={18} /> O radar apenas sugere pendências. Nenhuma tarefa é criada sem uma ação explícita da equipe.
      </div>
      <div className="permission-note spin-page-note">
        <ListTodo size={18} /> Cancelamento e reabertura de tarefas canceladas permanecem restritos a proprietário ou gestor.
      </div>

      <TaskWorkspace
        key={workspaceKey}
        role={activeMembership.role}
        clinicId={clinicId}
        currentUserId={activeMembership.user_id}
        tasks={tasks}
        activeTask={activeTask}
        events={events}
        alerts={alerts}
        assignees={assignees}
        patients={patients}
        conversations={conversations}
        documents={documents}
      />
    </>
  );
}
