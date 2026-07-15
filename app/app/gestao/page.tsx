import Link from "next/link";
import { ArrowRight, FileLock2, ListTodo, MessageSquareText, Stethoscope, UserRound } from "lucide-react";
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

  const tasks = activeTaskCount ?? 0;
  const conversations = conversationCount ?? 0;
  const referrals = referralCount ?? 0;

  const focus = tasks > 0
    ? {
        label: "Operação",
        title: `${tasks} tarefa(s) está(ão) ativa(s) na clínica`,
        description: "Veja responsáveis, prioridades e prazos em um só lugar.",
        href: "/app/fila?workspace=management",
        action: "Abrir operação",
        icon: ListTodo,
      }
    : referrals > 0
      ? {
          label: "Fluxo médico",
          title: `${referrals} encaminhamento(s) precisa(m) de acompanhamento`,
          description: "Acompanhe pendências, revisões e devoluções.",
          href: "/app/encaminhamentos?workspace=management",
          action: "Abrir fluxo médico",
          icon: Stethoscope,
        }
      : {
          label: "Operação em dia",
          title: "Nenhuma pendência principal agora",
          description: "Use os acessos rápidos para revisar áreas específicas.",
          href: "/app/fila?workspace=management",
          action: "Ver operação",
          icon: ListTodo,
        };

  const FocusIcon = focus.icon;

  return (
    <>
      <header className="page-header workspace-page-header">
        <div className="page-heading">
          <h1>Visão geral</h1>
          <p>O estado da operação sem abrir todas as áreas.</p>
        </div>
      </header>

      <section className="workspace-metrics" aria-label="Resumo da gestão">
        <article className="stat-card">
          <div className="stat-card-header"><span>Tarefas ativas</span><ListTodo size={17} /></div>
          <strong>{tasks}</strong>
        </article>
        <article className="stat-card">
          <div className="stat-card-header"><span>Conversas abertas</span><MessageSquareText size={17} /></div>
          <strong>{conversations}</strong>
        </article>
        <article className="stat-card">
          <div className="stat-card-header"><span>Fluxo médico</span><Stethoscope size={17} /></div>
          <strong>{referrals}</strong>
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
          <nav aria-label="Acessos rápidos da gestão">
            <Link href="/app/responder?workspace=management"><MessageSquareText size={17} /><span>Conversas</span></Link>
            <Link href="/app/pacientes?workspace=management"><UserRound size={17} /><span>Pacientes</span></Link>
            <Link href="/app/documentos?workspace=management"><FileLock2 size={17} /><span>Documentos</span><small>{documentCount ?? 0}</small></Link>
            <Link href="/app/encaminhamentos?workspace=management"><Stethoscope size={17} /><span>Fluxo médico</span></Link>
          </nav>
        </aside>
      </section>
    </>
  );
}
