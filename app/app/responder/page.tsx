import type { Metadata } from "next";
import { BrainCircuit, CheckCircle2, ShieldCheck } from "lucide-react";
import { ConversationWorkspace } from "@/components/conversations/conversation-workspace";
import { StatusPill } from "@/components/ui/status-pill";
import { hasAiEnv } from "@/lib/ai/provider";
import { requireMembership } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type {
  ConversationLatestResult,
  ConversationMessage,
  Patient,
  Procedure,
  SalesConversation,
  SalesConversationListItem,
  SpinAnalysis,
  SpinGeneratedResponse,
  SpinPlan,
  SpinValidation,
} from "@/lib/types";

export const metadata: Metadata = { title: "Conversas" };
export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ conversation?: string }>;
};

export default async function ResponderPage({ searchParams }: PageProps) {
  const { activeMembership } = await requireMembership();
  const supabase = await createClient();
  const params = await searchParams;

  const [{ data: procedureRows }, { data: conversationRows }, { data: patientRows }] = await Promise.all([
    supabase
      .from("procedures")
      .select("*")
      .eq("clinic_id", activeMembership.clinic_id)
      .eq("active", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
    supabase
      .from("sales_conversations")
      .select("*")
      .eq("clinic_id", activeMembership.clinic_id)
      .order("last_message_at", { ascending: false })
      .limit(60),
    supabase
      .from("patients")
      .select("*")
      .eq("clinic_id", activeMembership.clinic_id)
      .order("last_activity_at", { ascending: false })
      .limit(120),
  ]);

  const procedures = (procedureRows ?? []) as Procedure[];
  const patients = (patientRows ?? []) as Patient[];
  const procedureNames = new Map(procedures.map((procedure) => [procedure.id, procedure.name]));
  const patientNames = new Map(patients.map((patient) => [patient.id, patient.reference_label]));
  const rawConversations = (conversationRows ?? []) as SalesConversation[];
  const conversations: SalesConversationListItem[] = rawConversations.map((conversation) => ({
    ...conversation,
    procedure_name: conversation.procedure_id ? procedureNames.get(conversation.procedure_id) ?? null : null,
    patient_label: conversation.patient_id ? patientNames.get(conversation.patient_id) ?? null : null,
  }));

  const requestedConversation = params.conversation;
  const activeConversation =
    conversations.find((conversation) => conversation.id === requestedConversation) ?? conversations[0] ?? null;

  let messages: ConversationMessage[] = [];
  let latestResult: ConversationLatestResult | null = null;

  if (activeConversation) {
    const [{ data: messageRows }, { data: latestInteraction }] = await Promise.all([
      supabase
        .from("conversation_messages")
        .select("*")
        .eq("conversation_id", activeConversation.id)
        .eq("clinic_id", activeMembership.clinic_id)
        .order("created_at", { ascending: true })
        .limit(120),
      supabase
        .from("spin_interactions")
        .select("id")
        .eq("conversation_id", activeConversation.id)
        .eq("clinic_id", activeMembership.clinic_id)
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    messages = (messageRows ?? []) as ConversationMessage[];

    if (latestInteraction) {
      const [{ data: analysis }, { data: plan }, { data: generatedResponse }, { data: draftMessage }] = await Promise.all([
        supabase.from("spin_analyses").select("*").eq("interaction_id", latestInteraction.id).maybeSingle(),
        supabase.from("spin_plans").select("*").eq("interaction_id", latestInteraction.id).maybeSingle(),
        supabase.from("spin_responses").select("*").eq("interaction_id", latestInteraction.id).maybeSingle(),
        supabase
          .from("conversation_messages")
          .select("id")
          .eq("interaction_id", latestInteraction.id)
          .eq("direction", "clinic")
          .eq("status", "draft")
          .maybeSingle(),
      ]);

      if (analysis && plan && generatedResponse) {
        latestResult = {
          interaction_id: latestInteraction.id,
          draft_message_id: draftMessage?.id ?? null,
          result: {
            analysis: {
              interaction_stage: analysis.interaction_stage,
              spin_stage: analysis.spin_stage,
              intent: analysis.intent,
              summary: analysis.summary,
              explicit_need: analysis.explicit_need,
              implicit_need: analysis.implicit_need,
              objections: analysis.objections,
              emotional_state: analysis.emotional_state,
              missing_information: analysis.missing_information,
              risk_level: analysis.risk_level,
              confidence: Number(analysis.confidence),
            } as SpinAnalysis,
            plan: {
              next_objective: plan.next_objective,
              recommended_strategy: plan.recommended_strategy,
              rationale: plan.rationale,
              should_present_offer: plan.should_present_offer,
              should_request_commitment: plan.should_request_commitment,
              avoid_actions: plan.avoid_actions,
            } as SpinPlan,
            response: {
              primary_response: generatedResponse.primary_response,
              alternative_response: generatedResponse.alternative_response,
              explanation: generatedResponse.explanation,
              expected_next_step: generatedResponse.expected_next_step,
              warnings: generatedResponse.warnings,
            } as SpinGeneratedResponse,
            validation: (generatedResponse.validation ?? {
              safe_to_use: false,
              checks: [],
              issues: ["Validação indisponível."],
            }) as SpinValidation,
          },
        };
      }
    }
  }

  const aiConfigured = hasAiEnv();
  const workspaceKey = `${activeConversation?.id ?? "none"}:${latestResult?.interaction_id ?? "empty"}`;

  return (
    <>
      <header className="page-header conversation-page-header">
        <div className="page-heading">
          <span className="eyebrow">Memória comercial contínua</span>
          <h1>Conversas</h1>
          <p>
            O Nexo acompanha cada atendimento e agora pode conectá-lo ao histórico completo da mesma pessoa.
          </p>
        </div>
        <StatusPill tone="success"><CheckCircle2 size={13} /> Iteração 5 ativa</StatusPill>
      </header>

      <div className="permission-note spin-page-note">
        <BrainCircuit size={18} /> Rascunhos gerados não entram na memória até a atendente confirmar que foram realmente enviados.
      </div>
      <div className="permission-note spin-page-note">
        <ShieldCheck size={18} /> A referência interna do paciente nunca é enviada à IA. Somente memória comercial anonimizada pode atravessar conversas vinculadas.
      </div>

      {!aiConfigured && (
        <div className="permission-note spin-page-note spin-config-note">
          <ShieldCheck size={18} /> Falta configurar <code>GEMINI_API_KEY</code> na Vercel para liberar as análises.
        </div>
      )}

      <ConversationWorkspace
        key={workspaceKey}
        procedures={procedures}
        patients={patients}
        conversations={conversations}
        activeConversation={activeConversation}
        messages={messages}
        latestResult={latestResult}
        aiConfigured={aiConfigured}
      />
    </>
  );
}
