"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  BrainCircuit,
  Check,
  CheckCircle2,
  Clipboard,
  MessageCirclePlus,
  MessageSquareText,
  Route,
  Send,
  Sparkles,
  UserRound,
} from "lucide-react";
import { StatusPill } from "@/components/ui/status-pill";
import type {
  ConversationLatestResult,
  ConversationMessage,
  Procedure,
  SalesConversation,
  SalesConversationChannel,
  SalesConversationListItem,
  SalesConversationStatus,
  SpinEngineResult,
  SpinRiskLevel,
  SpinStage,
} from "@/lib/types";
import { formatDate } from "@/lib/utils";

const SPIN_LABELS: Record<SpinStage, string> = {
  situation: "Situação",
  problem: "Problema",
  implication: "Implicação",
  need_payoff: "Necessidade de solução",
  capability: "Demonstração de capacidade",
  commitment: "Compromisso",
  none: "Sem etapa definida",
};

const CHANNEL_LABELS: Record<SalesConversationChannel, string> = {
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  phone: "Telefone",
  other: "Outro",
};

const STATUS_LABELS: Record<SalesConversationStatus, string> = {
  open: "Em andamento",
  won: "Convertida",
  lost: "Encerrada sem conversão",
  archived: "Arquivada",
};

function statusTone(status: SalesConversationStatus) {
  if (status === "won") return "success" as const;
  if (status === "lost") return "danger" as const;
  if (status === "archived") return "neutral" as const;
  return "gold" as const;
}

function riskTone(risk: SpinRiskLevel) {
  if (risk === "high") return "danger" as const;
  if (risk === "medium") return "warning" as const;
  return "success" as const;
}

function listOrFallback(items: string[], fallback: string) {
  return items.length > 0 ? items : [fallback];
}

