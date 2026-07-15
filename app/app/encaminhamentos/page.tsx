import type { Metadata } from "next";
import { CheckCircle2, Stethoscope } from "lucide-react";
import { ReferralWorkspace } from "@/components/referrals/referral-workspace";
import { StatusPill } from "@/components/ui/status-pill";
import { requireMembership } from "@/lib/auth";
import type { MedicalReferral, MedicalReferralEvent, MedicalReferralListItem } from "@/lib/referrals/types";
import { createClient } from "@/lib/supabase/server";
import type { Patient, PatientDocument, SalesConversation } from "@/lib/types";
import type { ClinicOperationalRole } from "@/lib/workspaces/types";

export const metadata: Metadata = { title: "Encaminhamentos médicos" };
export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<{ referral?: string }> };
type MemberRow = {
  user_id: string;
  operational_role: ClinicOperationalRole;
  professional_id: string | null;
  profile: { display_name: string | null; email: string } | null;
  professional: { name: string } | null;
};

export default async function ReferralsPage({ searchParams }: PageProps) {
  const { user, activeMembership } = await requireMembership();
  const supabase = await createClient();
  const params = await searchParams;
  const clinicId = activeMembership.clinic_id;

  const [
    { data: referralRows },
    { data: patientRows },
    { data: documentRows },
    { data: conversationRows },
    { data: memberRows },
  ] = await Promise.all([
    supabase.from("medical_referrals").select("*").eq("clinic_id", clinicId).order("updated_at", { ascending: false }).limit(250),
    supabase.from("patients").select("*").eq("clinic_id", clinicId).order("last_activity_at", { ascending: false }).limit(250),
    supabase.from("patient_documents").select("*").eq("clinic_id", clinicId).order("updated_at", { ascending: false }).limit(250),
    supabase.from("sales_conversations").select("*").eq("clinic_id", clinicId).order("last_message_at", { ascending: false }).limit(250),
    supabase
      .from("clinic_members")
      .select("user_id, operational_role, professional_id, profile:profiles!clinic_members_user_id_fkey(display_name, email), professional:professionals(name)")
      .eq("clinic_id", clinicId)
      .eq("status", "active")
      .order("created_at"),
  ]);

  const patients = (patientRows ?? []) as Patient[];
  const documents = (documentRows ?? []) as PatientDocument[];
  const conversations = (conversationRows ?? []) as SalesConversation[];
  const members = (memberRows ?? []) as unknown as MemberRow[];
  const doctors = members
    .filter((member) => member.operational_role === "doctor")
    .map((member) => ({
      user_id: member.user_id,
      name: member.professional?.name || member.profile?.display_name || member.profile?.email || "Médico",
      professional_id: member.professional_id,
    }));

  const patientLabels = new Map(patients.map((patient) => [patient.id, patient.reference_label]));
  const documentTitles = new Map(documents.map((document) => [document.id, document.title]));
  const conversationLabels = new Map(conversations.map((conversation) => [conversation.id, conversation.contact_label]));
  const memberNames = new Map(members.map((member) => [member.user_id, member.profile?.display_name || member.profile?.email || "Membro da equipe"]));
  doctors.forEach((doctor) => memberNames.set(doctor.user_id, doctor.name));

  const referrals: MedicalReferralListItem[] = ((referralRows ?? []) as MedicalReferral[]).map((referral) => ({
    ...referral,
    patient_label: patientLabels.get(referral.patient_id) ?? "Paciente removido",
    document_title: referral.document_id ? documentTitles.get(referral.document_id) ?? null : null,
    conversation_label: referral.conversation_id ? conversationLabels.get(referral.conversation_id) ?? null : null,
    requester_name: memberNames.get(referral.requested_by) ?? "Solicitante",
    doctor_name: memberNames.get(referral.doctor_user_id) ?? "Médico",
    assigned_back_name: referral.assigned_back_to ? memberNames.get(referral.assigned_back_to) ?? null : null,
  }));

  const activeReferral = referrals.find((referral) => referral.id === params.referral)
    ?? referrals.find((referral) => referral.doctor_user_id === user.id && ["pending", "in_review"].includes(referral.status))
    ?? referrals[0]
    ?? null;
  let events: MedicalReferralEvent[] = [];

  if (activeReferral) {
    const { data: eventRows } = await supabase
      .from("medical_referral_events")
      .select("*")
      .eq("clinic_id", clinicId)
      .eq("referral_id", activeReferral.id)
      .order("created_at", { ascending: false })
      .limit(160);

    events = (eventRows ?? []).map((event) => ({
      ...(event as Omit<MedicalReferralEvent, "author_name">),
      author_name: memberNames.get(event.created_by) ?? null,
    }));
  }

  return (
    <>
      <header className="page-header referral-page-header">
        <div className="page-heading">
          <span className="eyebrow">Atendimento e médico no mesmo fluxo</span>
          <h1>Encaminhamentos médicos</h1>
          <p>Envie pendências para revisão, registre a resposta humana e devolva o próximo passo à pessoa certa.</p>
        </div>
        <StatusPill tone="success"><CheckCircle2 size={13} /> Iteração 9 ativa</StatusPill>
      </header>

      <div className="permission-note spin-page-note">
        <Stethoscope size={18} /> Aprovação operacional é apenas um estado interno. Não representa validação clínica, jurídica ou regulatória.
      </div>

      <ReferralWorkspace
        key={`${activeReferral?.id ?? "none"}:${events[0]?.id ?? "empty"}`}
        role={activeMembership.role}
        operationalRole={activeMembership.operational_role}
        currentUserId={user.id}
        referrals={referrals}
        activeReferral={activeReferral}
        events={events}
        doctors={doctors}
        patients={patients}
        documents={documents}
        conversations={conversations}
      />
    </>
  );
}
