import type { Metadata } from "next";
import { CheckCircle2, ShieldCheck, UserRound } from "lucide-react";
import { PatientWorkspace } from "@/components/patients/patient-workspace";
import { StatusPill } from "@/components/ui/status-pill";
import { requireMembership } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type {
  ClinicRole,
  Patient,
  PatientAssignee,
  PatientListItem,
  PatientProcedureInterest,
  PatientTimelineEvent,
  Procedure,
  SalesConversation,
  SalesConversationListItem,
} from "@/lib/types";

export const metadata: Metadata = { title: "Pacientes" };
export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ patient?: string }>;
};

type MemberRow = {
  user_id: string;
  role: ClinicRole;
  profile: { display_name: string | null; email: string } | null;
};

export default async function PatientsPage({ searchParams }: PageProps) {
  const { activeMembership } = await requireMembership();
  const supabase = await createClient();
  const params = await searchParams;
  const clinicId = activeMembership.clinic_id;

  const [
    { data: patientRows },
    { data: procedureRows },
    { data: memberRows },
    { data: interestCountRows },
    { data: conversationRows },
  ] = await Promise.all([
    supabase.from("patients").select("*").eq("clinic_id", clinicId).order("last_activity_at", { ascending: false }).limit(100),
    supabase.from("procedures").select("*").eq("clinic_id", clinicId).eq("active", true).order("sort_order").order("name"),
    supabase
      .from("clinic_members")
      .select("user_id, role, profile:profiles!clinic_members_user_id_fkey(display_name, email)")
      .eq("clinic_id", clinicId)
      .eq("status", "active")
      .order("created_at"),
    supabase.from("patient_procedure_interests").select("patient_id").eq("clinic_id", clinicId),
    supabase.from("sales_conversations").select("*").eq("clinic_id", clinicId).order("last_message_at", { ascending: false }).limit(160),
  ]);

  const procedures = (procedureRows ?? []) as Procedure[];
  const procedureNames = new Map(procedures.map((procedure) => [procedure.id, procedure.name]));
  const rawMembers = (memberRows ?? []) as unknown as MemberRow[];
  const assignees: PatientAssignee[] = rawMembers.map((member) => ({
    id: member.user_id,
    role: member.role,
    name: member.profile?.display_name || member.profile?.email || "Membro da equipe",
  }));
  const assigneeNames = new Map(assignees.map((assignee) => [assignee.id, assignee.name]));

  const interestCounts = new Map<string, number>();
  for (const row of interestCountRows ?? []) {
    interestCounts.set(row.patient_id, (interestCounts.get(row.patient_id) ?? 0) + 1);
  }

  const rawConversations = (conversationRows ?? []) as SalesConversation[];
  const conversationCounts = new Map<string, number>();
  for (const conversation of rawConversations) {
    if (conversation.patient_id) {
      conversationCounts.set(conversation.patient_id, (conversationCounts.get(conversation.patient_id) ?? 0) + 1);
    }
  }

  const rawPatients = (patientRows ?? []) as Patient[];
  const patients: PatientListItem[] = rawPatients.map((patient) => ({
    ...patient,
    assigned_name: patient.assigned_to ? assigneeNames.get(patient.assigned_to) ?? null : null,
    procedure_count: interestCounts.get(patient.id) ?? 0,
    conversation_count: conversationCounts.get(patient.id) ?? 0,
  }));

  const requestedPatient = params.patient;
  const activePatient = patients.find((patient) => patient.id === requestedPatient) ?? patients[0] ?? null;

  let interests: PatientProcedureInterest[] = [];
  let timeline: PatientTimelineEvent[] = [];

  if (activePatient) {
    const [{ data: interestRows }, { data: eventRows }] = await Promise.all([
      supabase
        .from("patient_procedure_interests")
        .select("*")
        .eq("clinic_id", clinicId)
        .eq("patient_id", activePatient.id)
        .order("updated_at", { ascending: false }),
      supabase
        .from("patient_timeline_events")
        .select("*")
        .eq("clinic_id", clinicId)
        .eq("patient_id", activePatient.id)
        .order("created_at", { ascending: false })
        .limit(120),
    ]);

    interests = (interestRows ?? []).map((interest) => ({
      ...(interest as Omit<PatientProcedureInterest, "procedure_name">),
      procedure_name: procedureNames.get(interest.procedure_id) ?? "Procedimento removido",
    }));

    timeline = (eventRows ?? []).map((event) => ({
      ...(event as Omit<PatientTimelineEvent, "author_name">),
      author_name: assigneeNames.get(event.created_by) ?? null,
    }));
  }

  const patientLabels = new Map(patients.map((patient) => [patient.id, patient.reference_label]));
  const conversations: SalesConversationListItem[] = rawConversations.map((conversation) => ({
    ...conversation,
    procedure_name: conversation.procedure_id ? procedureNames.get(conversation.procedure_id) ?? null : null,
    patient_label: conversation.patient_id ? patientLabels.get(conversation.patient_id) ?? null : null,
  }));

  const workspaceKey = `${activePatient?.id ?? "none"}:${timeline[0]?.id ?? "empty"}`;

  return (
    <>
      <header className="page-header patient-page-header">
        <div className="page-heading">
          <span className="eyebrow">Memória por pessoa</span>
          <h1>Pacientes e leads</h1>
          <p>
            Reúna conversas, procedimentos de interesse, responsável, notas e mudanças de estágio em uma linha do tempo única.
          </p>
        </div>
        <StatusPill tone="success"><CheckCircle2 size={13} /> Iteração 5 ativa</StatusPill>
      </header>

      <div className="permission-note spin-page-note">
        <UserRound size={18} /> Use uma referência interna. O identificador do cadastro nunca é enviado ao provedor de IA.
      </div>
      <div className="permission-note spin-page-note">
        <ShieldCheck size={18} /> Nesta etapa, o cadastro é comercial. Não registre prontuário, diagnóstico, documentos ou dados clínicos sensíveis.
      </div>

      <PatientWorkspace
        key={workspaceKey}
        patients={patients}
        activePatient={activePatient}
        procedures={procedures}
        assignees={assignees}
        interests={interests}
        timeline={timeline}
        conversations={conversations}
      />
    </>
  );
}
