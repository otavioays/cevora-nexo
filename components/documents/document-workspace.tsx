"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  CheckCircle2,
  Clock3,
  Download,
  Eye,
  FileLock2,
  FilePlus2,
  FileText,
  Send,
  ShieldCheck,
  StickyNote,
  Upload,
  UserRound,
  XCircle,
} from "lucide-react";
import { StatusPill } from "@/components/ui/status-pill";
import type {
  ClinicRole,
  Patient,
  PatientAssignee,
  PatientDocumentEvent,
  PatientDocumentListItem,
  PatientDocumentStatus,
  PatientDocumentType,
  Procedure,
  Professional,
} from "@/lib/types";
import { formatDate } from "@/lib/utils";

const TYPE_LABELS: Record<PatientDocumentType, string> = {
  prescription: "Receita ou prescrição",
  exam_request: "Solicitação de exame",
  medical_certificate: "Atestado",
  informed_consent: "Termo de consentimento",
  instructions: "Orientações ao paciente",
  report: "Relatório",
  other: "Outro documento",
};

const STATUS_LABELS: Record<PatientDocumentStatus, string> = {
  created: "Criado",
  awaiting_signature: "Aguardando assinatura",
  ready_to_send: "Pronto para envio",
  sent: "Enviado",
  viewed: "Visualizado",
  cancelled: "Cancelado",
};

