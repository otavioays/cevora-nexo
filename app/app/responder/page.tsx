import type { Metadata } from "next";
import { BrainCircuit, CheckCircle2, ShieldCheck } from "lucide-react";
import { SpinWorkbench } from "@/components/spin/spin-workbench";
import { StatusPill } from "@/components/ui/status-pill";
import { hasOpenAIEnv } from "@/lib/ai/openai";
import { requireMembership } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Procedure, SpinHistoryItem, SpinStage } from "@/lib/types";

export const metadata: Metadata = { title: "Gerar resposta" };
export const dynamic = "force-dynamic";

type AnalysisRow = {
  interaction_id: string;
  spin_stage: SpinStage;
  intent: string;
};

type ResponseRow = {
  interaction_id: string;
  primary_response: string;
  validation: { safe_to_use?: boolean } | null;
};

export default async function ResponderPage() {
  const { activeMembership } = await requireMembership();
  const supabase = await createClient();

  const [{ data: procedureRows }, { data: interactionRows }] = await Promise.all([
    supabase
      .from("procedures")
      .select("*")
      .eq("clinic_id", activeMembership.clinic_id)
      .eq("active", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
    supabase
      .from("spin_interactions")
      .select("id, patient_message, procedure_id, status, created_at")
      .eq("clinic_id", activeMembership.clinic_id)
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const procedures = (procedureRows ?? []) as Procedure[];
  const interactions = interactionRows ?? [];
  const interactionIds = interactions.map((interaction) => interaction.id);

  let analyses: AnalysisRow[] = [];
  let responses: ResponseRow[] = [];

  if (interactionIds.length > 0) {
    const [analysisResult, responseResult] = await Promise.all([
      supabase
        .from("spin_analyses")
        .select("interaction_id, spin_stage, intent")
        .in("interaction_id", interactionIds),
      supabase
        .from("spin_responses")
        .select("interaction_id, primary_response, validation")
        .in("interaction_id", interactionIds),
    ]);

    analyses = (analysisResult.data ?? []) as AnalysisRow[];
    responses = (responseResult.data ?? []) as ResponseRow[];
  }

  const procedureNames = new Map(procedures.map((procedure) => [procedure.id, procedure.name]));
  const analysisByInteraction = new Map(analyses.map((analysis) => [analysis.interaction_id, analysis]));
  const responseByInteraction = new Map(responses.map((response) => [response.interaction_id, response]));

  const history: SpinHistoryItem[] = interactions.map((interaction) => {
    const analysis = analysisByInteraction.get(interaction.id);
    const response = responseByInteraction.get(interaction.id);

    return {
      id: interaction.id,
      patient_message: interaction.patient_message,
      procedure_name: interaction.procedure_id ? procedureNames.get(interaction.procedure_id) ?? null : null,
      status: interaction.status,
      created_at: interaction.created_at,
      spin_stage: analysis?.spin_stage ?? null,
      intent: analysis?.intent ?? null,
      primary_response: response?.primary_response ?? null,
      safe_to_use: typeof response?.validation?.safe_to_use === "boolean" ? response.validation.safe_to_use : null,
    };
  });

  return (
    <>
      <header className="page-header">
        <div className="page-heading">
          <span className="eyebrow">Copiloto comercial</span>
          <h1>Gerar resposta</h1>
          <p>
            Cole a mensagem recebida. O Nexo consulta a memória comercial da clínica, identifica o estágio da venda
            e recomenda o melhor próximo movimento com base em SPIN Selling.
          </p>
        </div>
        <StatusPill tone="success"><CheckCircle2 size={13} /> Iteração 3 ativa</StatusPill>
      </header>

      <div className="permission-note spin-page-note">
        <BrainCircuit size={18} /> O diagnóstico, o plano e a resposta são gravados separadamente. Assim podemos melhorar o motor sem perder o histórico do raciocínio comercial.
      </div>

      {!hasOpenAIEnv() && (
        <div className="permission-note spin-page-note spin-config-note">
          <ShieldCheck size={18} /> Falta configurar <code>OPENAI_API_KEY</code> na Vercel para liberar as análises.
        </div>
      )}

      <SpinWorkbench
        procedures={procedures}
        initialHistory={history}
        aiConfigured={hasOpenAIEnv()}
      />
    </>
  );
}
