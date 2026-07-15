import type { Metadata } from "next";
import { BookOpenCheck, CheckCircle2 } from "lucide-react";
import { CommercialProfileWorkspace } from "@/components/commercial/commercial-profile-workspace";
import { StatusPill } from "@/components/ui/status-pill";
import { requireManagement } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type {
  ApprovedAnswer,
  ClinicCommercialProfile,
  ClinicFaq,
  ClinicRule,
  Procedure,
  Professional,
} from "@/lib/types";

export const metadata: Metadata = { title: "Perfil comercial" };
export const dynamic = "force-dynamic";

export default async function CommercialProfilePage() {
  const { activeMembership } = await requireManagement();
  const supabase = await createClient();

  const [profileResult, proceduresResult, professionalsResult, rulesResult, faqsResult, answersResult] =
    await Promise.all([
      supabase.from("clinic_profiles").select("*").eq("clinic_id", activeMembership.clinic_id).maybeSingle(),
      supabase.from("procedures").select("*").eq("clinic_id", activeMembership.clinic_id).order("sort_order").order("name"),
      supabase.from("professionals").select("*").eq("clinic_id", activeMembership.clinic_id).order("name"),
      supabase.from("clinic_rules").select("*").eq("clinic_id", activeMembership.clinic_id).order("severity", { ascending: false }).order("created_at"),
      supabase.from("clinic_faqs").select("*").eq("clinic_id", activeMembership.clinic_id).order("created_at", { ascending: false }),
      supabase.from("approved_answers").select("*").eq("clinic_id", activeMembership.clinic_id).order("created_at", { ascending: false }),
    ]);

  const schemaReady = ![
    profileResult.error,
    proceduresResult.error,
    professionalsResult.error,
    rulesResult.error,
    faqsResult.error,
    answersResult.error,
  ].some((error) => error?.code === "42P01" || error?.code === "PGRST205");

  return (
    <>
      <header className="page-header">
        <div className="page-heading">
          <span className="eyebrow">Memória comercial da clínica</span>
          <h1>Perfil comercial</h1>
          <p>Cadastre fatos, limites e exemplos que o Nexo consulta antes de recomendar qualquer resposta.</p>
        </div>
        <StatusPill tone="success"><CheckCircle2 size={13} /> Ambiente de Gestão</StatusPill>
      </header>

      <div className="feature-row commercial-intro">
        <BookOpenCheck size={18} />
        <div><strong>Fonte de verdade administrativa</strong><p>Atendimento consulta o contexto aprovado, mas somente a gestão altera regras, procedimentos e profissionais.</p></div>
      </div>

      <CommercialProfileWorkspace
        clinicId={activeMembership.clinic_id}
        canEdit
        schemaReady={schemaReady}
        initialProfile={(profileResult.data ?? null) as ClinicCommercialProfile | null}
        procedures={(proceduresResult.data ?? []) as Procedure[]}
        professionals={(professionalsResult.data ?? []) as Professional[]}
        rules={(rulesResult.data ?? []) as ClinicRule[]}
        faqs={(faqsResult.data ?? []) as ClinicFaq[]}
        approvedAnswers={(answersResult.data ?? []) as ApprovedAnswer[]}
      />
    </>
  );
}
