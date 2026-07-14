"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarCheck,
  ClipboardList,
  Link2,
  MessageSquareText,
  NotebookPen,
  Plus,
  Save,
  Unlink,
  UserRound,
} from "lucide-react";
import { StatusPill } from "@/components/ui/status-pill";
import type {
  Patient,
  PatientAssignee,
  PatientListItem,
  PatientProcedureInterest,
  PatientProcedureStatus,
  PatientStatus,
  PatientTimelineEvent,
  Procedure,
  SalesConversationListItem,
} from "@/lib/types";
import { formatDate } from "@/lib/utils";

const PATIENT_STATUS_LABELS: Record<PatientStatus, string> = {
  lead: "Lead",
  qualified: "Qualificado",
  scheduled: "Avaliação agendada",
  converted: "Convertido",
  inactive: "Inativo",
  lost: "Perdido",
};

const INTEREST_STATUS_LABELS: Record<PatientProcedureStatus, string> = {
  interested: "Interessado",
  evaluating: "Avaliando",
  scheduled: "Agendado",
  completed: "Realizado",
  discarded: "Descartado",
};

function patientStatusTone(status: PatientStatus) {
  if (status === "converted") return "success" as const;
  if (status === "lost") return "danger" as const;
  if (status === "scheduled" || status === "qualified") return "gold" as const;
  if (status === "inactive") return "neutral" as const;
  return "warning" as const;
}

function interestStatusTone(status: PatientProcedureStatus) {
  if (status === "completed") return "success" as const;
  if (status === "discarded") return "danger" as const;
  if (status === "scheduled") return "gold" as const;
  return "neutral" as const;
}

async function readPayload(response: Response) {
  return (await response.json().catch(() => ({}))) as { error?: string; patientId?: string };
}

