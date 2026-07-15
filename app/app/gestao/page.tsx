import Link from "next/link";
import { ArrowRight, CheckCircle2, FileLock2, ListTodo, MessageSquareText, Settings, Stethoscope, Users } from "lucide-react";
import { StatusPill } from "@/components/ui/status-pill";
import { requireManagement } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ManagementWorkspacePage() {
  const { activeMembership } = await requireManagement();
  const supabase = await createClient();
  const clinicId = activeMembership.clinic_id;

  const [
    { count: activeTaskCount },
    { count: conversationCount },
    { count: documentCount },
    { count: referralCount },
  ] = await Promise.all([
    supabase.from("operational_tasks").select("id", { count: "exact", head: true }).eq("clinic_id", clinicId).in("status", ["open", "in_progress"]),
    supabase.from("sales_conversations").select("id", { count: "exact", head: true }).eq("clinic_id", clinicId).eq("status", "open"),
    supabase.from("patient_documents").select("id", { count: "exact", head: true }).eq("clinic_id", clinicId).in("status", ["created", "awaiting_signature", "ready_to_send"]),
    supabase.from("medical_referrals").select("id", { count: "exact", head: true }).eq("clinic_id", clinicId).in("status", ["pending", "in_review", "returned"]),
  ]);

  return (
    <>
      <header className="page-header">
        <div className="page-heading">
          <span className="eyebrow">Ambiente de Gestão</span>
          <h1>A clínica inteira sem invadir a mesa de cada pessoa.</h1>
          <p>Acompanhe execução, equipe e configurações enquanto atendimento e médico trabalham em ambientes próprios.</p>
        </div>
        <StatusPill tone="success"><CheckCircle2 size={13} /> Gestão</StatusPill>
      </header>

      <section className="grid-3">
        <article className="stat-card">
          <div className="stat-card-header"><span>Tarefas ativas</span><ListTodo size={17} /></div>
          <strong>{activeTaskCount ?? 0}</strong>
          <p>Itens abertos ou em andamento em toda a clínica.</p>
        </article>
        <article className="stat-card">
          <div className="stat-card-header"><span>Conversas abertas</span><MessageSquareText size={17} /></div>
          <strong>{conversationCount ?? 0}</strong>
          <p>Atendimentos comerciais que ainda não tiveram desfecho.</p>
        </article>
        <article className="stat-card">
          <div className="stat-card-header"><span>Encaminhamentos ativos</span><Stethoscope size={17} /></div>
          <strong>{referralCount ?? 0}</strong>
          <p>Solicitações pendentes, em revisão ou devolvidas para a equipe.</p>
        </article>
      </section>

      <section className="workspace-dashboard-grid" style={{ marginTop: "1rem" }}>
        <article className="card workspace-action-card">
          <ListTodo size={22} />
          <h2>Operação</h2>
          <p className="card-description">Acompanhe responsáveis, prazos e gargalos de conversas ou documentos.</p>
          <Link className="button button-primary" href="/app/fila">Abrir fila <ArrowRight size={16} /></Link>
        </article>
        <article className="card workspace-action-card">
          <Stethoscope size={22} />
          <h2>Fluxo médico</h2>
          <p className="card-description">Monitore encaminhamentos e reatribua o médico responsável quando necessário.</p>
          <Link className="button button-secondary" href="/app/encaminhamentos">Abrir encaminhamentos</Link>
        </article>
        <article className="card workspace-action-card">
          <Users size={22} />
          <h2>Equipe e funções</h2>
          <p className="card-description">Defina quem trabalha em Atendimento, Médico ou Administrativo.</p>
          <Link className="button button-secondary" href="/app/equipe">Configurar equipe</Link>
        </article>
        <article className="card workspace-action-card">
          <FileLock2 size={22} />
          <h2>Documentos</h2>
          <p className="card-description">Há {documentCount ?? 0} documento(s) ainda em criação, assinatura ou preparação para envio.</p>
          <Link className="button button-secondary" href="/app/documentos">Abrir documentos</Link>
        </article>
        <article className="card workspace-action-card">
          <Settings size={22} />
          <h2>Configurações</h2>
          <p className="card-description">Regras da IA, perfil comercial, procedimentos e controles administrativos.</p>
          <Link className="button button-secondary" href="/app/configuracoes">Abrir configurações</Link>
        </article>
      </section>
    </>
  );
}