export function ConversationWorkspace({
  procedures,
  conversations,
  activeConversation,
  messages,
  latestResult,
  aiConfigured,
}: {
  procedures: Procedure[];
  conversations: SalesConversationListItem[];
  activeConversation: SalesConversation | null;
  messages: ConversationMessage[];
  latestResult: ConversationLatestResult | null;
  aiConfigured: boolean;
}) {
  const router = useRouter();
  const [showNewConversation, setShowNewConversation] = useState(conversations.length === 0);
  const [contactLabel, setContactLabel] = useState("");
  const [newChannel, setNewChannel] = useState<SalesConversationChannel>("whatsapp");
  const [newProcedureId, setNewProcedureId] = useState("");
  const [creating, setCreating] = useState(false);
  const [patientMessage, setPatientMessage] = useState("");
  const [additionalContext, setAdditionalContext] = useState("");
  const [procedureId, setProcedureId] = useState(activeConversation?.procedure_id ?? "");
  const [result, setResult] = useState<SpinEngineResult | null>(latestResult?.result ?? null);
  const [draftMessageId, setDraftMessageId] = useState<string | null>(latestResult?.draft_message_id ?? null);
  const [draftText, setDraftText] = useState(latestResult?.result.response.primary_response ?? "");
  const [sentConfirmed, setSentConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const procedureNames = useMemo(
    () => new Map(procedures.map((procedure) => [procedure.id, procedure.name])),
    [procedures],
  );

  useEffect(() => {
    setProcedureId(activeConversation?.procedure_id ?? "");
    setPatientMessage("");
    setAdditionalContext("");
    setResult(latestResult?.result ?? null);
    setDraftMessageId(latestResult?.draft_message_id ?? null);
    setDraftText(latestResult?.result.response.primary_response ?? "");
    setSentConfirmed(false);
    setError(null);
  }, [activeConversation?.id, activeConversation?.procedure_id, latestResult]);

  async function createConversation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setError(null);

    try {
      const response = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactLabel,
          channel: newChannel,
          procedureId: newProcedureId || null,
        }),
      });
      const payload = (await response.json()) as { conversationId?: string; error?: string };
      if (!response.ok || !payload.conversationId) {
        throw new Error(payload.error || "Não foi possível criar a conversa.");
      }

      setContactLabel("");
      setShowNewConversation(false);
      router.push(`/app/responder?conversation=${payload.conversationId}`);
      router.refresh();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Não foi possível criar a conversa.");
    } finally {
      setCreating(false);
    }
  }

  async function analyze(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeConversation) return;

    setLoading(true);
    setError(null);
    setCopied(false);
    setSentConfirmed(false);

    try {
      const response = await fetch(`/api/conversations/${activeConversation.id}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientMessage,
          additionalContext,
          procedureId: procedureId || null,
        }),
      });

      const payload = (await response.json()) as {
        result?: SpinEngineResult;
        draftMessageId?: string;
        error?: string;
      };
      if (!response.ok || !payload.result || !payload.draftMessageId) {
        throw new Error(payload.error || "Não foi possível analisar a nova mensagem.");
      }

      setResult(payload.result);
      setDraftMessageId(payload.draftMessageId);
      setDraftText(payload.result.response.primary_response);
      setPatientMessage("");
      setAdditionalContext("");
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Não foi possível analisar a mensagem.");
    } finally {
      setLoading(false);
    }
  }

  async function confirmSent() {
    if (!draftMessageId) return;
    setSavingDraft(true);
    setError(null);

    try {
      const response = await fetch(`/api/conversations/messages/${draftMessageId}/send`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: draftText }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Não foi possível confirmar o envio.");

      setSentConfirmed(true);
      setDraftMessageId(null);
      router.refresh();
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Não foi possível confirmar o envio.");
    } finally {
      setSavingDraft(false);
    }
  }

  async function updateStatus(status: SalesConversationStatus) {
    if (!activeConversation) return;
    setUpdatingStatus(true);
    setError(null);

    try {
      const response = await fetch(`/api/conversations/${activeConversation.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Não foi possível atualizar o status.");
      router.refresh();
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : "Não foi possível atualizar o status.");
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function copyDraft() {
    await navigator.clipboard.writeText(draftText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="conversation-workspace">
      <aside className="card conversation-sidebar">
        <div className="conversation-sidebar-header">
          <div><span className="eyebrow">Fila comercial</span><h2>Conversas</h2></div>
          <button
            className="button button-primary button-small"
            type="button"
            onClick={() => setShowNewConversation((current) => !current)}
          >
            <MessageCirclePlus size={16} /> Nova
          </button>
        </div>

        {showNewConversation && (
          <form className="conversation-create-form" onSubmit={createConversation}>
            <div className="field">
              <label htmlFor="contact-label">Referência do contato</label>
              <input
                className="input"
                id="contact-label"
                maxLength={120}
                minLength={2}
                required
                value={contactLabel}
                onChange={(event) => setContactLabel(event.target.value)}
                placeholder="Ex.: Lead Instagram 042"
              />
              <small className="field-help">Use uma referência interna. Ela não é enviada à IA.</small>
            </div>
            <div className="grid-2 conversation-create-grid">
              <div className="field">
                <label htmlFor="new-channel">Canal</label>
                <select className="select" id="new-channel" value={newChannel} onChange={(event) => setNewChannel(event.target.value as SalesConversationChannel)}>
                  {Object.entries(CHANNEL_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="new-procedure">Procedimento</label>
                <select className="select" id="new-procedure" value={newProcedureId} onChange={(event) => setNewProcedureId(event.target.value)}>
                  <option value="">Ainda não definido</option>
                  {procedures.map((procedure) => <option key={procedure.id} value={procedure.id}>{procedure.name}</option>)}
                </select>
              </div>
            </div>
            <button className="button button-secondary" disabled={creating || contactLabel.trim().length < 2} type="submit">
              {creating ? "Criando..." : "Criar conversa"}
            </button>
          </form>
        )}

        <div className="conversation-list">
          {conversations.length === 0 ? (
            <div className="empty-state">Nenhuma conversa criada.</div>
          ) : conversations.map((conversation) => (
            <Link
              className={`conversation-list-item ${conversation.id === activeConversation?.id ? "conversation-list-item-active" : ""}`}
              href={`/app/responder?conversation=${conversation.id}`}
              key={conversation.id}
            >
              <div className="conversation-list-topline">
                <strong>{conversation.contact_label}</strong>
                <StatusPill tone={statusTone(conversation.status)}>{STATUS_LABELS[conversation.status]}</StatusPill>
              </div>
              <span>{CHANNEL_LABELS[conversation.channel]} · {conversation.procedure_name || "Procedimento indefinido"}</span>
              <p>{conversation.summary || conversation.next_objective || "Aguardando a primeira mensagem."}</p>
              <small>{formatDate(conversation.last_message_at)}</small>
            </Link>
          ))}
        </div>
      </aside>

      {!activeConversation ? (
        <section className="card conversation-empty-main">
          <MessageSquareText size={34} />
          <span className="eyebrow">Memória comercial</span>
          <h2>Crie ou selecione uma conversa</h2>
          <p>Cada conversa guarda somente mensagens recebidas e respostas confirmadas como enviadas.</p>
        </section>
      ) : (
        <section className="conversation-main-column">
          <header className="card conversation-header-card">
            <div className="conversation-contact-title">
              <div className="conversation-avatar"><UserRound size={20} /></div>
              <div>
                <span className="eyebrow">{CHANNEL_LABELS[activeConversation.channel]}</span>
                <h2>{activeConversation.contact_label}</h2>
                <p>{activeConversation.procedure_id ? procedureNames.get(activeConversation.procedure_id) : "Procedimento ainda não definido"}</p>
              </div>
            </div>
            <div className="conversation-header-actions">
              <StatusPill tone="gold">{SPIN_LABELS[activeConversation.spin_stage]}</StatusPill>
              <select
                className="select conversation-status-select"
                disabled={updatingStatus}
                value={activeConversation.status}
                onChange={(event) => updateStatus(event.target.value as SalesConversationStatus)}
              >
                {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
          </header>

          <section className="card conversation-timeline-card">
            <div className="commercial-section-heading">
              <div><span>Histórico confirmado</span><h2>Linha do tempo</h2></div>
              <MessageSquareText size={19} />
            </div>

            <div className="conversation-timeline">
              {messages.length === 0 ? (
                <div className="empty-state">Cole a primeira mensagem recebida para iniciar a memória.</div>
              ) : messages.map((message) => (
                <article
                  className={`conversation-bubble conversation-bubble-${message.direction} ${message.status === "draft" ? "conversation-bubble-draft" : ""}`}
                  key={message.id}
                >
                  <div className="conversation-bubble-meta">
                    <strong>{message.direction === "patient" ? "Paciente" : "Clínica"}</strong>
                    <span>{message.status === "draft" ? "Rascunho, ainda não enviado" : formatDate(message.sent_at || message.created_at)}</span>
                  </div>
                  <p>{message.content}</p>
                </article>
              ))}
            </div>
          </section>

          <form className="card conversation-input-card" onSubmit={analyze}>
            <div className="commercial-section-heading">
              <div><span>Nova entrada</span><h2>Mensagem recebida</h2></div>
              <Sparkles size={19} />
            </div>

            <div className="field">
              <label htmlFor="conversation-procedure">Procedimento relacionado</label>
              <select className="select" id="conversation-procedure" value={procedureId} onChange={(event) => setProcedureId(event.target.value)}>
                <option value="">Não identificado</option>
                {procedures.map((procedure) => <option key={procedure.id} value={procedure.id}>{procedure.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="conversation-patient-message">Mensagem do paciente</label>
              <textarea
                className="textarea conversation-message-input"
                id="conversation-patient-message"
                maxLength={6000}
                minLength={2}
                required
                value={patientMessage}
                onChange={(event) => setPatientMessage(event.target.value)}
                placeholder="Cole somente a nova mensagem recebida."
              />
            </div>
            <div className="field">
              <label htmlFor="conversation-context">Contexto interno opcional</label>
              <textarea
                className="textarea"
                id="conversation-context"
                maxLength={6000}
                value={additionalContext}
                onChange={(event) => setAdditionalContext(event.target.value)}
                placeholder="Ex.: a atendente ligou ontem, mas não conseguiu contato."
              />
            </div>

            {error && <div className="form-error">{error}</div>}

            <button
              className="button button-primary"
              disabled={!aiConfigured || loading || activeConversation.status !== "open" || patientMessage.trim().length < 2}
              type="submit"
            >
              <Sparkles size={17} /> {loading ? "Atualizando a memória..." : "Analisar próxima mensagem"}
            </button>
            {activeConversation.status !== "open" && <small className="field-help">Reabra a conversa para adicionar novas mensagens.</small>}
          </form>
        </section>
      )}

      <aside className="conversation-intelligence-column">
        {!activeConversation ? null : !result ? (
          <div className="card conversation-intelligence-empty">
            <BrainCircuit size={30} />
            <span className="eyebrow">Estado comercial</span>
            <h2>A memória ganhará forma aqui</h2>
            <p>Após a primeira análise, o Nexo mostrará necessidades, objeções, estratégia e próximo movimento.</p>
          </div>
        ) : (
          <div className="conversation-result-stack">
            <section className={`card spin-answer-card ${result.validation.safe_to_use ? "spin-answer-safe" : "spin-answer-review"}`}>
              <div className="spin-result-header">
                <div><span className="eyebrow">Rascunho recomendado</span><h2>Próxima resposta</h2></div>
                <StatusPill tone={result.validation.safe_to_use ? "success" : "warning"}>
                  {result.validation.safe_to_use ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
                  {result.validation.safe_to_use ? "Validada" : "Revisar"}
                </StatusPill>
              </div>

              <textarea
                className="textarea conversation-draft-editor"
                disabled={!draftMessageId || sentConfirmed}
                maxLength={6000}
                value={draftText}
                onChange={(event) => setDraftText(event.target.value)}
              />
              <div className="inline-actions">
                <button className="button button-secondary" disabled={!draftText} onClick={copyDraft} type="button">
                  {copied ? <Check size={16} /> : <Clipboard size={16} />} {copied ? "Copiada" : "Copiar"}
                </button>
                <button
                  className="button button-primary"
                  disabled={!draftMessageId || savingDraft || sentConfirmed || draftText.trim().length < 2}
                  onClick={confirmSent}
                  type="button"
                >
                  <Send size={16} /> {savingDraft ? "Confirmando..." : sentConfirmed ? "Envio confirmado" : "Marcar como enviada"}
                </button>
              </div>
              <small className="field-help">Somente depois da confirmação essa resposta entra na memória da próxima análise.</small>
            </section>

            <section className="card">
              <div className="commercial-section-heading">
                <div><span>Leitura acumulada</span><h2>Diagnóstico</h2></div>
                <BrainCircuit size={19} />
              </div>
              <div className="spin-tag-row">
                <StatusPill tone="gold">{SPIN_LABELS[result.analysis.spin_stage]}</StatusPill>
                <StatusPill tone={riskTone(result.analysis.risk_level)}>Risco {result.analysis.risk_level}</StatusPill>
              </div>
              <dl className="spin-detail-list">
                <div><dt>Leitura da conversa</dt><dd>{result.analysis.summary}</dd></div>
                <div><dt>Necessidade explícita</dt><dd>{result.analysis.explicit_need || "Ainda não identificada"}</dd></div>
                <div><dt>Necessidade implícita</dt><dd>{result.analysis.implicit_need || "Ainda não identificada"}</dd></div>
                <div><dt>Estado emocional</dt><dd>{result.analysis.emotional_state || "Não identificado"}</dd></div>
              </dl>
            </section>

            <section className="card">
              <div className="commercial-section-heading">
                <div><span>Decisão comercial</span><h2>Próximo movimento</h2></div>
                <Route size={19} />
              </div>
              <dl className="spin-detail-list">
                <div><dt>Objetivo</dt><dd>{result.plan.next_objective}</dd></div>
                <div><dt>Estratégia</dt><dd>{result.plan.recommended_strategy}</dd></div>
                <div><dt>Justificativa</dt><dd>{result.plan.rationale}</dd></div>
              </dl>
              <div className="grid-2 spin-lists-grid">
                <div>
                  <strong>Informações ausentes</strong>
                  <ul>{listOrFallback(result.analysis.missing_information, "Nenhuma lacuna crítica.").map((item) => <li key={item}>{item}</li>)}</ul>
                </div>
                <div>
                  <strong>Evitar agora</strong>
                  <ul>{listOrFallback(result.plan.avoid_actions, "Nenhuma restrição adicional.").map((item) => <li key={item}>{item}</li>)}</ul>
                </div>
              </div>
            </section>
          </div>
        )}
      </aside>
    </div>
  );
}
