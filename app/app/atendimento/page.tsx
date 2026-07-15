import Link from "next/link";
import { ArrowRight, CheckCircle2, FileClock, ListTodo, MessageSquareText, Stethoscope } from "lucide-react";
import { StatusPill } from "@/components/ui/status-pill";
import { requireAttendanceWorkspace } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AttendanceWorkspacePage() {
  const { user, activeMembership } = await requireAttendanceWorkspace();
  const supabase = await createClient();
  const clinicId = activeMembership.clinic_id;

  const [
    { count: taskCount },
    { count: conversationCount },
    { count: documentCount },
    { count: returnedReferralCount },
  ] = await Promise.all([
    supabase.from("operational_tasks").select("id", { count: "exact", head: true }).eq("clinic_id", clinicId).eq("assigned_to", user.id).in("status", ["open", "in_progress"]),
    supabase.from("sales_conversations").select("id", { count: "exact", head: true }).eq("clinic_id", clinicId).eq("assigned_to", user.id).eq("status", "open"),
    supabase.from("patient_documents").select("id", { count: "exact", head: true }).eq("clinic_id", clinicId).eq("assigned_to", user.id).in("status", ["created", "awaiting_signature", "ready_to_send"]),
    supabase.from("medical_referrals").select("id", { count: "exact", head: true }).eq("clinic_id", clinicId).eq("assigned_back_to", user.id).eq("status", "returned"),
  ]);

  return (
    <>
      <header className="page-header">
        <div className="page-heading">
          <span className="eyebrow">Ambiente de Atendimento</span>
          <h1>Entre e veja o próximo movimento.</h1>
          <p>Conversas, tarefas, documentos e retornos médicos reunidos sem configurações administrativas no caminho.</p>
        </div>
        <StatusPill tone="success"><CheckCircle2 size={13} /> Atendimento</StatusPill>
      </header>

      <section className="grid-3">
        <article className="stat-card">
          <div className="stat-card-header"><span>Minhas tarefas</span><ListTodo size={17} /></div>
          <strong>{taskCount ?? 0}</strong>
          <p>Itens abertos ou em andamento atribuídos a você.</p>
        </article>
        <article className="stat-card">
          <div className="stat-card-header"><span>Conversas abertas</span><MessageSquareText size={17} /></div>
          <strong>{conversationCount ?? 0}</strong>
          <p>Conversas sob sua responsabilidade que ainda estão abertas.</p>
        </article>
        <article className="stat-card">
          <div className="stat-card-header"><span>Retornos médicos</span><Stethoscope size={17} /></div>
          <strong>{returnedReferralCount ?? 0}</strong>
          <p>Encaminhamentos devolvidos com orientação para continuar o fluxo.</p>
        </article>
      </section>

      <section className="workspace-dashboard-grid" style={{ marginTop: "1rem" }}>
        <article className="card workspace-action-card">
          <ListTodo size={22} />
          <h2>Fila de hoje</h2>
          <p className="card-description">Priorize tarefas próprias, atrasadas e pendências detectadas pelo radar.</p>
          <Link className="button button-primary" href="/app/fila">Abrir minha fila <ArrowRight size={16} /></Link>
        </article>
        <article className="card workspace-action-card">
          <MessageSquareText size={22} />
          <h2>Conversas</h2>
          <p className="card-description">Continue atendimentos com memória comercial e assistência SPIN.</p>
          <Link className="button button-secondary" href="/app/responder">Abrir conversas</Link>
        </article>
        <article className="card workspace-action-card">
          <FileClock size={22} />
          <h2>Documentos pendentes</h2>
          <p className="card-description">Você possui {documentCount ?? 0} documento(s) atribuídos aguardando avanço.</p>
          <Link className="button button-secondary" href="/app/documentos">Abrir documentos</Link>
        </article>
        <article className="card workspace-action-card">
          <Stethoscope size={22} />
          <h2>Encaminhamentos</h2>
          <p className="card-description">Envie uma pendência ao médico ou consulte uma orientação devolvida.</p>
          <Link className="button button-secondary" href="/app/encaminhamentos">Abrir encaminhamentos</Link>
        </article>
      </section>
    </>
  );
}
