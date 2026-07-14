import Link from "next/link";
import { ArrowRight, BrainCircuit, CheckCircle2, FileLock2, ShieldCheck, UserRound } from "lucide-react";
import { StatusPill } from "@/components/ui/status-pill";
import { requireMembership } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ROLE_LABELS } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { activeMembership } = await requireMembership();
  const supabase = await createClient();

  const [{ count: patientCount }, { count: pendingDocumentCount }, { count: analysisCount }] = await Promise.all([
    supabase
      .from("patients")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", activeMembership.clinic_id),
    supabase
      .from("patient_documents")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", activeMembership.clinic_id)
      .in("status", ["created", "awaiting_signature", "ready_to_send"]),
    supabase
      .from("patient_document_ai_analyses")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", activeMembership.clinic_id),
  ]);

  return (
    <>
      <header className="page-header">
        <div className="page-heading">
          <span className="eyebrow">Revisão assistida, decisão humana</span>
          <h1>O documento chega. O Nexo acende as lanternas.</h1>
          <p>
            Arquivos privados agora podem receber uma pré-análise de tipo, legibilidade, campos aparentes e próximos cuidados antes da revisão da equipe.
          </p>
        </div>
        <StatusPill tone="success"><CheckCircle2 size={13} /> Iteração 7 ativa</StatusPill>
      </header>

      <section className="grid-3">
        <article className="stat-card">
          <div className="stat-card-header"><span>Pacientes e leads</span><UserRound size={17} /></div>
          <strong>{patientCount ?? 0}</strong>
          <p>Registros comerciais conectados a conversas e documentos.</p>
        </article>
        <article className="stat-card">
          <div className="stat-card-header"><span>Documentos pendentes</span><FileLock2 size={17} /></div>
          <strong>{pendingDocumentCount ?? 0}</strong>
          <p>Arquivos em criação, assinatura ou aguardando envio.</p>
        </article>
        <article className="stat-card">
          <div className="stat-card-header"><span>Pré-análises realizadas</span><BrainCircuit size={17} /></div>
          <strong>{analysisCount ?? 0}</strong>
          <p>Revisões operacionais por IA preservadas na auditoria.</p>
        </article>
      </section>

      <section className="grid-2" style={{ marginTop: "1rem" }}>
        <article className="card">
          <h2>O que mudou na Iteração 7</h2>
          <div className="section-stack">
            <div className="check-row"><BrainCircuit size={17} /><div><strong>Classificação e qualidade</strong><p>O Nexo sugere o tipo e aponta corte, desfoque, reflexo, orientação ou baixa legibilidade.</p></div></div>
            <div className="check-row"><CheckCircle2 size={17} /><div><strong>Checklist aparente</strong><p>Campos são marcados apenas como aparentemente presentes, ausentes, incertos ou não aplicáveis.</p></div></div>
            <div className="check-row"><ShieldCheck size={17} /><div><strong>Guarda-corpos rígidos</strong><p>A IA não valida autenticidade, assinatura, conformidade ou correção clínica e nunca muda o status sozinha.</p></div></div>
          </div>
        </article>

        <article className="card">
          <h2>Abra a revisão assistida</h2>
          <p className="card-description">
            Selecione um documento fictício ou anonimizado, confirme a proteção de dados e execute a pré-análise antes da revisão humana.
          </p>
          <div className="feature-row" style={{ marginTop: "1rem" }}>
            <ShieldCheck size={18} />
            <div><strong>Arquivos reais continuam bloqueados no MVP</strong><p>O provedor gratuito externo não deve receber informações pessoais ou de saúde identificáveis.</p></div>
          </div>
          <div className="inline-actions" style={{ marginTop: "1rem" }}>
            <Link className="button button-primary" href="/app/documentos"><BrainCircuit size={16} /> Abrir documentos <ArrowRight size={16} /></Link>
            <Link className="button button-secondary" href="/app/pacientes"><UserRound size={16} /> Abrir pacientes</Link>
          </div>
          <small className="field-help" style={{ display: "block", marginTop: "1rem" }}>Seu papel atual: {ROLE_LABELS[activeMembership.role]}.</small>
        </article>
      </section>
    </>
  );
}
