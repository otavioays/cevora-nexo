import Link from "next/link";
import { ArrowRight, FileLock2, ListTodo, MessageSquareText, Stethoscope, UserRound } from "lucide-react";
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

  const returned = returnedReferralCount ?? 0;
  const tasks = taskCount ?? 0;
  const conversations = conversationCount ?? 0;

  const focus = returned > 0
    ? {
        label: "Retorno médico",
        title: `${returned} encaminhamento(s) voltou(aram) para você`,
        description: "Leia a orientação e continue o atendimento.",
        href: "/app/encaminhamentos?workspace=attendance",
        action: "Ver retornos",
        icon: Stethoscope,
      }
    : tasks > 0
      ? {
          label: "Minha fila",
          title: `${tasks} tarefa(s) precisa(m) de atenção`,
          description: "Comece pelas atrasadas e urgentes.",
          href: "/app/fila?workspace=attendance",
          action: "Abrir fila",
          icon: ListTodo,
        }
      : conversations > 0
        ? {
            label: "Conversas",
            title: `${conversations} conversa(s) ainda está(ão) aberta(s)`,
            description: "Retome o próximo atendimento da lista.",
            href: "/app/responder?workspace=attendance",
            action: "Abrir conversas",
            icon: MessageSquareText,
          }
        : {
            label: "Tudo em ordem",
            title: "Nenhuma pendência principal agora",
            description: "A fila está limpa. Você pode revisar conversas ou pacientes.",
            href: "/app/responder?workspace=attendance",
            action: "Ver conversas",
            icon: MessageSquareText,
          };

  const FocusIcon = focus.icon;

  return (
    <>
      <header className="page-header workspace-page-header">
        <div className="page-heading">
          <h1>Hoje</h1>
          <p>O que precisa da sua atenção agora.</p>
        </div>
      </header>

      <section className="workspace-metrics" aria-label="Resumo do atendimento">
        <article className="stat-card">
          <div className="stat-card-header"><span>Tarefas</span><ListTodo size={17} /></div>
          <strong>{tasks}</strong>
        </article>
        <article className="stat-card">
          <div className="stat-card-header"><span>Conversas</span><MessageSquareText size={17} /></div>
          <strong>{conversations}</strong>
        </article>
        <article className="stat-card">
          <div className="stat-card-header"><span>Retornos médicos</span><Stethoscope size={17} /></div>
          <strong>{returned}</strong>
        </article>
      </section>

      <section className="workspace-home-grid">
        <article className="card workspace-focus-card">
          <div className="workspace-focus-icon"><FocusIcon size={22} /></div>
          <div>
            <span className="workspace-kicker">{focus.label}</span>
            <h2>{focus.title}</h2>
            <p className="card-description">{focus.description}</p>
          </div>
          <Link className="button button-primary" href={focus.href}>{focus.action} <ArrowRight size={16} /></Link>
        </article>

        <aside className="card workspace-shortcuts">
          <h2>Acessos rápidos</h2>
          <nav aria-label="Acessos rápidos do atendimento">
            <Link href="/app/pacientes?workspace=attendance"><UserRound size={17} /><span>Pacientes</span></Link>
            <Link href="/app/documentos?workspace=attendance"><FileLock2 size={17} /><span>Documentos</span><small>{documentCount ?? 0}</small></Link>
            <Link href="/app/encaminhamentos?workspace=attendance"><Stethoscope size={17} /><span>Encaminhamentos</span></Link>
          </nav>
        </aside>
      </section>
    </>
  );
}
