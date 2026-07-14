"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  BrainCircuit,
  Check,
  CheckCircle2,
  Clipboard,
  History,
  MessageSquareText,
  Route,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { StatusPill } from "@/components/ui/status-pill";
import type { Procedure, SpinEngineResult, SpinHistoryItem, SpinRiskLevel, SpinStage } from "@/lib/types";
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

const INTERACTION_LABELS = {
  opening: "Abertura",
  investigation: "Investigação",
  capability: "Demonstração de capacidade",
  commitment: "Obtenção de compromisso",
} as const;

function riskTone(risk: SpinRiskLevel) {
  if (risk === "high") return "danger" as const;
  if (risk === "medium") return "warning" as const;
  return "success" as const;
}

function listOrFallback(items: string[], fallback: string) {
  return items.length > 0 ? items : [fallback];
}

export function SpinWorkbench({
  procedures,
  initialHistory,
  aiConfigured,
}: {
  procedures: Procedure[];
  initialHistory: SpinHistoryItem[];
  aiConfigured: boolean;
}) {
  const router = useRouter();
  const [patientMessage, setPatientMessage] = useState("");
  const [additionalContext, setAdditionalContext] = useState("");
  const [procedureId, setProcedureId] = useState("");
  const [result, setResult] = useState<SpinEngineResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<"primary" | "alternative" | null>(null);

  async function analyze(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setCopied(null);

    try {
      const response = await fetch("/api/spin/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientMessage,
          additionalContext,
          procedureId: procedureId || null,
        }),
      });

      const payload = (await response.json()) as { result?: SpinEngineResult; error?: string };
      if (!response.ok || !payload.result) {
        throw new Error(payload.error || "Não foi possível analisar a mensagem.");
      }

      setResult(payload.result);
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Não foi possível analisar a mensagem.");
    } finally {
      setLoading(false);
    }
  }

  async function copyResponse(kind: "primary" | "alternative", text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(kind);
    window.setTimeout(() => setCopied(null), 1800);
  }

  return (
    <div className="spin-layout">
      <section className="spin-input-column">
        <form className="card spin-form" onSubmit={analyze}>
          <div className="commercial-section-heading">
            <div><span>Entrada da atendente</span><h2>Mensagem recebida</h2></div>
            <MessageSquareText size={19} />
          </div>

          {!aiConfigured && (
            <div className="form-error">
              O motor ainda não possui uma chave de IA configurada na Vercel. A interface está pronta, mas a análise ficará bloqueada.
            </div>
          )}

          <div className="field">
            <label htmlFor="procedure">Procedimento relacionado</label>
            <select
              className="select"
              id="procedure"
              value={procedureId}
              onChange={(event) => setProcedureId(event.target.value)}
            >
              <option value="">Não identificado ou não informado</option>
              {procedures.map((procedure) => (
                <option key={procedure.id} value={procedure.id}>{procedure.name}</option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="patient-message">Mensagem do paciente</label>
            <textarea
              className="textarea spin-message-input"
              id="patient-message"
              required
              minLength={2}
              maxLength={6000}
              value={patientMessage}
              onChange={(event) => setPatientMessage(event.target.value)}
              placeholder="Ex.: Quanto custa uma rinoplastia? Tenho medo de ficar artificial."
            />
            <small className="field-help">Cole a mensagem exata. Nesta iteração, o Nexo analisa uma interação por vez.</small>
          </div>

          <div className="field">
            <label htmlFor="additional-context">Contexto adicional, se necessário</label>
            <textarea
              className="textarea"
              id="additional-context"
              maxLength={6000}
              value={additionalContext}
              onChange={(event) => setAdditionalContext(event.target.value)}
              placeholder="Ex.: Ela já perguntou sobre agenda ontem e disse que mora em outra cidade."
            />
          </div>

          {error && <div className="form-error">{error}</div>}

          <button
            className="button button-primary spin-submit"
            type="submit"
            disabled={!aiConfigured || loading || patientMessage.trim().length < 2}
          >
            <Sparkles size={17} /> {loading ? "Diagnosticando a conversa..." : "Analisar com o Nexo"}
          </button>

          <div className="permission-note">
            <ShieldCheck size={18} /> A mensagem é processada no servidor. A chave da IA nunca é enviada ao navegador.
          </div>
        </form>

        <section className="card spin-history-card">
          <div className="commercial-section-heading">
            <div><span>Registro recente</span><h2>Últimas análises</h2></div>
            <History size={19} />
          </div>

          {initialHistory.length === 0 ? (
            <div className="empty-state spin-empty-state">Nenhuma mensagem foi analisada ainda.</div>
          ) : (
            <div className="spin-history-list">
              {initialHistory.map((item) => (
                <article className="spin-history-item" key={item.id}>
                  <div className="spin-history-topline">
                    <span>{formatDate(item.created_at)}</span>
                    {item.spin_stage && <StatusPill tone="gold">{SPIN_LABELS[item.spin_stage]}</StatusPill>}
                  </div>
                  <strong>{item.procedure_name || "Procedimento não definido"}</strong>
                  <p>{item.patient_message}</p>
                  {item.primary_response && <small>Resposta: {item.primary_response}</small>}
                </article>
              ))}
            </div>
          )}
        </section>
      </section>

      <section className="spin-output-column">
        {!result ? (
          <div className="card spin-placeholder">
            <div className="spin-placeholder-icon"><BrainCircuit size={30} /></div>
            <span className="eyebrow">Três cérebros separados</span>
            <h2>Diagnosticar. Decidir. Responder.</h2>
            <p>
              O Nexo não salta da mensagem diretamente para uma frase bonita. Primeiro entende o estado da conversa,
              depois escolhe o movimento SPIN e somente então escreve.
            </p>
            <div className="spin-pipeline-preview">
              <div><strong>1</strong><span>Diagnóstico comercial</span></div>
              <div><strong>2</strong><span>Próximo objetivo</span></div>
              <div><strong>3</strong><span>Resposta pronta</span></div>
            </div>
          </div>
        ) : (
          <div className="spin-result-stack">
            <section className={`card spin-answer-card ${result.validation.safe_to_use ? "spin-answer-safe" : "spin-answer-review"}`}>
              <div className="spin-result-header">
                <div>
                  <span className="eyebrow">Resposta recomendada</span>
                  <h2>O próximo movimento</h2>
                </div>
                <StatusPill tone={result.validation.safe_to_use ? "success" : "warning"}>
                  {result.validation.safe_to_use ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
                  {result.validation.safe_to_use ? "Validada" : "Revisar antes de enviar"}
                </StatusPill>
              </div>

              <blockquote className="spin-response-text">{result.response.primary_response}</blockquote>
              <button
                className="button button-primary"
                type="button"
                onClick={() => copyResponse("primary", result.response.primary_response)}
              >
                {copied === "primary" ? <Check size={16} /> : <Clipboard size={16} />}
                {copied === "primary" ? "Copiada" : "Copiar resposta"}
              </button>

              {result.response.alternative_response && (
                <div className="spin-alternative">
                  <div><strong>Alternativa</strong><span>Uma rota diferente, preservando o mesmo objetivo.</span></div>
                  <p>{result.response.alternative_response}</p>
                  <button
                    className="button button-secondary button-small"
                    type="button"
                    onClick={() => copyResponse("alternative", result.response.alternative_response)}
                  >
                    {copied === "alternative" ? <Check size={15} /> : <Clipboard size={15} />}
                    {copied === "alternative" ? "Copiada" : "Copiar alternativa"}
                  </button>
                </div>
              )}
            </section>

            <section className="grid-2 spin-diagnosis-grid">
              <article className="card">
                <div className="commercial-section-heading">
                  <div><span>Cérebro 1</span><h2>Diagnóstico</h2></div>
                  <BrainCircuit size={19} />
                </div>
                <div className="spin-tag-row">
                  <StatusPill tone="gold">{SPIN_LABELS[result.analysis.spin_stage]}</StatusPill>
                  <StatusPill>{INTERACTION_LABELS[result.analysis.interaction_stage]}</StatusPill>
                  <StatusPill tone={riskTone(result.analysis.risk_level)}>Risco {result.analysis.risk_level}</StatusPill>
                </div>
                <dl className="spin-detail-list">
                  <div><dt>Intenção</dt><dd>{result.analysis.intent}</dd></div>
                  <div><dt>Leitura da conversa</dt><dd>{result.analysis.summary}</dd></div>
                  <div><dt>Necessidade explícita</dt><dd>{result.analysis.explicit_need || "Ainda não identificada"}</dd></div>
                  <div><dt>Necessidade implícita</dt><dd>{result.analysis.implicit_need || "Ainda não identificada"}</dd></div>
                  <div><dt>Estado emocional</dt><dd>{result.analysis.emotional_state || "Não identificado"}</dd></div>
                  <div><dt>Confiança</dt><dd>{Math.round(result.analysis.confidence * 100)}%</dd></div>
                </dl>
              </article>

              <article className="card">
                <div className="commercial-section-heading">
                  <div><span>Cérebro 2</span><h2>Plano</h2></div>
                  <Route size={19} />
                </div>
                <dl className="spin-detail-list">
                  <div><dt>Próximo objetivo</dt><dd>{result.plan.next_objective}</dd></div>
                  <div><dt>Estratégia</dt><dd>{result.plan.recommended_strategy}</dd></div>
                  <div><dt>Por quê</dt><dd>{result.plan.rationale}</dd></div>
                  <div><dt>Apresentar oferta agora?</dt><dd>{result.plan.should_present_offer ? "Sim" : "Não"}</dd></div>
                  <div><dt>Pedir compromisso agora?</dt><dd>{result.plan.should_request_commitment ? "Sim" : "Não"}</dd></div>
                </dl>
              </article>
            </section>

            <section className="card spin-strategy-card">
              <div className="commercial-section-heading">
                <div><span>Cérebro 3</span><h2>Orientação para a atendente</h2></div>
                <MessageSquareText size={19} />
              </div>
              <div className="grid-2">
                <div className="spin-note-box"><strong>Estratégia usada</strong><p>{result.response.explanation}</p></div>
                <div className="spin-note-box"><strong>Próximo passo esperado</strong><p>{result.response.expected_next_step}</p></div>
              </div>

              <div className="grid-2 spin-lists-grid">
                <div>
                  <strong>Informações ainda ausentes</strong>
                  <ul>{listOrFallback(result.analysis.missing_information, "Nenhuma lacuna crítica detectada.").map((item) => <li key={item}>{item}</li>)}</ul>
                </div>
                <div>
                  <strong>Evitar agora</strong>
                  <ul>{listOrFallback(result.plan.avoid_actions, "Nenhuma restrição adicional.").map((item) => <li key={item}>{item}</li>)}</ul>
                </div>
              </div>

              {(result.response.warnings.length > 0 || result.validation.issues.length > 0) && (
                <div className="spin-warning-box">
                  <AlertTriangle size={18} />
                  <div>
                    <strong>Atenção antes de copiar</strong>
                    <ul>
                      {Array.from(new Set([...result.response.warnings, ...result.validation.issues])).map((warning) => (
                        <li key={warning}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </section>
          </div>
        )}
      </section>
    </div>
  );
}
