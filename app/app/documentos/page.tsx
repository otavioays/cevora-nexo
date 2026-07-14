import type { Metadata } from "next";
import { CheckCircle2, FileLock2, ShieldCheck } from "lucide-react";
import { DocumentIntelligencePanel } from "@/components/documents/document-intelligence-panel";
import { DocumentWorkspace } from "@/components/documents/document-workspace";
import { StatusPill } from "@/components/ui/status-pill";
import { requireMembership } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { PatientDocumentAiAnalysis } from "@/lib/ai/document-intelligence-types";
import type {
  ClinicRole,
  Patient,
  PatientAssignee,
  PatientDocument,
  PatientDocumentEvent,
  PatientDocumentListItem,
  Procedure,
  Professional,
} from "@/lib/types";

export const metadata: Metadata = { title: "Documentos" };
export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ document?: string; patient?: string }>;
};

type MemberRow = {
  user_id: string;
  role: ClinicRole;
  profile: { display_name: string | null; email: string } | null;
};

export default async function DocumentsPage({ searchParams }: PageProps) {
  const { activeMembership } = await requireMembership();
  const supabase = await createClient();
  const params = await searchParams;
  const clinicId = activeMembership.clinic_id;

  const [
    { data: documentRows },
    { data: patientRows },
    { data: professionalRows },
    { data: procedureRows },
    { data: memberRows },
  ] = await Promise.all([
    supabase.from("patient_documents").select("*").eq("clinic_id", clinicId).order("updated_at", { ascending: false }).limit(150),
    supabase.from("patients").select("*").eq("clinic_id", clinicId).order("last_activity_at", { ascending: false }).limit(200),
    supabase.from("professionals").select("*").eq("clinic_id", clinicId).eq("active", true).order("name"),
    supabase.from("procedures").select("*").eq("clinic_id", clinicId).eq("active", true).order("sort_order").order("name"),
    supabase
      .from("clinic_members")
      .select("user_id, role, profile:profiles!clinic_members_user_id_fkey(display_name, email)")
      .eq("clinic_id", clinicId)
      .eq("status", "active")
      .order("created_at"),
  ]);

  const patients = (patientRows ?? []) as Patient[];
  const professionals = (professionalRows ?? []) as Professional[];
  const procedures = (procedureRows ?? []) as Procedure[];
  const members = (memberRows ?? []) as unknown as MemberRow[];
  const assignees: PatientAssignee[] = members.map((member) => ({
    id: member.user_id,
    role: member.role,
    name: member.profile?.display_name || member.profile?.email || "Membro da equipe",
  }));

  const patientLabels = new Map(patients.map((patient) => [patient.id, patient.reference_label]));
  const professionalNames = new Map(professionals.map((professional) => [professional.id, professional.name]));
  const procedureNames = new Map(procedures.map((procedure) => [procedure.id, procedure.name]));
  const assigneeNames = new Map(assignees.map((assignee) => [assignee.id, assignee.name]));

  const documents: PatientDocumentListItem[] = ((documentRows ?? []) as PatientDocument[]).map((document) => ({
    ...document,
    patient_label: patientLabels.get(document.patient_id) ?? "Paciente removido",
    assigned_name: document.assigned_to ? assigneeNames.get(document.assigned_to) ?? null : null,
    professional_name: document.professional_id ? professionalNames.get(document.professional_id) ?? null : null,
    procedure_name: document.procedure_id ? procedureNames.get(document.procedure_id) ?? null : null,
  }));

  const requestedDocument = params.document;
  const activeDocument = documents.find((document) => document.id === requestedDocument) ?? documents[0] ?? null;
  let events: PatientDocumentEvent[] = [];
  let latestAnalysis: PatientDocumentAiAnalysis | null = null;

  if (activeDocument) {
    const [{ data: eventRows }, { data: analysisRow }] = await Promise.all([
      supabase
        .from("patient_document_events")
        .select("*")
        .eq("clinic_id", clinicId)
        .eq("document_id", activeDocument.id)
        .order("created_at", { ascending: false })
        .limit(160),
      supabase
        .from("patient_document_ai_analyses")
        .select("*")
        .eq("clinic_id", clinicId)
        .eq("document_id", activeDocument.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    events = (eventRows ?? []).map((event) => ({
      ...(event as Omit<PatientDocumentEvent, "author_name">),
      author_name: assigneeNames.get(event.created_by) ?? null,
    }));
    latestAnalysis = (analysisRow as PatientDocumentAiAnalysis | null) ?? null;
  }

  const workspaceKey = `${activeDocument?.id ?? "none"}:${events[0]?.id ?? "empty"}`;
  const intelligenceKey = `${activeDocument?.id ?? "none"}:${latestAnalysis?.id ?? "empty"}`;

  return (
    <>
      <header className="page-header document-page-header">
        <div className="page-heading">
          <span className="eyebrow">Fluxo privado com revisão assistida</span>
          <h1>Central de Documentos</h1>
          <p>
            Organize arquivos por paciente, acompanhe o fluxo e use a IA para localizar problemas aparentes antes da revisão humana.
          </p>
        </div>
        <StatusPill tone="success"><CheckCircle2 size={13} /> Iteração 7 ativa</StatusPill>
      </header>

      <div className="permission-note spin-page-note">
        <FileLock2 size={18} /> Arquivos são privados. A pré-análise só é liberada para documentos fictícios ou anonimizados.
      </div>
      <div className="permission-note spin-page-note">
        <ShieldCheck size={18} /> A IA não assina, prescreve, valida autenticidade ou declara conformidade. Toda decisão continua humana.
      </div>

      <DocumentIntelligencePanel
        key={intelligenceKey}
        activeDocument={activeDocument}
        latestAnalysis={latestAnalysis}
      />

      <DocumentWorkspace
        key={workspaceKey}
        role={activeMembership.role}
        documents={documents}
        activeDocument={activeDocument}
        events={events}
        patients={patients}
        professionals={professionals}
        procedures={procedures}
        assignees={assignees}
        initialPatientId={params.patient ?? ""}
      />
    </>
  );
}
