import { NextResponse } from "next/server";
import { hasAiEnv } from "@/lib/ai/provider";
import { anonymizeForExternalAi } from "@/lib/ai/privacy";
import { runSpinEngine } from "@/lib/ai/spin-engine";
import { createClient } from "@/lib/supabase/server";
import type {
  ApprovedAnswer,
  ClinicCommercialProfile,
  ClinicFaq,
  ClinicRule,
  Membership,
  Procedure,
  Professional,
  SalesConversation,
} from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

type AnalyzeRequest = {
  patientMessage?: unknown;
  additionalContext?: unknown;
  procedureId?: unknown;
};

type StartedTurn = {
  interaction_id: string;
  inbound_message_id: string;
};

function textField(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  const { conversationId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sua sessão expirou. Entre novamente." }, { status: 401 });
  }

  if (!hasAiEnv()) {
    return NextResponse.json({ error: "O motor de IA ainda não foi configurado no servidor." }, { status: 503 });
  }

  const body = (await request.json().catch(() => ({}))) as AnalyzeRequest;
  const patientMessage = textField(body.patientMessage, 6000);
  const additionalContext = textField(body.additionalContext, 6000);
  const requestedProcedureId = typeof body.procedureId === "string" && body.procedureId ? body.procedureId : null;

  if (patientMessage.length < 2) {
    return NextResponse.json({ error: "Cole uma mensagem válida do paciente." }, { status: 400 });
  }

  const { data: membershipRow, error: membershipError } = await supabase
    .from("clinic_members")
    .select("id, clinic_id, user_id, role, status, created_at, updated_at, clinic:clinics(*)")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (membershipError || !membershipRow) {
    return NextResponse.json({ error: "Nenhuma clínica ativa foi encontrada para sua conta." }, { status: 403 });
  }

  const membership = membershipRow as unknown as Membership;
  const clinicId = membership.clinic_id;

  const [conversationResult, historyResult, profileResult, proceduresResult, professionalsResult, rulesResult, faqsResult, answersResult] =
    await Promise.all([
      supabase.from("sales_conversations").select("*").eq("id", conversationId).eq("clinic_id", clinicId).maybeSingle(),
      supabase
        .from("conversation_messages")
        .select("direction, content, status, created_at")
        .eq("conversation_id", conversationId)
        .eq("clinic_id", clinicId)
        .in("status", ["received", "sent"])
        .order("created_at", { ascending: true })
        .limit(40),
      supabase.from("clinic_profiles").select("*").eq("clinic_id", clinicId).maybeSingle(),
      supabase
        .from("procedures")
        .select("*")
        .eq("clinic_id", clinicId)
        .eq("active", true)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true })
        .limit(30),
      supabase.from("professionals").select("*").eq("clinic_id", clinicId).eq("active", true).order("name").limit(20),
      supabase.from("clinic_rules").select("*").eq("clinic_id", clinicId).eq("active", true).order("created_at").limit(50),
      supabase.from("clinic_faqs").select("*").eq("clinic_id", clinicId).eq("active", true).order("created_at").limit(40),
      supabase.from("approved_answers").select("*").eq("clinic_id", clinicId).eq("active", true).order("created_at").limit(40),
    ]);

  const contextError =
    conversationResult.error ||
    historyResult.error ||
    profileResult.error ||
    proceduresResult.error ||
    professionalsResult.error ||
    rulesResult.error ||
    faqsResult.error ||
    answersResult.error;

  if (contextError || !conversationResult.data) {
    return NextResponse.json({ error: "Não foi possível carregar a conversa e o contexto da clínica." }, { status: 500 });
  }

  const conversation = conversationResult.data as SalesConversation;
  if (conversation.status !== "open") {
    return NextResponse.json({ error: "Reabra a conversa antes de analisar uma nova mensagem." }, { status: 400 });
  }

  const procedures = (proceduresResult.data ?? []) as Procedure[];
  const procedureId = requestedProcedureId || conversation.procedure_id;
  if (procedureId && !procedures.some((procedure) => procedure.id === procedureId)) {
    return NextResponse.json({ error: "O procedimento selecionado não pertence à clínica ou está inativo." }, { status: 400 });
  }

  let patientMemoryContext = "";
  if (conversation.patient_id) {
    const { data: relatedConversations, error: relatedError } = await supabase
      .from("sales_conversations")
      .select("id, procedure_id, status, summary, explicit_need, implicit_need, objections, emotional_state, next_objective, recommended_strategy, last_message_at")
      .eq("clinic_id", clinicId)
      .eq("patient_id", conversation.patient_id)
      .neq("id", conversation.id)
      .order("last_message_at", { ascending: false })
      .limit(8);

    if (relatedError) {
      return NextResponse.json({ error: "Não foi possível carregar a memória comercial vinculada ao paciente." }, { status: 500 });
    }

    const procedureNames = new Map(procedures.map((procedure) => [procedure.id, procedure.name]));
    const safeMemory = (relatedConversations ?? []).map((related) => ({
      procedure: related.procedure_id ? procedureNames.get(related.procedure_id) ?? "não identificado" : "não identificado",
      status: related.status,
      summary: anonymizeForExternalAi(related.summary || ""),
      explicit_need: anonymizeForExternalAi(related.explicit_need || ""),
      implicit_need: anonymizeForExternalAi(related.implicit_need || ""),
      objections: (related.objections ?? []).map((item: string) => anonymizeForExternalAi(item)),
      emotional_state: anonymizeForExternalAi(related.emotional_state || ""),
      next_objective: anonymizeForExternalAi(related.next_objective || ""),
      recommended_strategy: anonymizeForExternalAi(related.recommended_strategy || ""),
    }));

    if (safeMemory.length > 0) {
      patientMemoryContext = `\n\nMEMÓRIA COMERCIAL DE OUTRAS CONVERSAS VINCULADAS À MESMA PESSOA:\n${JSON.stringify(safeMemory)}\nUse apenas como contexto histórico. Não presuma que necessidades antigas continuam atuais sem evidência na conversa atual.`;
    }
  }

  const { data: startData, error: startError } = await supabase.rpc("start_conversation_turn", {
    p_conversation_id: conversation.id,
    p_patient_message: patientMessage,
    p_additional_context: additionalContext,
    p_procedure_id: procedureId,
  });

  const started = (Array.isArray(startData) ? startData[0] : startData) as StartedTurn | null;
  if (startError || !started) {
    return NextResponse.json({ error: startError?.message || "Não foi possível registrar a nova mensagem." }, { status: 500 });
  }

  try {
    const history = (historyResult.data ?? []).map((message) => ({
      direction: message.direction as "patient" | "clinic",
      content: anonymizeForExternalAi(message.content),
    }));

    const { model, result } = await runSpinEngine({
      clinicName: membership.clinic.name,
      patientMessage: anonymizeForExternalAi(patientMessage),
      additionalContext: anonymizeForExternalAi(`${additionalContext}${patientMemoryContext}`),
      selectedProcedureId: procedureId,
      profile: (profileResult.data ?? null) as ClinicCommercialProfile | null,
      procedures,
      professionals: (professionalsResult.data ?? []) as Professional[],
      rules: (rulesResult.data ?? []) as ClinicRule[],
      faqs: (faqsResult.data ?? []) as ClinicFaq[],
      approvedAnswers: (answersResult.data ?? []) as ApprovedAnswer[],
      conversationHistory: history,
      conversationState: conversation,
    });

    const { data: draftMessageId, error: completionError } = await supabase.rpc("complete_conversation_turn", {
      p_interaction_id: started.interaction_id,
      p_model_name: model,
      p_analysis: result.analysis,
      p_plan: result.plan,
      p_response: result.response,
      p_validation: result.validation,
    });

    if (completionError || !draftMessageId) {
      throw new Error(completionError?.message || "Não foi possível salvar a resposta gerada.");
    }

    return NextResponse.json({
      interactionId: started.interaction_id,
      inboundMessageId: started.inbound_message_id,
      draftMessageId,
      model,
      result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "A análise falhou inesperadamente.";

    await supabase
      .from("spin_interactions")
      .update({ status: "failed", error_message: message.slice(0, 1000) })
      .eq("id", started.interaction_id);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
