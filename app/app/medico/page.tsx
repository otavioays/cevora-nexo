import Link from "next/link";
import { ArrowRight, CheckCircle2, FileLock2, Stethoscope, UserRound } from "lucide-react";
import { StatusPill } from "@/components/ui/status-pill";
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

  return (
    <>
      <header className="page-header">
        <div className="page-heading">
          <span className="eyebrow">Ambiente Médico</span>
          <h1>Somente o que precisa da sua decisão.</h1>
          <p>Encaminhamentos, documentos relacionados e devoluções para a equipe sem ruído comercial ou administrativo.</p>
        </div>
        <StatusPill tone="gold"><Stethoscope size={13} /> Médico</StatusPill>
      </header>

      <section className="grid-3">
        <article className="stat-card">
          <div className="stat-card-header"><span>Aguardando revisão</span><Stethoscope size={17} /></div>
          <strong>{pendingCount ?? 0}</strong>
          <p>Encaminhamentos novos atribuídos ao seu acesso médico.</p>
        </article>
        <article className="stat-card">
          <div className="stat-card-header"><span>Em revisão</span><UserRound size={17} /></div>
          <strong>{reviewCount ?? 0}</strong>
          <p>Itens que você já assumiu e ainda precisam de uma devolução.</p>
        </article>
        <article className="stat-card">
          <div className="stat-card-header"><span>Concluídos</span><CheckCircle2 size={17} /></div>
          <strong>{completedCount ?? 0}</strong>
          <p>Aprovações operacionais ou assinaturas registradas no fluxo.</p>
        </article>
      </section>

      <section className="workspace-dashboard-grid" style={{ marginTop: "1rem" }}>
        <article className="card workspace-action-card">
          <Stethoscope size={22} />
          <h2>Pendências médicas</h2>
          <p className="card-description">Abra a solicitação, consulte o contexto e devolva uma orientação clara à equipe.</p>
          <Link className="button button-primary" href="/app/encaminhamentos">Abrir encaminhamentos <ArrowRight size={16} /></Link>
        </article>
        <article className="card workspace-action-card">
          <FileLock2 size={22} />
          <h2>Documentos relacionados</h2>
          <p className="card-description">Há {documentCount ?? 0} documento(s) em assinatura ou preparação para envio na clínica.</p>
          <Link className="button button-secondary" href="/app/documentos">Abrir documentos</Link>
        </article>
        <article className="card workspace-action-card">
          <UserRound size={22} />
          <h2>Pacientes encaminhados</h2>
          <p className="card-description">Consulte a linha do tempo operacional vinculada às solicitações recebidas.</p>
          <Link className="button button-secondary" href="/app/pacientes">Abrir pacientes</Link>
        </article>
      </section>

      <div className="permission-note" style={{ marginTop: "1rem" }}>
        <CheckCircle2 size={18} /> “Aprovado operacionalmente” registra uma decisão interna e não substitui validação clínica, assinatura digital ou conformidade legal.
      </div>
    </>
  );
}
