"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  CircleDot,
  ClipboardList,
  FileText,
  MessageSquareText,
  PlayCircle,
  Plus,
  Radar,
  RotateCcw,
  Save,
  StickyNote,
  UserRound,
  XCircle,
} from "lucide-react";
import { StatusPill } from "@/components/ui/status-pill";
import type {
  OperationalAlert,
  OperationalTaskEvent,
  OperationalTaskListItem,
  OperationalTaskPriority,
  OperationalTaskStatus,
} from "@/lib/tasks/types";
import type {
  ClinicRole,
  Patient,
  PatientAssignee,
  PatientDocument,
  SalesConversation,
} from "@/lib/types";

const STATUS_LABELS: Record<OperationalTaskStatus, string> = {
  open: "Aberta",
  in_progress: "Em andamento",
  completed: "Concluída",
  cancelled: "Cancelada",
};

const PRIORITY_LABELS: Record<OperationalTaskPriority, string> = {
  low: "Baixa",
  normal: "Normal",
  high: "Alta",
  urgent: "Urgente",
};

function statusTone(status: OperationalTaskStatus) {
  if (status === "completed") return "success" as const;
  if (status === "cancelled") return "danger" as const;
  if (status === "in_progress") return "gold" as const;
  return "neutral" as const;
}

function priorityTone(priority: OperationalTaskPriority) {
  if (priority === "urgent") return "danger" as const;
  if (priority === "high") return "warning" as const;
  if (priority === "normal") return "gold" as const;
  return "neutral" as const;
}

