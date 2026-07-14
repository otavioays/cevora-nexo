import Link from "next/link";
import { ArrowRight, BookOpenCheck, Building2, CheckCircle2, ShieldCheck, Sparkles, Users } from "lucide-react";
import { StatusPill } from "@/components/ui/status-pill";
import { requireMembership } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ROLE_LABELS } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { activeMembership } = await requireMembership();
  const supabase = await createClient();

  const [{ count: memberCount }, { count: pendingInvitationCount }] = await Promise.all([
    supabase
      .from("clinic_members")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", activeMembership.clinic_id)
      .eq("status", "active"),
    supabase
      .from("clinic_invitations")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", activeMembership.clinic_id)
      .eq("status", "pending"),
  ]);

  return (
    <>
      <header className="page-header">
        <div className="page-heading">
          <span className="eyebrow">Contexto operacional</span>
          <h1>Agora o Nexo pode aprender a clínica.</h1>
          <p>
            A fundação multi-clínica continua protegida. Nesta iteração, cada ambiente ganha sua
            própria memória comercial, com fatos, regras, limites e exemplos aprovados.
          </p>
        </div>
        <StatusPill tone="success"><CheckCircle2 size={13} /> Iteração 2 ativa</StatusPill>
      </header>

      <section className="grid-3">
        <article className="stat-card">
          <div className="stat-card-header"><span>Clínica</span><Building2 size={17} /></div>
          <strong>{activeMembership.clinic.name}</strong>
          <p>Ambiente isolado e identificado por <code>{activeMembership.clinic.slug}</code>.</p>
        </article>
        <article className="stat-card">
          <div className="stat-card-header"><span>Equipe ativa</span><Users size={17} /></div>
          <strong>{memberCount ?? 0}</strong>
          <p>{pendingInvitationCount ?? 0} convite(s) aguardando aceite.</p>
        </article>
        <article className="stat-card">
          <div className="stat-card-header"><span>Seu papel</span><ShieldCheck size={17} /></div>
          <strong>{ROLE_LABELS[activeMembership.role]}</strong>
          <p>As ações disponíveis continuam filtradas pelo seu nível de acesso.</p>
        </article>
      </section>

      <section className="grid-2" style={{ marginTop: "1rem" }}>
        <article className="card">
          <h2>O que a Iteração 2 adiciona</h2>
          <div className="section-stack">
            <div className="check-row"><CheckCircle2 size={17} /><div><strong>Identidade e operação</strong><p>Descrição, localização, horários, pagamentos e regras de agendamento.</p></div></div>
            <div className="check-row"><CheckCircle2 size={17} /><div><strong>Catálogo e autoridade</strong><p>Procedimentos, profissionais, benefícios permitidos e política de preços.</p></div></div>
            <div className="check-row"><CheckCircle2 size={17} /><div><strong>Trilhos da IA</strong><p>Tom de voz, afirmações proibidas, FAQs e respostas previamente aprovadas.</p></div></div>
          </div>
        </article>

        <article className="card">
          <h2>Construa a fonte de verdade</h2>
          <p className="card-description">
            O perfil comercial será consultado pelo motor SPIN na próxima iteração. Quanto melhor
            estruturado, menos espaço haverá para respostas genéricas ou informações inventadas.
          </p>
          <div className="feature-row" style={{ marginTop: "1rem" }}>
            <Sparkles size={18} />
            <div><strong>Motor SPIN preservado para a Iteração 3</strong><p>Primeiro definimos a verdade da clínica. Depois ensinamos a IA a escolher o próximo movimento.</p></div>
          </div>
          <div className="inline-actions" style={{ marginTop: "1rem" }}>
            <Link className="button button-primary" href="/app/perfil-comercial"><BookOpenCheck size={16} /> Estruturar perfil <ArrowRight size={16} /></Link>
          </div>
        </article>
      </section>
    </>
  );
}
