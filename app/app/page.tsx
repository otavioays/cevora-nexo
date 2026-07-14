import Link from "next/link";
import { ArrowRight, CheckCircle2, FileLock2, MessageSquareText, ShieldCheck, UserRound } from "lucide-react";
import { StatusPill } from "@/components/ui/status-pill";
import { requireMembership } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ROLE_LABELS } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { activeMembership } = await requireMembership();
  const supabase = await createClient();

  const [{ count: patientCount }, { count: openConversationCount }, { count: pendingDocumentCount }] = await Promise.all([
    supabase
      .from("patients")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", activeMembership.clinic_id),
    supabase
      .from("sales_conversations")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", activeMembership.clinic_id)
      .eq("status", "open"),
    supabase
      .from("patient_documents")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", activeMembership.clinic_id)
      .in("status", ["created", "awaiting_signature", "ready_to_send"]),
  ]);

  return (
    <>
      <header className="page-header">
        <div className="page-heading">
          <span className="eyebrow">Operação conectada ao paciente</span>
          <h1>Da conversa ao documento, sem perder o fio.</h1>
          <p>
            O Nexo reúne memória comercial, responsáveis e arquivos privados em fluxos claros, auditáveis e ligados à mesma pessoa.
          </p>
        </div>
        <StatusPill tone="success"><CheckCircle2 size={13} /> Iteração 6 ativa</StatusPill>
      </header>

      <section className="grid-3">
        <article className="stat-card">
          <div className="stat-card-header"><span>Pacientes e leads</span><UserRound size={17} /></div>
          <strong>{patientCount ?? 0}</strong>
          <p>Registros comerciais com linha do tempo e responsável definido.</p>
        </article>
        <article className="stat-card">
          <div className="stat-card-header"><span>Documentos pendentes</span><FileLock2 size={17} /></div>
          <strong>{pendingDocumentCount ?? 0}</strong>
          <p>Arquivos em criação, assinatura ou aguardando envio.</p>
        </article>
        <article className="stat-card">
          <div className="stat-card-header"><span>Conversas abertas</span><MessageSquareText size={17} /></div>
          <strong>{openConversationCount ?? 0}</strong>
          <p>Atendimentos com memória ativa e próximo movimento pendente.</p>
        </article>
      </section>

      <section className="grid-2" style={{ marginTop: "1rem" }}>
        <article className="card">
          <h2>O que mudou na Iteração 6</h2>
          <div className="section-stack">
            <div className="check-row"><FileLock2 size={17} /><div><strong>Arquivos privados</strong><p>PDF, JPG e PNG ficam em armazenamento não público, com acesso temporário.</p></div></div>
            <div className="check-row"><CheckCircle2 size={17} /><div><strong>Fluxo operacional</strong><p>Criação, assinatura, liberação, envio e visualização possuem estados explícitos.</p></div></div>
            <div className="check-row"><ShieldCheck size={17} /><div><strong>Auditoria contínua</strong><p>Uploads, mudanças, notas e acessos ao arquivo deixam um rastro interno.</p></div></div>
          </div>
        </article>

        <article className="card">
          <h2>Abra a Central de Documentos</h2>
          <p className="card-description">
            Crie um documento para um paciente, anexe o arquivo e acompanhe quem precisa agir em cada etapa.
          </p>
          <div className="feature-row" style={{ marginTop: "1rem" }}>
            <ShieldCheck size={18} />
            <div><strong>Controle, não certificado digital</strong><p>O MVP rastreia o fluxo, mas ainda não assina documentos nem substitui plataformas oficiais.</p></div>
          </div>
          <div className="inline-actions" style={{ marginTop: "1rem" }}>
            <Link className="button button-primary" href="/app/documentos"><FileLock2 size={16} /> Abrir documentos <ArrowRight size={16} /></Link>
            <Link className="button button-secondary" href="/app/pacientes"><UserRound size={16} /> Abrir pacientes</Link>
          </div>
          <small className="field-help" style={{ display: "block", marginTop: "1rem" }}>Seu papel atual: {ROLE_LABELS[activeMembership.role]}.</small>
        </article>
      </section>
    </>
  );
}