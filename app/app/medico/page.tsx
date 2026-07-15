import Link from "next/link";
import { ArrowRight, CheckCircle2, FileLock2, Stethoscope } from "lucide-react";
import { requireMedicalWorkspace } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function MedicalWorkspacePage() {
  const { user, activeMembership } = await requireMedicalWorkspace();
  const supabase = await createClient();
  const clinicId = activeMembership.clinic_id;

  const [
    { count: pendingCount },
    { count: reviewCount },
    { count: completedCount },
    { count: documentCount },
  ] = await Promise.all([
    supabase.from("medical_referrals").select("id", { count: "exact", head: true }).eq("clinic_id", clinicId).eq("doctor_user_id", user.id).eq("status", "pending"),
    supabase.from("medical_referrals").select("id", { count: "exact", head: true }).eq("clinic_id", clinicId).eq("doctor_user_id", user.id).eq("status", "in_review"),
    supabase.from("medical_referrals").select("id", { count: "exact", head: true }).eq("clinic_id", clinicId).eq("doctor_user_id", user.id).in("status", ["approved_operationally", "signed"]),
    supabase.from("patient_documents").select("id", { count: "exact", head: true }).eq("clinic_id", clinicId).in("status", ["awaiting_signature", "ready_to_send"]),
  ]);

  const pending = pendingCount ?? 0;
  const reviewing = reviewCount ?? 0;
  const completed = completedCount ?? 0;

  const focus = pending > 0
    ? {
        label: "Nova pendência",
        title: `${pending} encaminhamento(s) aguarda(m) sua revisão`,
        description: "Abra o próximo item e registre uma decisão humana.",
        action: "Revisar agora",
      }
    : reviewing > 0
      ? {
          label: "Em andamento",
          title: `${reviewing} encaminhamento(s) está(ão) em revisão`,
          description: "Conclua ou devolva a orientação para a equipe.",
          action: "Continuar revisão",
        }
      : {
          label: "Tudo em ordem",
          title: "Nenhuma pendência médica principal",
          description: "Novos encaminhamentos aparecerão aqui quando chegarem.",
          action: "Ver histórico",
        };

  return (
    <>
      <header className="page-header workspace-page-header">
        <div className="page-heading">
          <h1>Hoje</h1>
          <p>Somente o que precisa da sua decisão.</p>
        </div>
      </header>

      <section className="workspace-metrics" aria-label="Resumo médico">
        <article className="stat-card">
          <div className="stat-card-header"><span>Aguardando</span><Stethoscope size={17} /></div>
          <strong>{pending}</strong>
        </article>
        <article className="stat-card">
          <div className="stat-card-header"><span>Em revisão</span><Stethoscope size={17} /></div>
          <strong>{reviewing}</strong>
        </article>
        <article className="stat-card">
          <div className="stat-card-header"><span>Concluídos</span><CheckCircle2 size={17} /></div>
          <strong>{completed}</strong>
        </article>
      </section>

      <section className="workspace-home-grid">
        <article className="card workspace-focus-card">
          <div className="workspace-focus-icon"><Stethoscope size={22} /></div>
          <div>
            <span className="workspace-kicker">{focus.label}</span>
            <h2>{focus.title}</h2>
            <p className="card-description">{focus.description}</p>
          </div>
          <Link className="button button-primary" href="/app/encaminhamentos?workspace=medical">{focus.action} <ArrowRight size={16} /></Link>
        </article>

        <aside className="card workspace-shortcuts">
          <h2>Acessos rápidos</h2>
          <nav aria-label="Acessos rápidos do ambiente médico">
            <Link href="/app/encaminhamentos?workspace=medical"><Stethoscope size={17} /><span>Pendências</span></Link>
            <Link href="/app/documentos?workspace=medical"><FileLock2 size={17} /><span>Documentos</span><small>{documentCount ?? 0}</small></Link>
          </nav>
        </aside>
      </section>

      <p className="workspace-guardrail">Os estados do fluxo são registros operacionais e não substituem validação clínica, assinatura digital ou conformidade legal.</p>
    </>
  );
}
