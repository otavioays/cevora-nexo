"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  AlertTriangle,
  BrainCircuit,
  Check,
  Clipboard,
  FileWarning,
  ScanSearch,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { StatusPill } from "@/components/ui/status-pill";
import type { PatientDocumentListItem } from "@/lib/types";
import type {
  DocumentFieldStatus,
  DocumentIntelligenceResult,
  PatientDocumentAiAnalysis,
} from "@/lib/ai/document-intelligence-types";
import { formatDate } from "@/lib/utils";

const TYPE_LABELS = {
  prescription: "Receita ou prescrição",
  exam_request: "Solicitação de exame",
  medical_certificate: "Atestado",
  informed_consent: "Termo de consentimento",
  instructions: "Orientações ao paciente",
  report: "Relatório",
  other: "Outro documento",
} as const;

const READABILITY_LABELS = {
  clear: "Clara",
  acceptable: "Aceitável",
  poor: "Baixa",
  unreadable: "Ilegível",
} as const;

const RECOMMENDATION_LABELS = {
  ready_for_human_review: "Seguir para revisão humana",
  request_better_file: "Solicitar arquivo melhor",
  manual_specialist_review: "Revisão especializada necessária",
} as const;

const FIELD_STATUS_LABELS: Record<DocumentFieldStatus, string> = {
  present: "Parece presente",
  missing: "Parece ausente",
  unclear: "Pouco claro",
  not_applicable: "Não aplicável",
};

function fieldTone(status: DocumentFieldStatus) {
  if (status === "present") return "success" as const;
  if (status === "missing") return "danger" as const;
  if (status === "unclear") return "warning" as const;
  return "neutral" as const;
}

function recommendationTone(result: DocumentIntelligenceResult) {
  if (result.recommendation === "request_better_file") return "warning" as const;
  if (result.recommendation === "manual_specialist_review") return "danger" as const;
  return "success" as const;
}

