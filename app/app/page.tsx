import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCircle2, FileLock2, ListTodo, MessageSquareText, Radar } from "lucide-react";
import { StatusPill } from "@/components/ui/status-pill";
import { requireMembership } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ROLE_LABELS } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { activeMembership } = await requireMembership();
  const supabase = await createClient();
  const now = new Date().toISOString();
  const staleThreshold = new Date(Date.now() - 24 * 3_600_000).toISOString();

  const [
    { count: activeTaskCount },
    { count: overdueTaskCount },
    { count: staleConversationCount },
    { count: staleDocumentCount },
  ] = await Promise.all([
    supabase
      .from("operational_tasks")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", activeMembership.clinic_id)
      .in("status", ["open", "in_progress"]),
    supabase
      .from("operational_tasks")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", activeMembership.clinic_id)
      .in("status", ["open", "in_progress"])
      .lt("due_at", now),
    supabase
      .from("sales_conversations")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", activeMembership.clinic_id)
      .eq("status", "open")
      .lt("last_message_at", staleThreshold),
    supabase
      .from("patient_documents")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", activeMembership.clinic_id)
      .in("status", ["created", "awaiting_signature", "ready_to_send"])
      .lt("updated_at", staleThreshold),
  ]);

  const alertCount = (staleConversationCount ?? 0) + (staleDocumentCount ?? 0);

  return (
    <>
      <header className="page-header">
        <div className="page-heading">
          <span className="eyebrow">A operação sabe o próximo movimento</span>
          <h1>Menos pendência invisível. Mais execução.</h1>
          <p>
            O Nexo reúne tarefas, responsáveis, prazos e um radar de conversas ou documentos que ficaram sem avanço.
          </p>
        </div>
        <StatusPill tone="success"><CheckCircle2 size={13} /> Iteração 8 ativa</StatusPill>
      </header>

      <section className="grid-3">
        <article className="stat-card">
          <div className="stat-card-header"><span>Tarefas ativas</span><ListTodo size={17} /></div>
          <strong>{activeTaskCount ?? 0}</strong>
          <p>Itens abertos ou em andamento na fila operacional.</p>
        </article>
        <article className="stat-card">
          <div className="stat-card-header"><span>Tarefas atrasadas</span><AlertTriangle size={17} /></div>
          <strong>{overdueTaskCount ?? 0}</strong>
          <p>Prazos vencidos que ainda precisam de conclusão ou reagendamento.</p>
        </article>
        <article className="stat-card">
          <div className="stat-card-header"><span>Alertas do radar</span><Radar size={17} /></div>
          <strong>{alertCount}</strong>
          <p>Conversas e documentos sem movimento há mais de 24 horas.</p>
        </article>
      </section>

      <section className="grid-2" style={{ marginTop: "1rem" }}>
        <article className="card">
          <h2>O que mudou na Iteração 8</h2>
          <div className="section-stack">
            <div className="check-row"><ListTodo size={17} /><div><strong>Fila com dono e prazo</strong><p>Cada tarefa possui responsável, prioridade, vencimento e estado explícito.</p></div></div>
            <div className="check-row"><Radar size={17} /><div><strong>Gargalos visíveis</strong><p>Conversas abertas e documentos pendentes aparecem quando ficam mais de 24 horas sem avanço.</p></div></div>
            <div className="check-row"><CheckCircle2 size={17} /><div><strong>Histórico auditável</strong><p>Criação, edição, mudança de status e notas deixam um rastro interno.</p></div></div>
          </div>
        </article>

        <article className="card">
          <h2>Abra a fila operacional</h2>
          <p className="card-description">
            Veja o que está atrasado, assuma alertas do radar e conclua tarefas sem perder o vínculo com paciente, conversa ou documento.
          </p>
          <div className="feature-row" style={{ marginTop: "1rem" }}>
            <Radar size={18} />
            <div><strong>O radar sugere, a equipe decide</strong><p>Nenhuma tarefa é criada automaticamente. Um alerta só entra na fila depois de uma ação humana.</p></div>
          </div>
          <div className="inline-actions" style={{ marginTop: "1rem" }}>
            <Link className="button button-primary" href="/app/fila"><ListTodo size={16} /> Abrir fila <ArrowRight size={16} /></Link>
            <Link className="button button-secondary" href="/app/responder"><MessageSquareText size={16} /> Conversas</Link>
            <Link className="button button-secondary" href="/app/documentos"><FileLock2 size={16} /> Documentos</Link>
          </div>
          <small className="field-help" style={{ display: "block", marginTop: "1rem" }}>Seu papel atual: {ROLE_LABELS[activeMembership.role]}.</small>
        </article>
      </section>
    </>
  );
}
