import Link from "next/link";
import { ArrowRight, Building2, CheckCircle2, MessageSquareText, ShieldCheck, UserRound } from "lucide-react";
import { StatusPill } from "@/components/ui/status-pill";
import { requireMembership } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ROLE_LABELS } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { activeMembership } = await requireMembership();
  const supabase = await createClient();

  const [{ count: patientCount }, { count: openConversationCount }, { count: convertedPatientCount }] = await Promise.all([
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
      .from("patients")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", activeMembership.clinic_id)
      .eq("status", "converted"),
  ]);

  return (
    <>
      <header className="page-header">
        <div className="page-heading">
          <span className="eyebrow">Memória comercial por pessoa</span>
          <h1>Conversas diferentes. Uma única história.</h1>
          <p>
            O Nexo conecta atendimentos, procedimentos de interesse, responsável e evolução comercial ao mesmo paciente ou lead.
          </p>
        </div>
        <StatusPill tone="success"><CheckCircle2 size={13} /> Iteração 5 ativa</StatusPill>
      </header>

      <section className="grid-3">
        <article className="stat-card">
          <div className="stat-card-header"><span>Pacientes e leads</span><UserRound size={17} /></div>
          <strong>{patientCount ?? 0}</strong>
          <p>Registros comerciais com linha do tempo e responsável definido.</p>
        </article>
        <article className="stat-card">
          <div className="stat-card-header"><span>Conversas abertas</span><MessageSquareText size={17} /></div>
          <strong>{openConversationCount ?? 0}</strong>
          <p>Atendimentos com memória ativa e próximo movimento pendente.</p>
        </article>
        <article className="stat-card">
          <div className="stat-card-header"><span>Convertidos</span><Building2 size={17} /></div>
          <strong>{convertedPatientCount ?? 0}</strong>
          <p>Registros cujo estágio geral foi marcado como convertido.</p>
        </article>
      </section>

      <section className="grid-2" style={{ marginTop: "1rem" }}>
        <article className="card">
          <h2>O que mudou na Iteração 5</h2>
          <div className="section-stack">
            <div className="check-row"><CheckCircle2 size={17} /><div><strong>Identidade comercial única</strong><p>Várias conversas podem pertencer ao mesmo paciente ou lead.</p></div></div>
            <div className="check-row"><CheckCircle2 size={17} /><div><strong>Linha do tempo consolidada</strong><p>Notas, mudanças de estágio, interesses e desfechos ficam ordenados em um só lugar.</p></div></div>
            <div className="check-row"><ShieldCheck size={17} /><div><strong>Referência fora da IA</strong><p>O identificador do cadastro não entra no prompt. Só memória comercial anonimizada cruza conversas.</p></div></div>
          </div>
        </article>

        <article className="card">
          <h2>Abra a carteira de pacientes</h2>
          <p className="card-description">
            Crie referências internas, escolha responsáveis, associe procedimentos e conecte os atendimentos que pertencem à mesma pessoa.
          </p>
          <div className="feature-row" style={{ marginTop: "1rem" }}>
            <UserRound size={18} />
            <div><strong>CRM enxuto, não prontuário</strong><p>O foco continua sendo contexto comercial e operacional, sem dados clínicos sensíveis.</p></div>
          </div>
          <div className="inline-actions" style={{ marginTop: "1rem" }}>
            <Link className="button button-primary" href="/app/pacientes"><UserRound size={16} /> Abrir pacientes <ArrowRight size={16} /></Link>
            <Link className="button button-secondary" href="/app/responder"><MessageSquareText size={16} /> Abrir conversas</Link>
          </div>
          <small className="field-help" style={{ display: "block", marginTop: "1rem" }}>Seu papel atual: {ROLE_LABELS[activeMembership.role]}.</small>
        </article>
      </section>
    </>
  );
}
