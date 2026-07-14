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
} from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

type AnalyzeRequest = {
  patientMessage?: unknown;
  additionalContext?: unknown;
  procedureId?: unknown;
};

function textField(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sua sessão expirou. Entre novamente." }, { status: 401 });
  }

  if (!hasAiEnv()) {
    return NextResponse.json(
      { error: "O motor de IA ainda não foi configurado no servidor." },
      { status: 503 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as AnalyzeRequest;
  const patientMessage = textField(body.patientMessage, 6000);
  const additionalContext = textField(body.additionalContext, 6000);
  const procedureId = typeof body.procedureId === "string" && body.procedureId ? body.procedureId : null;

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

  const [profileResult, proceduresResult, professionalsResult, rulesResult, faqsResult, answersResult] =
    await Promise.all([
      supabase.from("clinic_profiles").select("*").eq("clinic_id", clinicId).maybeSingle(),
      supabase
        .from("procedures")
        .select("*")
        .eq("clinic_id", clinicId)
        .eq("active", true)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true })
        .limit(30),
      supabase
        .from("professionals")
        .select("*")
        .eq("clinic_id", clinicId)
        .eq("active", true)
        .order("name", { ascending: true })
        .limit(20),
      supabase
        .from("clinic_rules")
        .select("*")
        .eq("clinic_id", clinicId)
        .eq("active", true)
        .order("created_at", { ascending: true })
        .limit(50),
      supabase
        .from("clinic_faqs")
        .select("*")
        .eq("clinic_id", clinicId)
        .eq("active", true)
        .order("created_at", { ascending: true })
        .limit(40),
      supabase
        .from("approved_answers")
        .select("*")
        .eq("clinic_id", clinicId)
        .eq("active", true)
        .order("created_at", { ascending: true })
        .limit(40),
    ]);

  const contextError =
    profileResult.error ||
    proceduresResult.error ||
    professionalsResult.error ||
    rulesResult.error ||
    faqsResult.error ||
    answersResult.error;

  if (contextError) {
    return NextResponse.json(
      { error: "Não foi possível carregar o perfil comercial da clínica." },
      { status: 500 },
    );
  }

  const procedures = (proceduresResult.data ?? []) as Procedure[];
  if (procedureId && !procedures.some((procedure) => procedure.id === procedureId)) {
    return NextResponse.json(
      { error: "O procedimento selecionado não pertence a esta clínica ou está inativo." },
      { status: 400 },
    );
  }

  const { data: interaction, error: interactionError } = await supabase
    .from("spin_interactions")
    .insert({
      clinic_id: clinicId,
      created_by: user.id,
      procedure_id: procedureId,
      patient_message: patientMessage,
      additional_context: additionalContext,
      status: "processing",
      prompt_version: "spin-v1",
    })
    .select("id")
    .single();

  if (interactionError || !interaction) {
    return NextResponse.json(
      { error: interactionError?.message || "Não foi possível registrar a análise." },
      { status: 500 },
    );
  }

  try {
    const { model, result } = await runSpinEngine({
      clinicName: membership.clinic.name,
      patientMessage: anonymizeForExternalAi(patientMessage),
      additionalContext: anonymizeForExternalAi(additionalContext),
      selectedProcedureId: procedureId,
      profile: (profileResult.data ?? null) as ClinicCommercialProfile | null,
      procedures,
      professionals: (professionalsResult.data ?? []) as Professional[],
      rules: (rulesResult.data ?? []) as ClinicRule[],
      faqs: (faqsResult.data ?? []) as ClinicFaq[],
      approvedAnswers: (answersResult.data ?? []) as ApprovedAnswer[],
    });

    const { error: completionError } = await supabase.rpc("complete_spin_interaction", {
      p_interaction_id: interaction.id,
      p_model_name: model,
      p_analysis: result.analysis,
      p_plan: result.plan,
      p_response: result.response,
      p_validation: result.validation,
    });

    if (completionError) throw completionError;

    return NextResponse.json({
      interactionId: interaction.id,
      model,
      result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "A análise falhou inesperadamente.";

    await supabase
      .from("spin_interactions")
      .update({
        status: "failed",
        error_message: message.slice(0, 1000),
      })
      .eq("id", interaction.id);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
