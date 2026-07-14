import Link from "next/link";
import { ArrowRight, BrainCircuit, Building2, CheckCircle2, MessageSquareText, ShieldCheck, Users } from "lucide-react";
import { StatusPill } from "@/components/ui/status-pill";
import { requireMembership } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ROLE_LABELS } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { activeMembership } = await requireMembership();
  const supabase = await createClient();

  const [{ count: memberCount }, { count: pendingInvitationCount }, { count: analysisCount }] = await Promise.all([
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
      .from("spin_interactions")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", activeMembership.clinic_id)
      .eq("status", "completed"),
  ]);

  return (
    <>
      <header className="page-header">
        <div className="page-heading">
          <span className="eyebrow">Inteligência comercial aplicada</span>
          <h1>O Nexo já escolhe o próximo movimento.</h1>
          <p>
            A atendente envia uma mensagem, o sistema consulta a memória da clínica, diagnostica a conversa,
            decide a estratégia SPIN e entrega uma resposta pronta para revisão e envio.
          </p>
        </div>
        <StatusPill tone="success"><CheckCircle2 size={13} /> Iteração 3 ativa</StatusPill>
      </header>

      <section className="grid-3">
        <article className="stat-card">
          <div className="stat-card-header"><span>Clínica</span><Building2 size={17} /></div>
          <strong>{activeMembership.clinic.name}</strong>
          <p>Ambiente isolado e identificado por <code>{activeMembership.clinic.slug}</code>.</p>
        </article>
        <article className="stat-card">
          <div className="stat-card-header"><span>Análises concluídas</span><BrainCircuit size={17} /></div>
          <strong>{analysisCount ?? 0}</strong>
          <p>Diagnósticos, planos e respostas registrados para esta clínica.</p>
        </article>
        <article className="stat-card">
          <div className="stat-card-header"><span>Seu papel</span><ShieldCheck size={17} /></div>
          <strong>{ROLE_LABELS[activeMembership.role]}</strong>
          <p>{memberCount ?? 0} membro(s) ativo(s) e {pendingInvitationCount ?? 0} convite(s) pendente(s).</p>
        </article>
      </section>

      <section className="grid-2" style={{ marginTop: "1rem" }}>
        <article className="card">
          <h2>O que acontece em cada análise</h2>
          <div className="section-stack">
            <div className="check-row"><CheckCircle2 size={17} /><div><strong>Diagnóstico antes da escrita</strong><p>Intenção, necessidade, objeções, emoção, estágio e informações ausentes.</p></div></div>
            <div className="check-row"><CheckCircle2 size={17} /><div><strong>Planejamento SPIN</strong><p>Um único objetivo é escolhido antes de qualquer frase ser gerada.</p></div></div>
            <div className="check-row"><CheckCircle2 size={17} /><div><strong>Resposta validada</strong><p>Regras da clínica, preço, promessas e palavras proibidas passam por verificação.</p></div></div>
          </div>
        </article>

        <article className="card">
          <h2>Teste uma interação real</h2>
          <p className="card-description">
            Cole uma mensagem de paciente exatamente como ela chegou. O Nexo entregará a resposta principal,
            uma alternativa e a explicação estratégica para a atendente.
          </p>
          <div className="feature-row" style={{ marginTop: "1rem" }}>
            <MessageSquareText size={18} />
            <div><strong>Humano no controle</strong><p>A IA recomenda. A atendente revisa, copia e envia.</p></div>
          </div>
          <div className="inline-actions" style={{ marginTop: "1rem" }}>
            <Link className="button button-primary" href="/app/responder"><MessageSquareText size={16} /> Gerar resposta <ArrowRight size={16} /></Link>
          </div>
        </article>
      </section>
    </>
  );
}
