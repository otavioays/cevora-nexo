import Link from "next/link";
import { ArrowRight, Building2, CheckCircle2, MessageSquareText, ShieldCheck, Users } from "lucide-react";
import { StatusPill } from "@/components/ui/status-pill";
import { requireMembership } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ROLE_LABELS } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { activeMembership } = await requireMembership();
  const supabase = await createClient();

  const [{ count: memberCount }, { count: pendingInvitationCount }, { count: openConversationCount }] = await Promise.all([
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
    supabase
      .from("sales_conversations")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", activeMembership.clinic_id)
      .eq("status", "open"),
  ]);

  return (
    <>
      <header className="page-header">
        <div className="page-heading">
          <span className="eyebrow">Memória comercial contínua</span>
          <h1>O Nexo agora acompanha a conversa inteira.</h1>
          <p>
            Mensagens recebidas, respostas confirmadas, necessidades, objeções e próximo objetivo passam a viver
            em uma linha do tempo única, em vez de desaparecerem entre análises isoladas.
          </p>
        </div>
        <StatusPill tone="success"><CheckCircle2 size={13} /> Iteração 4 ativa</StatusPill>
      </header>

      <section className="grid-3">
        <article className="stat-card">
          <div className="stat-card-header"><span>Clínica</span><Building2 size={17} /></div>
          <strong>{activeMembership.clinic.name}</strong>
          <p>Ambiente isolado e identificado por <code>{activeMembership.clinic.slug}</code>.</p>
        </article>
        <article className="stat-card">
          <div className="stat-card-header"><span>Conversas abertas</span><MessageSquareText size={17} /></div>
          <strong>{openConversationCount ?? 0}</strong>
          <p>Atendimentos com memória comercial ativa e próximo movimento pendente.</p>
        </article>
        <article className="stat-card">
          <div className="stat-card-header"><span>Seu papel</span><ShieldCheck size={17} /></div>
          <strong>{ROLE_LABELS[activeMembership.role]}</strong>
          <p>{memberCount ?? 0} membro(s) ativo(s) e {pendingInvitationCount ?? 0} convite(s) pendente(s).</p>
        </article>
      </section>

      <section className="grid-2" style={{ marginTop: "1rem" }}>
        <article className="card">
          <h2>O que mudou na Iteração 4</h2>
          <div className="section-stack">
            <div className="check-row"><CheckCircle2 size={17} /><div><strong>Histórico confirmado</strong><p>Somente mensagens recebidas e respostas marcadas como enviadas entram na memória.</p></div></div>
            <div className="check-row"><CheckCircle2 size={17} /><div><strong>Estado comercial acumulado</strong><p>Necessidades, objeções, emoção, etapa SPIN e próximo objetivo são atualizados a cada turno.</p></div></div>
            <div className="check-row"><CheckCircle2 size={17} /><div><strong>Desfecho rastreável</strong><p>Cada conversa pode ser mantida aberta, convertida, encerrada ou arquivada.</p></div></div>
          </div>
        </article>

        <article className="card">
          <h2>Abra a mesa de atendimento</h2>
          <p className="card-description">
            Crie uma referência interna, escolha o canal e registre cada nova mensagem. O Nexo passa a responder
            com consciência do que já foi dito e do que realmente chegou ao contato.
          </p>
          <div className="feature-row" style={{ marginTop: "1rem" }}>
            <Users size={18} />
            <div><strong>Humano continua no controle</strong><p>O rascunho pode ser editado e só vira memória depois da confirmação de envio.</p></div>
          </div>
          <div className="inline-actions" style={{ marginTop: "1rem" }}>
            <Link className="button button-primary" href="/app/responder"><MessageSquareText size={16} /> Abrir conversas <ArrowRight size={16} /></Link>
          </div>
        </article>
      </section>
    </>
  );
}
