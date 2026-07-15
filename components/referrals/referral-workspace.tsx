"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  MessageSquareText,
  PenLine,
  Plus,
  RotateCcw,
  Save,
  Stethoscope,
  StickyNote,
  UserRound,
  XCircle,
} from "lucide-react";
import type { MedicalReferralEvent, MedicalReferralListItem, MedicalReferralStatus } from "@/lib/referrals/types";
import type { OperationalTaskPriority } from "@/lib/tasks/types";
import type { ClinicRole, Patient, PatientDocument, SalesConversation } from "@/lib/types";
import type { ClinicOperationalRole } from "@/lib/workspaces/types";
import { StatusPill } from "@/components/ui/status-pill";

const STATUS_LABELS: Record<MedicalReferralStatus, string> = {
  pending: "Pendente",
  in_review: "Em revisão",
  returned: "Devolvido",
  approved_operationally: "Aprovado operacionalmente",
  signed: "Assinatura registrada",
  cancelled: "Cancelado",
};

const PRIORITY_LABELS: Record<OperationalTaskPriority, string> = {
  low: "Baixa",
  normal: "Normal",
  high: "Alta",
  urgent: "Urgente",
};

function statusTone(status: MedicalReferralStatus) {
  if (status === "approved_operationally" || status === "signed") return "success" as const;
  if (status === "returned") return "warning" as const;
  if (status === "cancelled") return "danger" as const;
  if (status === "in_review") return "gold" as const;
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

type DoctorOption = { user_id: string; name: string; professional_id: string | null };
type Filter = "active" | "mine" | "returned" | "completed" | "all";

export function ReferralWorkspace({
  role,
  operationalRole,
  currentUserId,
  referrals,
  activeReferral,
  events,
  doctors,
  patients,
  documents,
  conversations,
}: {
  role: ClinicRole;
  operationalRole: ClinicOperationalRole;
  currentUserId: string;
  referrals: MedicalReferralListItem[];
  activeReferral: MedicalReferralListItem | null;
  events: MedicalReferralEvent[];
  doctors: DoctorOption[];
  patients: Patient[];
  documents: PatientDocument[];
  conversations: SalesConversation[];
}) {
  const router = useRouter();
  const isManagement = role === "owner" || role === "manager";
  const isDoctor = operationalRole === "doctor";
  const isAssignedDoctor = activeReferral?.doctor_user_id === currentUserId;
  const isRequester = activeReferral?.requested_by === currentUserId;

  const [filter, setFilter] = useState<Filter>("active");
  const [showCreate, setShowCreate] = useState(referrals.length === 0);
  const [newPatientId, setNewPatientId] = useState("");
  const [newDoctorId, setNewDoctorId] = useState(doctors[0]?.user_id ?? "");
  const [newTitle, setNewTitle] = useState("");
  const [newReason, setNewReason] = useState("");
  const [newPriority, setNewPriority] = useState<OperationalTaskPriority>("normal");
  const [newDueAt, setNewDueAt] = useState("");
  const [newDocumentId, setNewDocumentId] = useState("");
  const [newConversationId, setNewConversationId] = useState("");

  const [response, setResponse] = useState(activeReferral?.medical_response ?? "");
  const [doctorId, setDoctorId] = useState(activeReferral?.doctor_user_id ?? "");
  const [dueAt, setDueAt] = useState(toLocalInput(activeReferral?.due_at ?? null));
  const [note, setNote] = useState("");
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredReferrals = useMemo(() => referrals.filter((referral) => {
    if (filter === "all") return true;
    if (filter === "mine") return referral.doctor_user_id === currentUserId || referral.requested_by === currentUserId;
    if (filter === "returned") return referral.status === "returned" && referral.assigned_back_to === currentUserId;
    if (filter === "completed") return ["approved_operationally", "signed"].includes(referral.status);
    return ["pending", "in_review", "returned"].includes(referral.status);
  }), [currentUserId, filter, referrals]);

  const patientDocuments = documents.filter((document) => !newPatientId || document.patient_id === newPatientId);
  const patientConversations = conversations.filter((conversation) => !newPatientId || conversation.patient_id === newPatientId);

  function syncDocument(value: string) {
    setNewDocumentId(value);
    const document = documents.find((item) => item.id === value);
    if (document) setNewPatientId(document.patient_id);
  }

  function syncConversation(value: string) {
    setNewConversationId(value);
    const conversation = conversations.find((item) => item.id === value);
    if (conversation?.patient_id) setNewPatientId(conversation.patient_id);
  }

  async function createReferral(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setError(null);

    try {
      const request = await fetch("/api/referrals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: newPatientId,
          doctorUserId: newDoctorId,
          title: newTitle,
          reason: newReason,
          priority: newPriority,
          dueAt: newDueAt ? new Date(newDueAt).toISOString() : null,
          documentId: newDocumentId || null,
          conversationId: newConversationId || null,
        }),
      });
      const payload = (await request.json()) as { referralId?: string; error?: string };
      if (!request.ok || !payload.referralId) throw new Error(payload.error || "Não foi possível criar o encaminhamento.");
      router.push(`/app/encaminhamentos?referral=${payload.referralId}`);
      router.refresh();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Não foi possível criar o encaminhamento.");
    } finally {
      setCreating(false);
    }
  }

  async function updateReferral(status: MedicalReferralStatus) {
    if (!activeReferral) return;
    setSaving(true);
    setError(null);

    try {
      const request = await fetch(`/api/referrals/${activeReferral.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          medicalResponse: response,
          doctorUserId: doctorId || activeReferral.doctor_user_id,
          dueAt: dueAt ? new Date(dueAt).toISOString() : null,
        }),
      });
      const payload = (await request.json()) as { error?: string };
      if (!request.ok) throw new Error(payload.error || "Não foi possível atualizar o encaminhamento.");
      router.refresh();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Não foi possível atualizar o encaminhamento.");
    } finally {
      setSaving(false);
    }
  }

  async function addNote(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeReferral) return;
    setSavingNote(true);
    setError(null);

    try {
      const request = await fetch(`/api/referrals/${activeReferral.id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
      });
      const payload = (await request.json()) as { error?: string };
      if (!request.ok) throw new Error(payload.error || "Não foi possível registrar a nota.");
      setNote("");
      router.refresh();
    } catch (noteError) {
      setError(noteError instanceof Error ? noteError.message : "Não foi possível registrar a nota.");
    } finally {
      setSavingNote(false);
    }
  }

  return (
    <div className="referral-workspace">
      <aside className="card referral-sidebar">
        <div className="referral-heading-row">
          <div><span className="eyebrow">Fluxo interno</span><h2>Encaminhamentos</h2></div>
          <button className="button button-primary button-small" type="button" onClick={() => setShowCreate((value) => !value)}>
            <Plus size={15} /> Novo
          </button>
        </div>

        <div className="referral-filter-row">
          {(["active", "mine", "returned", "completed", "all"] as Filter[]).map((item) => (
            <button className={`task-filter ${filter === item ? "task-filter-active" : ""}`} key={item} onClick={() => setFilter(item)} type="button">
              {item === "active" ? "Ativos" : item === "mine" ? "Meus" : item === "returned" ? "Retornos" : item === "completed" ? "Concluídos" : "Todos"}
            </button>
          ))}
        </div>

        {showCreate && (
          <form className="referral-create-form" onSubmit={createReferral}>
            <div className="field">
              <label htmlFor="referral-patient">Paciente ou lead</label>
              <select className="select" id="referral-patient" required value={newPatientId} onChange={(event) => setNewPatientId(event.target.value)}>
                <option value="">Selecione</option>
                {patients.map((patient) => <option key={patient.id} value={patient.id}>{patient.reference_label}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="referral-doctor">Médico</label>
              <select className="select" id="referral-doctor" required value={newDoctorId} onChange={(event) => setNewDoctorId(event.target.value)}>
                <option value="">Selecione</option>
                {doctors.map((doctor) => <option key={doctor.user_id} value={doctor.user_id}>{doctor.name}</option>)}
              </select>
              {doctors.length === 0 && <small className="field-help">Configure um membro com função médica na aba Equipe.</small>}
            </div>
            <div className="field">
              <label htmlFor="referral-title">Título operacional</label>
              <input className="input" id="referral-title" minLength={2} maxLength={180} required value={newTitle} onChange={(event) => setNewTitle(event.target.value)} placeholder="Ex.: Revisar documento antes do envio" />
            </div>
            <div className="field">
              <label htmlFor="referral-reason">Contexto para revisão</label>
              <textarea className="textarea" id="referral-reason" maxLength={6000} value={newReason} onChange={(event) => setNewReason(event.target.value)} placeholder="Descreva a pendência operacional sem transformar este campo em prontuário." />
            </div>
            <div className="task-form-grid">
              <div className="field">
                <label htmlFor="referral-priority">Prioridade</label>
                <select className="select" id="referral-priority" value={newPriority} onChange={(event) => setNewPriority(event.target.value as OperationalTaskPriority)}>
                  {Object.entries(PRIORITY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="referral-due">Prazo</label>
                <input className="input" id="referral-due" type="datetime-local" value={newDueAt} onChange={(event) => setNewDueAt(event.target.value)} />
              </div>
            </div>
            <div className="field">
              <label htmlFor="referral-document">Documento relacionado</label>
              <select className="select" id="referral-document" value={newDocumentId} onChange={(event) => syncDocument(event.target.value)}>
                <option value="">Não vincular</option>
                {patientDocuments.map((document) => <option key={document.id} value={document.id}>{document.title}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="referral-conversation">Conversa relacionada</label>
              <select className="select" id="referral-conversation" value={newConversationId} onChange={(event) => syncConversation(event.target.value)}>
                <option value="">Não vincular</option>
                {patientConversations.map((conversation) => <option key={conversation.id} value={conversation.id}>{conversation.contact_label}</option>)}
              </select>
            </div>
            <button className="button button-primary" disabled={creating || doctors.length === 0} type="submit">
              <Stethoscope size={16} /> {creating ? "Encaminhando..." : "Encaminhar ao médico"}
            </button>
          </form>
        )}

        <div className="referral-list">
          {filteredReferrals.length === 0 ? (
            <div className="empty-state">Nenhum encaminhamento neste filtro.</div>
          ) : filteredReferrals.map((referral) => (
            <Link className={`referral-list-item ${referral.id === activeReferral?.id ? "referral-list-item-active" : ""}`} href={`/app/encaminhamentos?referral=${referral.id}`} key={referral.id}>
              <div className="referral-list-topline"><strong>{referral.title}</strong><StatusPill tone={priorityTone(referral.priority)}>{PRIORITY_LABELS[referral.priority]}</StatusPill></div>
              <span>{referral.patient_label}</span>
              <p>{referral.doctor_name}</p>
              <StatusPill tone={statusTone(referral.status)}>{STATUS_LABELS[referral.status]}</StatusPill>
            </Link>
          ))}
        </div>
      </aside>

      {!activeReferral ? (
        <main className="card referral-empty-main">
          <Stethoscope size={42} />
          <span className="eyebrow">Ponte entre ambientes</span>
          <h2>Crie ou selecione um encaminhamento</h2>
          <p>Solicitação, decisão humana e devolução aparecerão aqui.</p>
        </main>
      ) : (
        <main className="referral-main-column">
          <header className="card referral-summary-card">
            <div className="referral-title-group">
              <div className="referral-main-icon"><Stethoscope size={22} /></div>
              <div>
                <span className="eyebrow">{activeReferral.patient_label}</span>
                <h2>{activeReferral.title}</h2>
                <p>{activeReferral.doctor_name} · {formatDateTime(activeReferral.due_at)}</p>
              </div>
            </div>
            <StatusPill tone={statusTone(activeReferral.status)}>{STATUS_LABELS[activeReferral.status]}</StatusPill>
          </header>

          <section className="card referral-context-card">
            <div className="referral-heading-row"><div><span className="eyebrow">Contexto operacional</span><h2>O que foi encaminhado</h2></div><ClipboardCheck size={19} /></div>
            <p className="referral-reason">{activeReferral.reason || "Nenhum contexto adicional foi registrado."}</p>
            <div className="referral-context-links">
              <Link href={`/app/pacientes?patient=${activeReferral.patient_id}`}><UserRound size={16} /><span><small>Paciente</small>{activeReferral.patient_label}</span></Link>
              {activeReferral.document_id && <Link href={`/app/documentos?document=${activeReferral.document_id}`}><FileText size={16} /><span><small>Documento</small>{activeReferral.document_title || "Abrir documento"}</span></Link>}
              {activeReferral.conversation_id && <Link href={`/app/responder?conversation=${activeReferral.conversation_id}`}><MessageSquareText size={16} /><span><small>Conversa</small>{activeReferral.conversation_label || "Abrir conversa"}</span></Link>}
            </div>
            <div className="referral-people-grid">
              <div><small>Solicitado por</small><strong>{activeReferral.requester_name}</strong></div>
              <div><small>Médico responsável</small><strong>{activeReferral.doctor_name}</strong></div>
              <div><small>Retorno para</small><strong>{activeReferral.assigned_back_name || activeReferral.requester_name}</strong></div>
            </div>
          </section>

          <section className="card referral-decision-card">
            <div className="referral-heading-row"><div><span className="eyebrow">Decisão humana</span><h2>Revisão e devolução</h2></div><PenLine size={19} /></div>
            <div className="field">
              <label htmlFor="medical-response">Orientação ou resposta</label>
              <textarea className="textarea" id="medical-response" maxLength={6000} value={response} onChange={(event) => setResponse(event.target.value)} placeholder="Registre a orientação necessária para a equipe continuar o fluxo." />
            </div>
            {(isManagement || isAssignedDoctor) && (
              <div className="task-form-grid">
                {isManagement && (
                  <div className="field">
                    <label htmlFor="referral-assigned-doctor">Médico responsável</label>
                    <select className="select" id="referral-assigned-doctor" value={doctorId} onChange={(event) => setDoctorId(event.target.value)}>
                      {doctors.map((doctor) => <option key={doctor.user_id} value={doctor.user_id}>{doctor.name}</option>)}
                    </select>
                  </div>
                )}
                <div className="field">
                  <label htmlFor="referral-edit-due">Prazo</label>
                  <input className="input" id="referral-edit-due" type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} />
                </div>
              </div>
            )}

            <div className="referral-action-grid">
              {(isManagement || isAssignedDoctor) && activeReferral.status === "pending" && (
                <button className="button button-secondary" disabled={saving} onClick={() => updateReferral("in_review")} type="button"><ArrowRight size={16} /> Iniciar revisão</button>
              )}
              {(isManagement || isAssignedDoctor) && ["pending", "in_review"].includes(activeReferral.status) && (
                <button className="button button-secondary" disabled={saving || response.trim().length < 2} onClick={() => updateReferral("returned")} type="button"><RotateCcw size={16} /> Devolver com orientação</button>
              )}
              {(isManagement || isAssignedDoctor) && ["pending", "in_review", "returned"].includes(activeReferral.status) && (
                <button className="button button-primary" disabled={saving || response.trim().length < 2} onClick={() => updateReferral("approved_operationally")} type="button"><CheckCircle2 size={16} /> Aprovar operacionalmente</button>
              )}
              {(isManagement || isAssignedDoctor) && ["pending", "in_review", "approved_operationally"].includes(activeReferral.status) && (
                <button className="button button-primary" disabled={saving || response.trim().length < 2} onClick={() => updateReferral("signed")} type="button"><Save size={16} /> Registrar assinatura</button>
              )}
              {(isManagement || isRequester) && ["pending", "returned"].includes(activeReferral.status) && (
                <button className="button button-danger" disabled={saving} onClick={() => updateReferral("cancelled")} type="button"><XCircle size={16} /> Cancelar</button>
              )}
            </div>
            {!isManagement && !isAssignedDoctor && !isRequester && <div className="empty-state">Este encaminhamento está disponível apenas para acompanhamento.</div>}
            {error && <div className="form-error">{error}</div>}
          </section>

          <section className="card referral-history-card">
            <div className="referral-heading-row"><div><span className="eyebrow">Auditoria</span><h2>Histórico</h2></div><StickyNote size={19} /></div>
            <form className="referral-note-form" onSubmit={addNote}>
              <input className="input" minLength={2} maxLength={6000} required value={note} onChange={(event) => setNote(event.target.value)} placeholder="Adicionar nota interna" />
              <button className="button button-secondary" disabled={savingNote} type="submit"><Plus size={15} /> {savingNote ? "Salvando..." : "Registrar"}</button>
            </form>
            <div className="referral-event-list">
              {events.length === 0 ? <div className="empty-state">Nenhum evento registrado.</div> : events.map((event) => (
                <article key={event.id}>
                  <div><strong>{event.title}</strong><span>{formatDateTime(event.created_at)}</span></div>
                  <p>{event.description}</p>
                  <small>{event.author_name || "Sistema"}</small>
                </article>
              ))}
            </div>
          </section>
        </main>
      )}
    </div>
  );
}