export function PatientWorkspace({
  patients,
  activePatient,
  procedures,
  assignees,
  interests,
  timeline,
  conversations,
}: {
  patients: PatientListItem[];
  activePatient: Patient | null;
  procedures: Procedure[];
  assignees: PatientAssignee[];
  interests: PatientProcedureInterest[];
  timeline: PatientTimelineEvent[];
  conversations: SalesConversationListItem[];
}) {
  const router = useRouter();

  const [showNewPatient, setShowNewPatient] = useState(patients.length === 0);
  const [newReference, setNewReference] = useState("");
  const [newSource, setNewSource] = useState("");
  const [newAssignedTo, setNewAssignedTo] = useState("");

  const [referenceLabel, setReferenceLabel] = useState(activePatient?.reference_label ?? "");
  const [status, setStatus] = useState<PatientStatus>(activePatient?.status ?? "lead");
  const [source, setSource] = useState(activePatient?.source ?? "");
  const [assignedTo, setAssignedTo] = useState(activePatient?.assigned_to ?? "");
  const [internalNotes, setInternalNotes] = useState(activePatient?.internal_notes ?? "");

  const [note, setNote] = useState("");
  const [interestProcedureId, setInterestProcedureId] = useState("");
  const [interestStatus, setInterestStatus] = useState<PatientProcedureStatus>("interested");
  const [interestNotes, setInterestNotes] = useState("");
  const [conversationToLink, setConversationToLink] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const linkedConversations = activePatient
    ? conversations.filter((conversation) => conversation.patient_id === activePatient.id)
    : [];
  const availableConversations = conversations.filter((conversation) => !conversation.patient_id);

  async function createPatient(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("create");
    setError(null);

    try {
      const response = await fetch("/api/patients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          referenceLabel: newReference,
          status: "lead",
          source: newSource,
          assignedTo: newAssignedTo || null,
        }),
      });
      const payload = await readPayload(response);
      if (!response.ok || !payload.patientId) {
        throw new Error(payload.error || "Não foi possível criar o registro.");
      }

      router.push(`/app/pacientes?patient=${payload.patientId}`);
      router.refresh();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Não foi possível criar o registro.");
    } finally {
      setBusy(null);
    }
  }

  async function savePatient(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activePatient) return;
    setBusy("save");
    setError(null);

    try {
      const response = await fetch(`/api/patients/${activePatient.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          referenceLabel,
          status,
          source,
          assignedTo: assignedTo || null,
          internalNotes,
        }),
      });
      const payload = await readPayload(response);
      if (!response.ok) throw new Error(payload.error || "Não foi possível atualizar o registro.");
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Não foi possível atualizar o registro.");
    } finally {
      setBusy(null);
    }
  }

  async function addNote(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activePatient) return;
    setBusy("note");
    setError(null);

    try {
      const response = await fetch(`/api/patients/${activePatient.id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
      });
      const payload = await readPayload(response);
      if (!response.ok) throw new Error(payload.error || "Não foi possível registrar a nota.");
      setNote("");
      router.refresh();
    } catch (noteError) {
      setError(noteError instanceof Error ? noteError.message : "Não foi possível registrar a nota.");
    } finally {
      setBusy(null);
    }
  }

  async function saveInterest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activePatient) return;
    setBusy("interest");
    setError(null);

    try {
      const response = await fetch(`/api/patients/${activePatient.id}/procedures`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          procedureId: interestProcedureId,
          status: interestStatus,
          notes: interestNotes,
        }),
      });
      const payload = await readPayload(response);
      if (!response.ok) throw new Error(payload.error || "Não foi possível atualizar o interesse.");
      setInterestNotes("");
      router.refresh();
    } catch (interestError) {
      setError(interestError instanceof Error ? interestError.message : "Não foi possível atualizar o interesse.");
    } finally {
      setBusy(null);
    }
  }

  async function linkConversation(conversationId: string, patientId: string | null) {
    setBusy(`conversation:${conversationId}`);
    setError(null);

    try {
      const response = await fetch(`/api/conversations/${conversationId}/patient`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId }),
      });
      const payload = await readPayload(response);
      if (!response.ok) throw new Error(payload.error || "Não foi possível vincular a conversa.");
      setConversationToLink("");
      router.refresh();
    } catch (linkError) {
      setError(linkError instanceof Error ? linkError.message : "Não foi possível vincular a conversa.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="patient-workspace">
      <aside className="card patient-sidebar">
        <div className="patient-sidebar-header">
          <div><span className="eyebrow">Carteira comercial</span><h2>Pacientes</h2></div>
          <button className="button button-primary button-small" type="button" onClick={() => setShowNewPatient((current) => !current)}>
            <Plus size={16} /> Novo
          </button>
        </div>

        {showNewPatient && (
          <form className="patient-create-form" onSubmit={createPatient}>
            <div className="field">
              <label htmlFor="new-patient-reference">Referência interna</label>
              <input
                className="input"
                id="new-patient-reference"
                maxLength={120}
                minLength={2}
                required
                value={newReference}
                onChange={(event) => setNewReference(event.target.value)}
                placeholder="Ex.: Lead Instagram 042"
              />
            </div>
            <div className="field">
              <label htmlFor="new-patient-source">Origem</label>
              <input
                className="input"
                id="new-patient-source"
                maxLength={180}
                value={newSource}
                onChange={(event) => setNewSource(event.target.value)}
                placeholder="Instagram, indicação, Google..."
              />
            </div>
            <div className="field">
              <label htmlFor="new-patient-assignee">Responsável</label>
              <select className="select" id="new-patient-assignee" value={newAssignedTo} onChange={(event) => setNewAssignedTo(event.target.value)}>
                <option value="">Sem responsável definido</option>
                {assignees.map((assignee) => <option key={assignee.id} value={assignee.id}>{assignee.name}</option>)}
              </select>
            </div>
            <button className="button button-secondary" disabled={busy === "create" || newReference.trim().length < 2} type="submit">
              {busy === "create" ? "Criando..." : "Criar registro"}
            </button>
          </form>
        )}

        <div className="patient-list">
          {patients.length === 0 ? (
            <div className="empty-state">Nenhum paciente ou lead cadastrado.</div>
          ) : patients.map((patient) => (
            <Link
              className={`patient-list-item ${patient.id === activePatient?.id ? "patient-list-item-active" : ""}`}
              href={`/app/pacientes?patient=${patient.id}`}
              key={patient.id}
            >
              <div className="patient-list-topline">
                <strong>{patient.reference_label}</strong>
                <StatusPill tone={patientStatusTone(patient.status)}>{PATIENT_STATUS_LABELS[patient.status]}</StatusPill>
              </div>
              <span>{patient.assigned_name || "Sem responsável"} · {patient.source || "Origem não informada"}</span>
              <p>{patient.procedure_count} procedimento(s) · {patient.conversation_count} conversa(s)</p>
              <small>{formatDate(patient.last_activity_at)}</small>
            </Link>
          ))}
        </div>
      </aside>

      {!activePatient ? (
        <section className="card patient-empty-main">
          <UserRound size={34} />
          <span className="eyebrow">Memória por pessoa</span>
          <h2>Crie ou selecione um registro</h2>
          <p>O histórico comercial deixa de ficar espalhado entre conversas independentes.</p>
        </section>
      ) : (
        <section className="patient-main-column">
          <form className="card patient-profile-card" onSubmit={savePatient}>
            <div className="patient-profile-header">
              <div className="patient-title-row">
                <div className="patient-avatar"><UserRound size={22} /></div>
                <div><span className="eyebrow">Cadastro comercial</span><h2>{activePatient.reference_label}</h2></div>
              </div>
              <StatusPill tone={patientStatusTone(status)}>{PATIENT_STATUS_LABELS[status]}</StatusPill>
            </div>

            <div className="grid-2 patient-profile-grid">
              <div className="field">
                <label htmlFor="patient-reference">Referência interna</label>
                <input className="input" id="patient-reference" maxLength={120} minLength={2} required value={referenceLabel} onChange={(event) => setReferenceLabel(event.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="patient-status">Estágio geral</label>
                <select className="select" id="patient-status" value={status} onChange={(event) => setStatus(event.target.value as PatientStatus)}>
                  {Object.entries(PATIENT_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="patient-source">Origem</label>
                <input className="input" id="patient-source" maxLength={180} value={source} onChange={(event) => setSource(event.target.value)} placeholder="Canal ou campanha de origem" />
              </div>
              <div className="field">
                <label htmlFor="patient-assignee">Responsável</label>
                <select className="select" id="patient-assignee" value={assignedTo} onChange={(event) => setAssignedTo(event.target.value)}>
                  <option value="">Sem responsável definido</option>
                  {assignees.map((assignee) => <option key={assignee.id} value={assignee.id}>{assignee.name}</option>)}
                </select>
              </div>
            </div>

            <div className="field">
              <label htmlFor="patient-internal-notes">Observações internas</label>
              <textarea
                className="textarea patient-notes-input"
                id="patient-internal-notes"
                maxLength={6000}
                value={internalNotes}
                onChange={(event) => setInternalNotes(event.target.value)}
                placeholder="Somente contexto comercial e operacional. Não use como prontuário."
              />
            </div>

            {error && <div className="form-error">{error}</div>}
            <div className="patient-profile-actions">
              <small className="field-help">A referência e as observações deste cadastro não são enviadas à IA.</small>
              <button className="button button-primary" disabled={busy === "save" || referenceLabel.trim().length < 2} type="submit">
                <Save size={16} /> {busy === "save" ? "Salvando..." : "Salvar cadastro"}
              </button>
            </div>
          </form>

          <section className="card patient-timeline-card">
            <div className="commercial-section-heading">
              <div><span>Histórico consolidado</span><h2>Linha do tempo</h2></div>
              <ClipboardList size={19} />
            </div>

            <form className="patient-note-form" onSubmit={addNote}>
              <textarea
                className="textarea"
                maxLength={6000}
                minLength={2}
                required
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Registre uma ligação, decisão, retorno combinado ou contexto operacional."
              />
              <button className="button button-secondary" disabled={busy === "note" || note.trim().length < 2} type="submit">
                <NotebookPen size={16} /> {busy === "note" ? "Registrando..." : "Adicionar nota"}
              </button>
            </form>

            <div className="patient-timeline">
              {timeline.length === 0 ? (
                <div className="empty-state">A linha do tempo começará com as primeiras ações deste registro.</div>
              ) : timeline.map((event) => (
                <article className={`patient-timeline-event patient-event-${event.event_type}`} key={event.id}>
                  <div className="patient-event-marker" />
                  <div className="patient-event-content">
                    <div className="patient-event-topline">
                      <strong>{event.title}</strong>
                      <span>{formatDate(event.created_at)}</span>
                    </div>
                    {event.description && <p>{event.description}</p>}
                    <small>{event.author_name || "Sistema Nexo"}</small>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </section>
      )}

      <aside className="patient-side-column">
        {!activePatient ? null : (
          <>
            <section className="card patient-interest-card">
              <div className="commercial-section-heading">
                <div><span>Mapa de demanda</span><h2>Procedimentos</h2></div>
                <CalendarCheck size={19} />
              </div>

              <form className="patient-interest-form" onSubmit={saveInterest}>
                <div className="field">
                  <label htmlFor="interest-procedure">Procedimento</label>
                  <select className="select" id="interest-procedure" required value={interestProcedureId} onChange={(event) => setInterestProcedureId(event.target.value)}>
                    <option value="">Selecione</option>
                    {procedures.map((procedure) => <option key={procedure.id} value={procedure.id}>{procedure.name}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="interest-status">Estágio do interesse</label>
                  <select className="select" id="interest-status" value={interestStatus} onChange={(event) => setInterestStatus(event.target.value as PatientProcedureStatus)}>
                    {Object.entries(INTEREST_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="interest-notes">Observação</label>
                  <textarea className="textarea" id="interest-notes" maxLength={3000} value={interestNotes} onChange={(event) => setInterestNotes(event.target.value)} placeholder="Motivação, prioridade ou próximo passo." />
                </div>
                <button className="button button-secondary" disabled={busy === "interest" || !interestProcedureId} type="submit">
                  {busy === "interest" ? "Salvando..." : "Salvar interesse"}
                </button>
              </form>

              <div className="patient-interest-list">
                {interests.length === 0 ? (
                  <div className="empty-state">Nenhum procedimento associado.</div>
                ) : interests.map((interest) => (
                  <article className="patient-interest-item" key={interest.id}>
                    <div><strong>{interest.procedure_name}</strong><StatusPill tone={interestStatusTone(interest.status)}>{INTEREST_STATUS_LABELS[interest.status]}</StatusPill></div>
                    {interest.notes && <p>{interest.notes}</p>}
                  </article>
                ))}
              </div>
            </section>

            <section className="card patient-conversations-card">
              <div className="commercial-section-heading">
                <div><span>Atendimentos conectados</span><h2>Conversas</h2></div>
                <MessageSquareText size={19} />
              </div>

              {availableConversations.length > 0 && (
                <div className="patient-link-form">
                  <select className="select" value={conversationToLink} onChange={(event) => setConversationToLink(event.target.value)}>
                    <option value="">Selecionar conversa sem paciente</option>
                    {availableConversations.map((conversation) => <option key={conversation.id} value={conversation.id}>{conversation.contact_label}</option>)}
                  </select>
                  <button
                    className="button button-secondary button-small"
                    disabled={!conversationToLink || busy === `conversation:${conversationToLink}`}
                    onClick={() => linkConversation(conversationToLink, activePatient.id)}
                    type="button"
                  >
                    <Link2 size={15} /> Vincular
                  </button>
                </div>
              )}

              <div className="patient-conversation-list">
                {linkedConversations.length === 0 ? (
                  <div className="empty-state">Nenhuma conversa vinculada.</div>
                ) : linkedConversations.map((conversation) => (
                  <article className="patient-conversation-item" key={conversation.id}>
                    <Link href={`/app/responder?conversation=${conversation.id}`}>
                      <strong>{conversation.contact_label}</strong>
                      <span>{conversation.procedure_name || "Procedimento indefinido"}</span>
                      <small>{formatDate(conversation.last_message_at)}</small>
                    </Link>
                    <button
                      className="button button-ghost button-small"
                      disabled={busy === `conversation:${conversation.id}`}
                      onClick={() => linkConversation(conversation.id, null)}
                      type="button"
                      aria-label="Desvincular conversa"
                    >
                      <Unlink size={15} />
                    </button>
                  </article>
                ))}
              </div>
            </section>
          </>
        )}
      </aside>
    </div>
  );
}