export function DocumentIntelligencePanel({
  activeDocument,
  latestAnalysis,
}: {
  activeDocument: PatientDocumentListItem | null;
  latestAnalysis: PatientDocumentAiAnalysis | null;
}) {
  const router = useRouter();
  const [privacyConfirmed, setPrivacyConfirmed] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [sendMessage, setSendMessage] = useState(latestAnalysis?.result.suggested_send_message ?? "");

  async function analyzeDocument() {
    if (!activeDocument) return;
    setAnalyzing(true);
    setError(null);

    try {
      const response = await fetch(`/api/documents/${activeDocument.id}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ privacyConfirmed }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Não foi possível executar a pré-análise.");
      }
      router.refresh();
    } catch (analysisError) {
      setError(analysisError instanceof Error ? analysisError.message : "Não foi possível executar a pré-análise.");
    } finally {
      setAnalyzing(false);
    }
  }

  async function copyMessage() {
    if (!sendMessage.trim()) return;
    await navigator.clipboard.writeText(sendMessage.trim());
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  if (!activeDocument) {
    return (
      <section className="card document-intelligence-panel document-intelligence-empty">
        <BrainCircuit size={30} />
        <div><span className="eyebrow">Iteração 7</span><h2>Inteligência documental assistida</h2></div>
        <p>Selecione um documento para abrir a pré-análise operacional.</p>
      </section>
    );
  }

  const hasFile = Boolean(activeDocument.storage_path);
  const canAnalyze = hasFile && activeDocument.status !== "cancelled" && activeDocument.size_bytes <= 10 * 1024 * 1024;
  const result = latestAnalysis?.result ?? null;

  return (
    <section className="card document-intelligence-panel">
      <div className="document-intelligence-heading">
        <div>
          <span className="eyebrow">Revisor operacional por IA</span>
          <h2><BrainCircuit size={20} /> Pré-análise do arquivo</h2>
        </div>
        {latestAnalysis ? (
          <StatusPill tone="gold"><Sparkles size={13} /> Analisado</StatusPill>
        ) : (
          <StatusPill tone="neutral"><ScanSearch size={13} /> Sem análise</StatusPill>
        )}
      </div>

      <div className="permission-note document-intelligence-warning">
        <ShieldCheck size={18} /> A IA não verifica autenticidade, assinatura, validade jurídica ou correção clínica. Nenhum status muda automaticamente.
      </div>

      {!canAnalyze && (
        <div className="form-error">
          {!hasFile
            ? "Anexe um arquivo antes de solicitar a pré-análise."
            : activeDocument.status === "cancelled"
              ? "Documentos cancelados não podem ser analisados."
              : "A análise por IA aceita arquivos de até 10 MB nesta versão. Faça a revisão manual ou use um arquivo menor."}
        </div>
      )}

      {canAnalyze && (
        <div className="document-analysis-trigger">
          <label className="document-privacy-confirmation">
            <input
              checked={privacyConfirmed}
              onChange={(event) => setPrivacyConfirmed(event.target.checked)}
              type="checkbox"
            />
            <span>Confirmo que este arquivo é fictício ou foi anonimizado e não contém dados pessoais ou de saúde identificáveis.</span>
          </label>
          <button
            className="button button-primary"
            disabled={!privacyConfirmed || analyzing}
            onClick={analyzeDocument}
            type="button"
          >
            <ScanSearch size={16} /> {analyzing ? "Analisando arquivo..." : latestAnalysis ? "Executar nova análise" : "Analisar arquivo"}
          </button>
        </div>
      )}

      {error && <div className="form-error">{error}</div>}

      {result && latestAnalysis && (
        <div className="document-intelligence-results">
          <div className="document-intelligence-meta">
            <span>Modelo: {latestAnalysis.model}</span>
            <span>{formatDate(latestAnalysis.created_at)}</span>
            <strong>Revisão humana obrigatória</strong>
          </div>

          <div className="document-intelligence-grid">
            <article>
              <span>Classificação sugerida</span>
              <strong>{TYPE_LABELS[result.classification.suggested_type]}</strong>
              <p>{result.classification.rationale}</p>
              <small>Confiança aproximada: {Math.round(result.classification.confidence * 100)}%</small>
            </article>
            <article>
              <span>Qualidade aparente</span>
              <strong>{READABILITY_LABELS[result.visual_quality.readability]}</strong>
              <p>{result.visual_quality.issues.length ? result.visual_quality.issues.join(" · ") : "Nenhum problema visual evidente foi apontado."}</p>
            </article>
            <article>
              <span>Próximo movimento</span>
              <StatusPill tone={recommendationTone(result)}>{RECOMMENDATION_LABELS[result.recommendation]}</StatusPill>
              <p>{result.review_summary}</p>
            </article>
          </div>

          <div className="document-analysis-section">
            <div className="commercial-section-heading">
              <div><span>Presença aparente</span><h3>Checklist de campos</h3></div>
              <Check size={18} />
            </div>
            <div className="document-field-checks">
              {result.field_checks.map((check, index) => (
                <article key={`${check.field}-${index}`}>
                  <div><strong>{check.field}</strong><StatusPill tone={fieldTone(check.status)}>{FIELD_STATUS_LABELS[check.status]}</StatusPill></div>
                  {check.note && <p>{check.note}</p>}
                </article>
              ))}
            </div>
          </div>

          {(result.alerts.length > 0 || result.limitations.length > 0) && (
            <div className="document-alert-columns">
              <article>
                <h3><AlertTriangle size={17} /> Alertas</h3>
                {result.alerts.length ? <ul>{result.alerts.map((alert) => <li key={alert}>{alert}</li>)}</ul> : <p>Nenhum alerta adicional.</p>}
              </article>
              <article>
                <h3><FileWarning size={17} /> Limites</h3>
                <ul>{result.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}</ul>
              </article>
            </div>
          )}

          <div className="document-analysis-section">
            <div className="commercial-section-heading">
              <div><span>Somente após revisar</span><h3>Mensagem sugerida</h3></div>
              <Clipboard size={18} />
            </div>
            <textarea
              className="textarea document-send-message"
              maxLength={700}
              onChange={(event) => setSendMessage(event.target.value)}
              value={sendMessage}
            />
            <div className="document-message-actions">
              <small>Edite livremente. Copiar a mensagem não altera o status nem envia nada ao paciente.</small>
              <button className="button button-secondary" disabled={!sendMessage.trim()} onClick={copyMessage} type="button">
                {copied ? <Check size={16} /> : <Clipboard size={16} />} {copied ? "Copiada" : "Copiar mensagem"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