function formatDateTime(value: string | null) {
  if (!value) return "Sem prazo";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function toLocalInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function isOverdue(task: OperationalTaskListItem) {
  return Boolean(
    task.due_at
      && ["open", "in_progress"].includes(task.status)
      && new Date(task.due_at).getTime() < Date.now(),
  );
}

type Filter = "active" | "mine" | "overdue" | "completed" | "all";

export function TaskWorkspace({
  role,
  currentUserId,
  tasks,
  activeTask,
  events,
  alerts,
  assignees,
  patients,
  conversations,
  documents,
}: {
  role: ClinicRole;
  currentUserId: string;
  tasks: OperationalTaskListItem[];
  activeTask: OperationalTaskListItem | null;
  events: OperationalTaskEvent[];
  alerts: OperationalAlert[];
  assignees: PatientAssignee[];
  patients: Patient[];
  conversations: SalesConversation[];
  documents: PatientDocument[];
}) {
  const router = useRouter();
  const isManagement = role === "owner" || role === "manager";

  const [filter, setFilter] = useState<Filter>("active");
  const [showNewTask, setShowNewTask] = useState(tasks.length === 0);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newPriority, setNewPriority] = useState<OperationalTaskPriority>("normal");
  const [newDueAt, setNewDueAt] = useState("");
  const [newAssignedTo, setNewAssignedTo] = useState(currentUserId);
  const [newPatientId, setNewPatientId] = useState("");
  const [newConversationId, setNewConversationId] = useState("");
  const [newDocumentId, setNewDocumentId] = useState("");

  const [title, setTitle] = useState(activeTask?.title ?? "");
  const [description, setDescription] = useState(activeTask?.description ?? "");
  const [status, setStatus] = useState<OperationalTaskStatus>(activeTask?.status ?? "open");
  const [priority, setPriority] = useState<OperationalTaskPriority>(activeTask?.priority ?? "normal");
  const [dueAt, setDueAt] = useState(toLocalInput(activeTask?.due_at ?? null));
  const [assignedTo, setAssignedTo] = useState(activeTask?.assigned_to ?? "");
  const [note, setNote] = useState("");

  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [creatingAlertId, setCreatingAlertId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filteredTasks = useMemo(() => tasks.filter((task) => {
    if (filter === "all") return true;
    if (filter === "mine") return task.assigned_to === currentUserId && ["open", "in_progress"].includes(task.status);
    if (filter === "overdue") return isOverdue(task);
    if (filter === "completed") return task.status === "completed";
    return ["open", "in_progress"].includes(task.status);
  }), [currentUserId, filter, tasks]);

  function syncConversation(value: string) {
    setNewConversationId(value);
    if (!value) return;
    const conversation = conversations.find((item) => item.id === value);
    if (conversation?.patient_id) setNewPatientId(conversation.patient_id);
  }

  function syncDocument(value: string) {
    setNewDocumentId(value);
    if (!value) return;
    const document = documents.find((item) => item.id === value);
    if (document) setNewPatientId(document.patient_id);
  }

  async function createTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setError(null);

    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle,
          description: newDescription,
          priority: newPriority,
          dueAt: newDueAt ? new Date(newDueAt).toISOString() : null,
          assignedTo: newAssignedTo || null,
          patientId: newPatientId || null,
          conversationId: newConversationId || null,
          documentId: newDocumentId || null,
          source: "manual",
        }),
      });
      const payload = (await response.json()) as { taskId?: string; error?: string };
      if (!response.ok || !payload.taskId) throw new Error(payload.error || "Não foi possível criar a tarefa.");

      router.push(`/app/fila?task=${payload.taskId}`);
      router.refresh();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Não foi possível criar a tarefa.");
    } finally {
      setCreating(false);
    }
  }

  async function createFromAlert(alert: OperationalAlert) {
    setCreatingAlertId(alert.id);
    setError(null);

    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: alert.title,
          description: `${alert.description} Última atividade registrada em ${formatDateTime(alert.stalled_since)}.`,
          priority: alert.suggested_priority,
          dueAt: new Date(Date.now() + 24 * 3_600_000).toISOString(),
          assignedTo: currentUserId,
          patientId: alert.patient_id,
          conversationId: alert.conversation_id,
          documentId: alert.document_id,
          source: alert.kind === "conversation" ? "conversation_followup" : "document_followup",
        }),
      });
      const payload = (await response.json()) as { taskId?: string; error?: string };
      if (!response.ok || !payload.taskId) throw new Error(payload.error || "Não foi possível transformar o alerta em tarefa.");

      router.push(`/app/fila?task=${payload.taskId}`);
      router.refresh();
    } catch (alertError) {
      setError(alertError instanceof Error ? alertError.message : "Não foi possível transformar o alerta em tarefa.");
    } finally {
      setCreatingAlertId(null);
    }
  }

  async function persistTask(nextStatus = status) {
    if (!activeTask) return;
    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/tasks/${activeTask.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          status: nextStatus,
          priority,
          dueAt: dueAt ? new Date(dueAt).toISOString() : null,
          assignedTo: assignedTo || null,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Não foi possível atualizar a tarefa.");

      setStatus(nextStatus);
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Não foi possível atualizar a tarefa.");
    } finally {
      setSaving(false);
    }
  }

  async function saveTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await persistTask();
  }

  async function addNote(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeTask) return;
    setSavingNote(true);
    setError(null);

    try {
      const response = await fetch(`/api/tasks/${activeTask.id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Não foi possível registrar a nota.");
      setNote("");
      router.refresh();
    } catch (noteError) {
      setError(noteError instanceof Error ? noteError.message : "Não foi possível registrar a nota.");
    } finally {
      setSavingNote(false);
    }
  }

  return (
    <div className="task-workspace">
      <section className="card task-radar-card">
        <div className="task-section-heading">
          <div><span className="eyebrow">Radar automático</span><h2>Pendências sem movimento</h2></div>
          <StatusPill tone={alerts.length > 0 ? "warning" : "success"}><Radar size={13} /> {alerts.length}</StatusPill>
        </div>
        {alerts.length === 0 ? (
          <div className="empty-state">Nenhuma conversa ou documento ultrapassou 24 horas sem movimento.</div>
        ) : (
          <div className="task-alert-grid">
            {alerts.slice(0, 12).map((alert) => (
              <article className="task-alert-card" key={alert.id}>
                <div className="task-alert-icon">{alert.kind === "conversation" ? <MessageSquareText size={18} /> : <FileText size={18} />}</div>
                <div>
                  <div className="task-alert-topline">
                    <strong>{alert.title}</strong>
                    <StatusPill tone={priorityTone(alert.suggested_priority)}>{PRIORITY_LABELS[alert.suggested_priority]}</StatusPill>
                  </div>
                  <p>{alert.description}</p>
                  <small>{alert.patient_label || "Sem paciente vinculado"} · desde {formatDateTime(alert.stalled_since)}</small>
                </div>
                <button className="button button-secondary button-small" disabled={creatingAlertId === alert.id} onClick={() => createFromAlert(alert)} type="button">
                  <Plus size={15} /> {creatingAlertId === alert.id ? "Criando..." : "Criar tarefa"}
                </button>
              </article>
            ))}
          </div>
        )}
      </section>

      <div className="task-grid">
        <aside className="card task-sidebar">
          <div className="task-section-heading">
            <div><span className="eyebrow">Execução diária</span><h2>Tarefas</h2></div>
            <button className="button button-primary button-small" onClick={() => setShowNewTask((current) => !current)} type="button">
              <Plus size={15} /> Nova
            </button>
          </div>

          <div className="task-filter-row">
            {(["active", "mine", "overdue", "completed", "all"] as Filter[]).map((item) => (
              <button className={`task-filter ${filter === item ? "task-filter-active" : ""}`} key={item} onClick={() => setFilter(item)} type="button">
                {item === "active" ? "Ativas" : item === "mine" ? "Minhas" : item === "overdue" ? "Atrasadas" : item === "completed" ? "Concluídas" : "Todas"}
              </button>
            ))}
          </div>

          {showNewTask && (
            <form className="task-create-form" onSubmit={createTask}>
              <div className="field">
                <label htmlFor="new-task-title">Título</label>
                <input className="input" id="new-task-title" maxLength={180} minLength={2} required value={newTitle} onChange={(event) => setNewTitle(event.target.value)} placeholder="Ex.: Retornar contato amanhã" />
              </div>
              <div className="field">
                <label htmlFor="new-task-description">Descrição</label>
                <textarea className="textarea" id="new-task-description" maxLength={6000} value={newDescription} onChange={(event) => setNewDescription(event.target.value)} placeholder="O que precisa acontecer para concluir esta tarefa?" />
              </div>
              <div className="task-form-grid">
                <div className="field">
                  <label htmlFor="new-task-priority">Prioridade</label>
                  <select className="select" id="new-task-priority" value={newPriority} onChange={(event) => setNewPriority(event.target.value as OperationalTaskPriority)}>
                    {Object.entries(PRIORITY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="new-task-due">Prazo</label>
                  <input className="input" id="new-task-due" type="datetime-local" value={newDueAt} onChange={(event) => setNewDueAt(event.target.value)} />
                </div>
              </div>
              <div className="field">
                <label htmlFor="new-task-assignee">Responsável</label>
                <select className="select" id="new-task-assignee" value={newAssignedTo} onChange={(event) => setNewAssignedTo(event.target.value)}>
                  <option value="">Sem responsável</option>
                  {assignees.map((assignee) => <option key={assignee.id} value={assignee.id}>{assignee.name}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="new-task-patient">Paciente ou lead</label>
                <select className="select" id="new-task-patient" value={newPatientId} onChange={(event) => setNewPatientId(event.target.value)}>
                  <option value="">Não vincular</option>
                  {patients.map((patient) => <option key={patient.id} value={patient.id}>{patient.reference_label}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="new-task-conversation">Conversa</label>
                <select className="select" id="new-task-conversation" value={newConversationId} onChange={(event) => syncConversation(event.target.value)}>
                  <option value="">Não vincular</option>
                  {conversations.map((conversation) => <option key={conversation.id} value={conversation.id}>{conversation.contact_label}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="new-task-document">Documento</label>
                <select className="select" id="new-task-document" value={newDocumentId} onChange={(event) => syncDocument(event.target.value)}>
                  <option value="">Não vincular</option>
                  {documents.map((document) => <option key={document.id} value={document.id}>{document.title}</option>)}
                </select>
              </div>
              <button className="button button-primary" disabled={creating || newTitle.trim().length < 2} type="submit">
                <Plus size={15} /> {creating ? "Criando..." : "Criar tarefa"}
              </button>
            </form>
          )}

          <div className="task-list">
            {filteredTasks.length === 0 ? (
              <div className="empty-state">Nenhuma tarefa neste filtro.</div>
            ) : filteredTasks.map((task) => (
              <Link className={`task-list-item ${task.id === activeTask?.id ? "task-list-item-active" : ""}`} href={`/app/fila?task=${task.id}`} key={task.id}>
                <div className="task-list-topline">
                  <strong>{task.title}</strong>
                  <StatusPill tone={priorityTone(task.priority)}>{PRIORITY_LABELS[task.priority]}</StatusPill>
                </div>
                <span>{task.assigned_name || "Sem responsável"}</span>
                <p className={isOverdue(task) ? "task-overdue-text" : ""}>{formatDateTime(task.due_at)}</p>
                <StatusPill tone={statusTone(task.status)}>{STATUS_LABELS[task.status]}</StatusPill>
              </Link>
            ))}
          </div>
        </aside>

        {!activeTask ? (
          <section className="card task-empty-main">
            <ClipboardList size={38} />
            <span className="eyebrow">Fila operacional</span>
            <h2>Crie ou selecione uma tarefa</h2>
            <p>Responsável, prazo, contexto e histórico aparecerão aqui.</p>
          </section>
        ) : (
          <main className="task-main-column">
            <header className="card task-header-card">
              <div className="task-title-group">
                <div className="task-main-icon"><ClipboardList size={21} /></div>
                <div>
                  <span className="eyebrow">{PRIORITY_LABELS[activeTask.priority]} prioridade</span>
                  <h2>{activeTask.title}</h2>
                  <p className={isOverdue(activeTask) ? "task-overdue-text" : ""}><CalendarClock size={14} /> {formatDateTime(activeTask.due_at)}</p>
                </div>
              </div>
              <StatusPill tone={statusTone(activeTask.status)}>{STATUS_LABELS[activeTask.status]}</StatusPill>
            </header>

            <section className="card task-context-card">
              <div className="task-section-heading">
                <div><span className="eyebrow">Contexto conectado</span><h2>Origem da tarefa</h2></div>
                <CircleDot size={18} />
              </div>
              <div className="task-context-links">
                {activeTask.patient_id && <Link href={`/app/pacientes?patient=${activeTask.patient_id}`}><UserRound size={16} /><span><small>Paciente</small>{activeTask.patient_label || "Abrir cadastro"}</span></Link>}
                {activeTask.conversation_id && <Link href={`/app/responder?conversation=${activeTask.conversation_id}`}><MessageSquareText size={16} /><span><small>Conversa</small>{activeTask.conversation_label || "Abrir conversa"}</span></Link>}
                {activeTask.document_id && <Link href={`/app/documentos?document=${activeTask.document_id}`}><FileText size={16} /><span><small>Documento</small>{activeTask.document_title || "Abrir documento"}</span></Link>}
                {!activeTask.patient_id && !activeTask.conversation_id && !activeTask.document_id && <div className="empty-state">Tarefa geral da clínica, sem item vinculado.</div>}
              </div>
            </section>

            <form className="card task-edit-card" onSubmit={saveTask}>
              <div className="task-section-heading">
                <div><span className="eyebrow">Definição de trabalho</span><h2>Editar tarefa</h2></div>
                <Save size={18} />
              </div>
              <div className="field">
                <label htmlFor="task-title">Título</label>
                <input className="input" id="task-title" maxLength={180} minLength={2} required value={title} onChange={(event) => setTitle(event.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="task-description">Descrição</label>
                <textarea className="textarea" id="task-description" maxLength={6000} value={description} onChange={(event) => setDescription(event.target.value)} />
              </div>
              <div className="task-form-grid">
                <div className="field">
                  <label htmlFor="task-status">Status</label>
                  <select className="select" id="task-status" value={status} onChange={(event) => setStatus(event.target.value as OperationalTaskStatus)}>
                    <option value="open">Aberta</option>
                    <option value="in_progress">Em andamento</option>
                    <option value="completed">Concluída</option>
                    {isManagement && <option value="cancelled">Cancelada</option>}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="task-priority">Prioridade</label>
                  <select className="select" id="task-priority" value={priority} onChange={(event) => setPriority(event.target.value as OperationalTaskPriority)}>
                    {Object.entries(PRIORITY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="task-due">Prazo</label>
                  <input className="input" id="task-due" type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} />
                </div>
                <div className="field">
                  <label htmlFor="task-assignee">Responsável</label>
                  <select className="select" id="task-assignee" value={assignedTo} onChange={(event) => setAssignedTo(event.target.value)}>
                    <option value="">Sem responsável</option>
                    {assignees.map((assignee) => <option key={assignee.id} value={assignee.id}>{assignee.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="task-action-row">
                <button className="button button-secondary" disabled={saving} type="submit"><Save size={15} /> {saving ? "Salvando..." : "Salvar alterações"}</button>
                {activeTask.status === "open" && <button className="button button-primary" disabled={saving} onClick={() => persistTask("in_progress")} type="button"><PlayCircle size={15} /> Iniciar</button>}
                {["open", "in_progress"].includes(activeTask.status) && <button className="button button-primary" disabled={saving} onClick={() => persistTask("completed")} type="button"><CheckCircle2 size={15} /> Concluir</button>}
                {activeTask.status === "completed" && <button className="button button-secondary" disabled={saving} onClick={() => persistTask("open")} type="button"><RotateCcw size={15} /> Reabrir</button>}
                {isManagement && activeTask.status !== "cancelled" && <button className="button button-danger" disabled={saving} onClick={() => persistTask("cancelled")} type="button"><XCircle size={15} /> Cancelar</button>}
                {isManagement && activeTask.status === "cancelled" && <button className="button button-secondary" disabled={saving} onClick={() => persistTask("open")} type="button"><RotateCcw size={15} /> Reabrir</button>}
              </div>
            </form>

            {error && <div className="form-error"><AlertTriangle size={16} /> {error}</div>}
          </main>
        )}

        <aside className="card task-audit-column">
          {!activeTask ? null : (
            <>
              <div className="task-section-heading">
                <div><span className="eyebrow">Rastro de execução</span><h2>Histórico</h2></div>
                <StickyNote size={18} />
              </div>
              <form className="task-note-form" onSubmit={addNote}>
                <textarea className="textarea" maxLength={6000} minLength={2} required value={note} onChange={(event) => setNote(event.target.value)} placeholder="Registrar observação ou bloqueio" />
                <button className="button button-secondary" disabled={savingNote || note.trim().length < 2} type="submit">
                  {savingNote ? "Salvando..." : "Adicionar nota"}
                </button>
              </form>
              <div className="task-event-list">
                {events.length === 0 ? (
                  <div className="empty-state">Nenhum evento registrado.</div>
                ) : events.map((event) => (
                  <article className={`task-event task-event-${event.event_type}`} key={event.id}>
                    <div className="task-event-marker" />
                    <div>
                      <strong>{event.title}</strong>
                      {event.description && <p>{event.description}</p>}
                      <small>{event.author_name || "Usuário"} · {formatDateTime(event.created_at)}</small>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