function statusTone(status: PatientDocumentStatus) {
  if (status === "viewed") return "success" as const;
  if (status === "sent") return "gold" as const;
  if (status === "cancelled") return "danger" as const;
  if (status === "ready_to_send") return "success" as const;
  if (status === "awaiting_signature") return "warning" as const;
  return "neutral" as const;
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentWorkspace({
  role,
  documents,
  activeDocument,
  events,
  patients,
  professionals,
  procedures,
  assignees,
  initialPatientId,
}: {
  role: ClinicRole;
  documents: PatientDocumentListItem[];
  activeDocument: PatientDocumentListItem | null;
  events: PatientDocumentEvent[];
  patients: Patient[];
  professionals: Professional[];
  procedures: Procedure[];
  assignees: PatientAssignee[];
  initialPatientId: string;
}) {
  const router = useRouter();
  const isManagement = role === "owner" || role === "manager";

  const [showNewDocument, setShowNewDocument] = useState(documents.length === 0);
  const [patientId, setPatientId] = useState(
    patients.some((patient) => patient.id === initialPatientId) ? initialPatientId : "",
  );
  const [documentType, setDocumentType] = useState<PatientDocumentType>("prescription");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [professionalId, setProfessionalId] = useState("");
  const [procedureId, setProcedureId] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [note, setNote] = useState("");
  const [creating, setCreating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createDocument(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setError(null);

    try {
      const response = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId,
          documentType,
          title,
          description,
          professionalId: professionalId || null,
          procedureId: procedureId || null,
          assignedTo: assignedTo || null,
        }),
      });
      const payload = (await response.json()) as { documentId?: string; error?: string };
      if (!response.ok || !payload.documentId) {
        throw new Error(payload.error || "Não foi possível criar o documento.");
      }

      router.push(`/app/documentos?document=${payload.documentId}`);
      router.refresh();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Não foi possível criar o documento.");
    } finally {
      setCreating(false);
    }
  }

  async function uploadFile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeDocument) return;
    setUploading(true);
    setError(null);

    try {
      const formData = new FormData(event.currentTarget);
      const response = await fetch(`/api/documents/${activeDocument.id}/file`, {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Não foi possível anexar o arquivo.");
      }
      event.currentTarget.reset();
      router.refresh();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Não foi possível anexar o arquivo.");
    } finally {
      setUploading(false);
    }
  }

  async function updateStatus(status: PatientDocumentStatus) {
    if (!activeDocument) return;
    setChangingStatus(true);
    setError(null);

    try {
      const response = await fetch(`/api/documents/${activeDocument.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Não foi possível atualizar o documento.");
      }
      router.refresh();
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : "Não foi possível atualizar o documento.");
    } finally {
      setChangingStatus(false);
    }
  }

  async function addNote(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeDocument) return;
    setSavingNote(true);
    setError(null);

    try {
      const response = await fetch(`/api/documents/${activeDocument.id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Não foi possível registrar a nota.");
      }
      setNote("");
      router.refresh();
    } catch (noteError) {
      setError(noteError instanceof Error ? noteError.message : "Não foi possível registrar a nota.");
    } finally {
      setSavingNote(false);
    }
  }

  function workflowActions() {
    if (!activeDocument) return null;
    const hasFile = Boolean(activeDocument.storage_path);

    return (
      <div className="document-workflow-actions">
        {activeDocument.status === "created" && hasFile && (
          <button className="button button-secondary" disabled={changingStatus} onClick={() => updateStatus("awaiting_signature")} type="button">
            <Clock3 size={16} /> Enviar para assinatura
          </button>
        )}
        {activeDocument.status === "created" && hasFile && isManagement && (
          <button className="button button-primary" disabled={changingStatus} onClick={() => updateStatus("ready_to_send")} type="button">
            <CheckCircle2 size={16} /> Liberar para envio
          </button>
        )}
        {activeDocument.status === "awaiting_signature" && isManagement && (
          <>
            <button className="button button-primary" disabled={changingStatus} onClick={() => updateStatus("ready_to_send")} type="button">
              <CheckCircle2 size={16} /> Confirmar assinatura
            </button>
            <button className="button button-secondary" disabled={changingStatus} onClick={() => updateStatus("created")} type="button">
              Voltar para correção
            </button>
          </>
        )}
        {activeDocument.status === "ready_to_send" && (
          <button className="button button-primary" disabled={changingStatus} onClick={() => updateStatus("sent")} type="button">
            <Send size={16} /> Marcar como enviado
          </button>
        )}
        {activeDocument.status === "ready_to_send" && isManagement && (
          <button className="button button-secondary" disabled={changingStatus} onClick={() => updateStatus("created")} type="button">
            Voltar para correção
          </button>
        )}
        {activeDocument.status === "sent" && (
          <button className="button button-primary" disabled={changingStatus} onClick={() => updateStatus("viewed")} type="button">
            <Eye size={16} /> Confirmar visualização
          </button>
        )}
        {isManagement && !["viewed", "cancelled"].includes(activeDocument.status) && (
          <button className="button button-danger" disabled={changingStatus} onClick={() => updateStatus("cancelled")} type="button">
            <XCircle size={16} /> Cancelar documento
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="document-workspace">
      <aside className="card document-sidebar">
        <div className="document-sidebar-header">
          <div><span className="eyebrow">Central privada</span><h2>Documentos</h2></div>
          <button className="button button-primary button-small" onClick={() => setShowNewDocument((current) => !current)} type="button">
            <FilePlus2 size={16} /> Novo
          </button>
        </div>

        {showNewDocument && (
          <form className="document-create-form" onSubmit={createDocument}>
            <div className="field">
              <label htmlFor="document-patient">Paciente ou lead</label>
              <select className="select" id="document-patient" required value={patientId} onChange={(event) => setPatientId(event.target.value)}>
                <option value="">Selecione</option>
                {patients.map((patient) => <option key={patient.id} value={patient.id}>{patient.reference_label}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="document-type">Tipo</label>
              <select className="select" id="document-type" value={documentType} onChange={(event) => setDocumentType(event.target.value as PatientDocumentType)}>
                {Object.entries(TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="document-title">Título</label>
              <input className="input" id="document-title" maxLength={180} minLength={2} required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex.: Orientações pós-operatórias" />
            </div>
            <div className="field">
              <label htmlFor="document-description">Descrição interna</label>
              <textarea className="textarea" id="document-description" maxLength={6000} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Contexto operacional. Não substitui prontuário." />
            </div>
            <div className="field">
              <label htmlFor="document-professional">Profissional relacionado</label>
              <select className="select" id="document-professional" value={professionalId} onChange={(event) => setProfessionalId(event.target.value)}>
                <option value="">Não definido</option>
                {professionals.map((professional) => <option key={professional.id} value={professional.id}>{professional.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="document-procedure">Procedimento relacionado</label>
              <select className="select" id="document-procedure" value={procedureId} onChange={(event) => setProcedureId(event.target.value)}>
                <option value="">Não definido</option>
                {procedures.map((procedure) => <option key={procedure.id} value={procedure.id}>{procedure.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="document-assignee">Responsável pelo fluxo</label>
              <select className="select" id="document-assignee" value={assignedTo} onChange={(event) => setAssignedTo(event.target.value)}>
                <option value="">Sem responsável</option>
                {assignees.map((assignee) => <option key={assignee.id} value={assignee.id}>{assignee.name}</option>)}
              </select>
            </div>
            <button className="button button-secondary" disabled={creating || !patientId || title.trim().length < 2} type="submit">
              {creating ? "Criando..." : "Criar documento"}
            </button>
          </form>
        )}

        <div className="document-list">
          {documents.length === 0 ? (
            <div className="empty-state">Nenhum documento criado.</div>
          ) : documents.map((document) => (
            <Link
              className={`document-list-item ${document.id === activeDocument?.id ? "document-list-item-active" : ""}`}
              href={`/app/documentos?document=${document.id}`}
              key={document.id}
            >
              <div className="document-list-topline">
                <strong>{document.title}</strong>
                <StatusPill tone={statusTone(document.status)}>{STATUS_LABELS[document.status]}</StatusPill>
              </div>
              <span>{document.patient_label} · {TYPE_LABELS[document.document_type]}</span>
              <p>{document.file_name || "Aguardando arquivo"}</p>
              <small>{formatDate(document.updated_at)}</small>
            </Link>
          ))}
        </div>
      </aside>

      {!activeDocument ? (
        <section className="card document-empty-main">
          <FileLock2 size={36} />
          <span className="eyebrow">Central de documentos</span>
          <h2>Crie ou selecione um documento</h2>
          <p>O arquivo, o estágio e cada mudança aparecerão aqui com trilha de auditoria.</p>
        </section>
      ) : (
        <section className="document-main-column">
          <header className="card document-header-card">
            <div className="document-title-row">
              <div className="document-icon"><FileText size={21} /></div>
              <div>
                <span className="eyebrow">{TYPE_LABELS[activeDocument.document_type]}</span>
                <h2>{activeDocument.title}</h2>
                <p><UserRound size={14} /> {activeDocument.patient_label}</p>
              </div>
            </div>
            <StatusPill tone={statusTone(activeDocument.status)}>{STATUS_LABELS[activeDocument.status]}</StatusPill>
          </header>

          <section className="card document-detail-card">
            <div className="commercial-section-heading">
              <div><span>Contexto operacional</span><h2>Detalhes</h2></div>
              <ShieldCheck size={19} />
            </div>
            <dl className="document-detail-list">
              <div><dt>Descrição</dt><dd>{activeDocument.description || "Nenhuma descrição interna."}</dd></div>
              <div><dt>Profissional</dt><dd>{activeDocument.professional_name || "Não definido"}</dd></div>
              <div><dt>Procedimento</dt><dd>{activeDocument.procedure_name || "Não definido"}</dd></div>
              <div><dt>Responsável</dt><dd>{activeDocument.assigned_name || "Sem responsável"}</dd></div>
              <div><dt>Criado em</dt><dd>{formatDate(activeDocument.created_at)}</dd></div>
            </dl>
          </section>

          <section className="card document-file-card">
            <div className="commercial-section-heading">
              <div><span>Arquivo privado</span><h2>Anexo</h2></div>
              <FileLock2 size={19} />
            </div>
            {activeDocument.storage_path ? (
              <div className="document-file-ready">
                <div>
                  <strong>{activeDocument.file_name}</strong>
                  <span>{activeDocument.mime_type} · {formatBytes(activeDocument.size_bytes)}</span>
                </div>
                <a className="button button-secondary" href={`/api/documents/${activeDocument.id}/download`} rel="noreferrer" target="_blank">
                  <Download size={16} /> Abrir arquivo
                </a>
              </div>
            ) : (
              <form className="document-upload-form" onSubmit={uploadFile}>
                <div className="field">
                  <label htmlFor="document-file">PDF, JPG ou PNG</label>
                  <input accept="application/pdf,image/jpeg,image/png" className="input" id="document-file" name="file" required type="file" />
                  <small className="field-help">Máximo de 15 MB. O arquivo será armazenado em um bucket privado.</small>
                </div>
                <button className="button button-primary" disabled={uploading || ["sent", "viewed", "cancelled"].includes(activeDocument.status)} type="submit">
                  <Upload size={16} /> {uploading ? "Enviando..." : "Anexar arquivo"}
                </button>
              </form>
            )}
          </section>

          <section className="card document-workflow-card">
            <div className="commercial-section-heading">
              <div><span>Próximo estado</span><h2>Fluxo do documento</h2></div>
              <Send size={19} />
            </div>
            <div className="document-stage-track" aria-label="Etapas do documento">
              {(["created", "awaiting_signature", "ready_to_send", "sent", "viewed"] as PatientDocumentStatus[]).map((status) => (
                <div className={`document-stage ${status === activeDocument.status ? "document-stage-active" : ""}`} key={status}>
                  <span /> <small>{STATUS_LABELS[status]}</small>
                </div>
              ))}
            </div>
            {workflowActions()}
            {activeDocument.status === "cancelled" && <div className="form-error">Este documento foi cancelado e o fluxo está encerrado.</div>}
            {activeDocument.status === "viewed" && <div className="form-success">Visualização confirmada. O fluxo foi concluído.</div>}
          </section>

          {error && <div className="form-error">{error}</div>}
        </section>
      )}

      <aside className="card document-audit-column">
        {!activeDocument ? null : (
          <>
            <div className="commercial-section-heading">
              <div><span>Registro imutável</span><h2>Auditoria</h2></div>
              <StickyNote size={19} />
            </div>
            <form className="document-note-form" onSubmit={addNote}>
              <textarea className="textarea" maxLength={6000} minLength={2} required value={note} onChange={(event) => setNote(event.target.value)} placeholder="Adicionar nota interna ao documento" />
              <button className="button button-secondary" disabled={savingNote || note.trim().length < 2} type="submit">
                {savingNote ? "Salvando..." : "Registrar nota"}
              </button>
            </form>
            <div className="document-audit-list">
              {events.length === 0 ? (
                <div className="empty-state">Nenhum evento registrado.</div>
              ) : events.map((event) => (
                <article className={`document-audit-event document-audit-${event.event_type}`} key={event.id}>
                  <div className="document-audit-marker" />
                  <div>
                    <strong>{event.title}</strong>
                    {event.description && <p>{event.description}</p>}
                    <small>{event.author_name || "Usuário"} · {formatDate(event.created_at)}</small>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </aside>
    </div>
  );
}