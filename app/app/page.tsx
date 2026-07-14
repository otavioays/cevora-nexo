import Link from "next/link";
import { ArrowRight, Building2, CheckCircle2, ShieldCheck, Sparkles, Users } from "lucide-react";
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
          <span className="eyebrow">Fundação operacional</span>
          <h1>O ambiente está de pé.</h1>
          <p>
            A clínica, os acessos e as paredes de segurança já estão organizados. Agora o Nexo
            pode crescer sem misturar operações.
          </p>
        </div>
        <StatusPill tone="success"><CheckCircle2 size={13} /> Iteração 1 ativa</StatusPill>
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
          <p>As ações disponíveis são filtradas pelo seu nível de acesso.</p>
        </article>
      </section>

      <section className="grid-2" style={{ marginTop: "1rem" }}>
        <article className="card">
          <h2>O que já funciona</h2>
          <div className="section-stack">
            <div className="check-row"><CheckCircle2 size={17} /><div><strong>Autenticação individual</strong><p>Cadastro, login, recuperação e redefinição de senha.</p></div></div>
            <div className="check-row"><CheckCircle2 size={17} /><div><strong>Multi-clínica com RLS</strong><p>O PostgreSQL bloqueia qualquer leitura cruzada entre clínicas.</p></div></div>
            <div className="check-row"><CheckCircle2 size={17} /><div><strong>Papéis e convites</strong><p>Proprietários, gestores e atendentes possuem permissões diferentes.</p></div></div>
          </div>
        </article>

        <article className="card">
          <h2>Próximo tijolo</h2>
          <p className="card-description">
            A Iteração 2 transformará o ambiente vazio em uma representação real da clínica:
            procedimentos, diferenciais, regras, tom de voz e limites comerciais.
          </p>
          <div className="feature-row" style={{ marginTop: "1rem" }}>
            <Sparkles size={18} />
            <div><strong>Motor SPIN preservado para a Iteração 3</strong><p>Primeiro ensinamos quem a clínica é. Depois damos voz à inteligência.</p></div>
          </div>
          <div className="inline-actions" style={{ marginTop: "1rem" }}>
            <Link className="button button-primary" href="/app/equipe">Organizar equipe <ArrowRight size={16} /></Link>
          </div>
        </article>
      </section>
    </>
  );
}
