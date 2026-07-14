"use client";

import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BadgeCheck,
  BookOpenCheck,
  BriefcaseBusiness,
  CircleDollarSign,
  ClipboardList,
  HelpCircle,
  MessageSquareText,
  Plus,
  ShieldAlert,
  Stethoscope,
  Trash2,
  UserRound,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type {
  ApprovedAnswer,
  ClinicCommercialProfile,
  ClinicFaq,
  ClinicRule,
  Procedure,
  Professional,
} from "@/lib/types";

const PRICE_VISIBILITY_LABELS = {
  never: "Nunca informar diretamente",
  after_context: "Somente depois de entender o contexto",
  always: "Pode informar quando perguntado",
} as const;

const RULE_SEVERITY_LABELS = {
  guidance: "Orientação",
  warning: "Alerta",
  block: "Bloqueio",
} as const;

const blankProfile: Omit<ClinicCommercialProfile, "clinic_id" | "created_at" | "updated_at"> = {
  description: "",
  city: "",
  state: "",
  address: "",
  whatsapp: "",
  website: "",
  business_hours: "",
  payment_information: "",
  scheduling_rules: "",
  tone_of_voice: "acolhedor, elegante e direto",
  tone_notes: "",
  primary_goal: "conduzir o paciente para uma avaliação",
  pricing_policy: "",
  prohibited_claims: [],
  forbidden_words: [],
  custom_instructions: "",
};

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function lines(formData: FormData, key: string) {
  return text(formData, key)
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function EmptyResource({ children }: { children: React.ReactNode }) {
  return <div className="resource-empty">{children}</div>;
}

export function CommercialProfileWorkspace({
  clinicId,
  canEdit,
  schemaReady,
  initialProfile,
  procedures,
  professionals,
  rules,
  faqs,
  approvedAnswers,
}: {
  clinicId: string;
  canEdit: boolean;
  schemaReady: boolean;
  initialProfile: ClinicCommercialProfile | null;
  procedures: Procedure[];
  professionals: Professional[];
  rules: ClinicRule[];
  faqs: ClinicFaq[];
  approvedAnswers: ApprovedAnswer[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const profile = initialProfile ?? { ...blankProfile, clinic_id: clinicId, created_at: "", updated_at: "" };

  const completion = useMemo(() => {
    const checks = [
      Boolean(profile.description),
      Boolean(profile.business_hours),
      Boolean(profile.payment_information),
      Boolean(profile.scheduling_rules),
      Boolean(profile.tone_of_voice),
      Boolean(profile.primary_goal),
      Boolean(profile.pricing_policy),
      procedures.length > 0,
      professionals.length > 0,
      rules.length > 0,
      faqs.length > 0,
      approvedAnswers.length > 0,
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [approvedAnswers.length, faqs.length, procedures.length, professionals.length, profile, rules.length]);

  async function perform(
    operation: () => PromiseLike<{ error: { message: string } | null }>,
    successMessage: string,
    form?: HTMLFormElement,
  ) {
    setBusy(true);
    setFeedback(null);
    try {
      const { error } = await operation();
      if (error) throw new Error(error.message);
      form?.reset();
      setFeedback({ tone: "success", message: successMessage });
      router.refresh();
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "Não foi possível concluir a ação.",
      });
    } finally {
      setBusy(false);
    }
  }

  function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    return perform(
      () =>
        supabase.from("clinic_profiles").upsert(
          {
            clinic_id: clinicId,
            description: text(formData, "description"),
            city: text(formData, "city"),
            state: text(formData, "state"),
            address: text(formData, "address"),
            whatsapp: text(formData, "whatsapp"),
            website: text(formData, "website"),
            business_hours: text(formData, "business_hours"),
            payment_information: text(formData, "payment_information"),
            scheduling_rules: text(formData, "scheduling_rules"),
            tone_of_voice: text(formData, "tone_of_voice"),
            tone_notes: text(formData, "tone_notes"),
            primary_goal: text(formData, "primary_goal"),
            pricing_policy: text(formData, "pricing_policy"),
            prohibited_claims: lines(formData, "prohibited_claims"),
            forbidden_words: lines(formData, "forbidden_words"),
            custom_instructions: text(formData, "custom_instructions"),
          },
          { onConflict: "clinic_id" },
        ),
      "Perfil comercial salvo.",
    );
  }

  function addProcedure(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    return perform(
      () =>
        supabase.from("procedures").insert({
          clinic_id: clinicId,
          name: text(formData, "name"),
          category: text(formData, "category"),
          description: text(formData, "description"),
          target_patient: text(formData, "target_patient"),
          benefits: text(formData, "benefits"),
          price_guidance: text(formData, "price_guidance"),
          price_visibility: text(formData, "price_visibility") || "after_context",
          consultation_required: formData.get("consultation_required") === "on",
        }),
      "Procedimento adicionado.",
      form,
    );
  }

  function addProfessional(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    return perform(
      () =>
        supabase.from("professionals").insert({
          clinic_id: clinicId,
          name: text(formData, "name"),
          specialty: text(formData, "specialty"),
          registration: text(formData, "registration"),
          bio: text(formData, "bio"),
        }),
      "Profissional adicionado.",
      form,
    );
  }

  function addRule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    return perform(
      () =>
        supabase.from("clinic_rules").insert({
          clinic_id: clinicId,
          title: text(formData, "title"),
          category: text(formData, "category") || "comercial",
          instruction: text(formData, "instruction"),
          severity: text(formData, "severity") || "guidance",
        }),
      "Regra adicionada.",
      form,
    );
  }

  function addFaq(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const procedureId = text(formData, "procedure_id");
    return perform(
      () =>
        supabase.from("clinic_faqs").insert({
          clinic_id: clinicId,
          procedure_id: procedureId || null,
          question: text(formData, "question"),
          answer: text(formData, "answer"),
        }),
      "Pergunta frequente adicionada.",
      form,
    );
  }

  function addApprovedAnswer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const procedureId = text(formData, "procedure_id");
    return perform(
      () =>
        supabase.from("approved_answers").insert({
          clinic_id: clinicId,
          procedure_id: procedureId || null,
          label: text(formData, "label"),
          patient_intent: text(formData, "patient_intent"),
          content: text(formData, "content"),
        }),
      "Resposta aprovada adicionada.",
      form,
    );
  }

  function toggleResource(
    table: "procedures" | "professionals" | "clinic_rules" | "clinic_faqs" | "approved_answers",
    id: string,
    active: boolean,
  ) {
    return perform(
      () => supabase.from(table).update({ active: !active }).eq("id", id),
      active ? "Item desativado." : "Item reativado.",
    );
  }

  function deleteResource(
    table: "procedures" | "professionals" | "clinic_rules" | "clinic_faqs" | "approved_answers",
    id: string,
  ) {
    if (!window.confirm("Excluir este item permanentemente?")) return;
    return perform(() => supabase.from(table).delete().eq("id", id), "Item excluído.");
  }

  if (!schemaReady) {
    return (
      <div className="permission-note">
        <ShieldAlert size={18} /> A migration da Iteração 2 ainda não foi executada no Supabase. A interface já está pronta, mas os novos registros só funcionarão depois da criação das tabelas.
      </div>
    );
  }

  return (
    <div className="commercial-workspace">
      <section className="card commercial-progress-card">
        <div>
          <span className="eyebrow">Contexto disponível para a IA</span>
          <h2>{completion}% estruturado</h2>
          <p className="card-description">Quanto mais completo, menos o Nexo precisa adivinhar e mais fiel fica a resposta sugerida.</p>
        </div>
        <div className="completion-track" aria-label={`${completion}% completo`}>
          <span style={{ width: `${completion}%` }} />
        </div>
      </section>

      {feedback && <div className={feedback.tone === "success" ? "form-success" : "form-error"}>{feedback.message}</div>}
      {!canEdit && <div className="permission-note"><BadgeCheck size={18} /> Seu papel permite consultar o perfil. Somente proprietários e gestores podem alterá-lo.</div>}

      <form className="card commercial-profile-form" onSubmit={saveProfile}>
        <div className="section-title-row">
          <div><span className="resource-kicker">Base da clínica</span><h2>Identidade e operação</h2></div>
          <BriefcaseBusiness size={21} />
        </div>
        <div className="mini-grid two-columns">
          <div className="field field-span-2"><label htmlFor="description">Descrição da clínica</label><textarea className="textarea" id="description" name="description" defaultValue={profile.description} placeholder="O que a clínica faz, para quem e como deseja ser percebida." /></div>
          <div className="field"><label htmlFor="city">Cidade</label><input className="input" id="city" name="city" defaultValue={profile.city} /></div>
          <div className="field"><label htmlFor="state">Estado</label><input className="input" id="state" name="state" defaultValue={profile.state} /></div>
          <div className="field field-span-2"><label htmlFor="address">Endereço</label><input className="input" id="address" name="address" defaultValue={profile.address} /></div>
          <div className="field"><label htmlFor="whatsapp">WhatsApp</label><input className="input" id="whatsapp" name="whatsapp" defaultValue={profile.whatsapp} /></div>
          <div className="field"><label htmlFor="website">Site</label><input className="input" id="website" name="website" defaultValue={profile.website} /></div>
          <div className="field"><label htmlFor="business_hours">Horários</label><textarea className="textarea compact-textarea" id="business_hours" name="business_hours" defaultValue={profile.business_hours} /></div>
          <div className="field"><label htmlFor="payment_information">Formas de pagamento</label><textarea className="textarea compact-textarea" id="payment_information" name="payment_information" defaultValue={profile.payment_information} /></div>
          <div className="field field-span-2"><label htmlFor="scheduling_rules">Regras de agendamento</label><textarea className="textarea" id="scheduling_rules" name="scheduling_rules" defaultValue={profile.scheduling_rules} placeholder="Avaliação presencial, sinal, horários, documentos e demais regras." /></div>
        </div>

        <div className="section-divider" />
        <div className="section-title-row">
          <div><span className="resource-kicker">Voz e objetivo</span><h2>Como o Nexo deve representar a clínica</h2></div>
          <MessageSquareText size={21} />
        </div>
        <div className="mini-grid two-columns">
          <div className="field"><label htmlFor="tone_of_voice">Tom de voz</label><input className="input" id="tone_of_voice" name="tone_of_voice" defaultValue={profile.tone_of_voice} /></div>
          <div className="field"><label htmlFor="primary_goal">Objetivo principal</label><input className="input" id="primary_goal" name="primary_goal" defaultValue={profile.primary_goal} /></div>
          <div className="field field-span-2"><label htmlFor="tone_notes">Orientações de linguagem</label><textarea className="textarea" id="tone_notes" name="tone_notes" defaultValue={profile.tone_notes} placeholder="Ex.: mensagens curtas, uma pergunta por vez, sem excesso de emojis." /></div>
          <div className="field field-span-2"><label htmlFor="pricing_policy">Política de preços</label><textarea className="textarea" id="pricing_policy" name="pricing_policy" defaultValue={profile.pricing_policy} placeholder="Explique quando preços podem ser informados e o que precisa ser investigado antes." /></div>
          <div className="field"><label htmlFor="prohibited_claims">Afirmações proibidas</label><textarea className="textarea" id="prohibited_claims" name="prohibited_claims" defaultValue={profile.prohibited_claims.join("\n")} placeholder={'Uma por linha\nResultado garantido\nProcedimento sem risco'} /></div>
          <div className="field"><label htmlFor="forbidden_words">Palavras a evitar</label><textarea className="textarea" id="forbidden_words" name="forbidden_words" defaultValue={profile.forbidden_words.join("\n")} placeholder={'Uma por linha\nbaratinho\nperfeito'} /></div>
          <div className="field field-span-2"><label htmlFor="custom_instructions">Instruções adicionais</label><textarea className="textarea" id="custom_instructions" name="custom_instructions" defaultValue={profile.custom_instructions} /></div>
        </div>
        {canEdit && <div className="form-actions"><button className="button button-primary" type="submit" disabled={busy}>Salvar perfil comercial</button></div>}
      </form>

      <div className="commercial-grid">
        <section className="card resource-section">
          <div className="section-title-row"><div><span className="resource-kicker">Catálogo</span><h2>Procedimentos</h2></div><Stethoscope size={20} /></div>
          {canEdit && <details className="resource-create"><summary><Plus size={15} /> Adicionar procedimento</summary><form className="form-stack" onSubmit={addProcedure}><div className="mini-grid two-columns"><div className="field"><label>Nome</label><input className="input" name="name" required /></div><div className="field"><label>Categoria</label><input className="input" name="category" /></div><div className="field field-span-2"><label>Descrição</label><textarea className="textarea compact-textarea" name="description" /></div><div className="field"><label>Paciente indicado</label><textarea className="textarea compact-textarea" name="target_patient" /></div><div className="field"><label>Benefícios permitidos</label><textarea className="textarea compact-textarea" name="benefits" /></div><div className="field"><label>Orientação de preço</label><textarea className="textarea compact-textarea" name="price_guidance" /></div><div className="field"><label>Quando informar preço</label><select className="select" name="price_visibility" defaultValue="after_context"><option value="never">Nunca diretamente</option><option value="after_context">Após entender o contexto</option><option value="always">Quando perguntado</option></select></div></div><label className="checkbox-row"><input type="checkbox" name="consultation_required" defaultChecked /> Exige avaliação antes de orçamento definitivo</label><button className="button button-secondary" disabled={busy}>Adicionar</button></form></details>}
          <div className="resource-list">{procedures.length === 0 ? <EmptyResource>Nenhum procedimento cadastrado.</EmptyResource> : procedures.map((item) => <article className={`resource-item ${item.active ? "" : "resource-inactive"}`} key={item.id}><div className="resource-item-main"><strong>{item.name}</strong><span>{item.category || "Sem categoria"} · {PRICE_VISIBILITY_LABELS[item.price_visibility]}</span><p>{item.description || "Sem descrição cadastrada."}</p></div>{canEdit && <div className="resource-actions"><button className="button button-ghost button-small" type="button" onClick={() => toggleResource("procedures", item.id, item.active)}>{item.active ? "Desativar" : "Ativar"}</button><button className="button button-ghost button-small" type="button" onClick={() => deleteResource("procedures", item.id)} aria-label="Excluir"><Trash2 size={15} /></button></div>}</article>)}</div>
        </section>

        <section className="card resource-section">
          <div className="section-title-row"><div><span className="resource-kicker">Autoridade</span><h2>Profissionais</h2></div><UserRound size={20} /></div>
          {canEdit && <details className="resource-create"><summary><Plus size={15} /> Adicionar profissional</summary><form className="form-stack" onSubmit={addProfessional}><div className="mini-grid two-columns"><div className="field"><label>Nome</label><input className="input" name="name" required /></div><div className="field"><label>Especialidade</label><input className="input" name="specialty" /></div><div className="field"><label>Registro profissional</label><input className="input" name="registration" /></div><div className="field field-span-2"><label>Biografia e diferenciais</label><textarea className="textarea" name="bio" /></div></div><button className="button button-secondary" disabled={busy}>Adicionar</button></form></details>}
          <div className="resource-list">{professionals.length === 0 ? <EmptyResource>Nenhum profissional cadastrado.</EmptyResource> : professionals.map((item) => <article className={`resource-item ${item.active ? "" : "resource-inactive"}`} key={item.id}><div className="resource-item-main"><strong>{item.name}</strong><span>{item.specialty || "Especialidade não informada"}{item.registration ? ` · ${item.registration}` : ""}</span><p>{item.bio || "Sem biografia cadastrada."}</p></div>{canEdit && <div className="resource-actions"><button className="button button-ghost button-small" type="button" onClick={() => toggleResource("professionals", item.id, item.active)}>{item.active ? "Desativar" : "Ativar"}</button><button className="button button-ghost button-small" type="button" onClick={() => deleteResource("professionals", item.id)}><Trash2 size={15} /></button></div>}</article>)}</div>
        </section>

        <section className="card resource-section">
          <div className="section-title-row"><div><span className="resource-kicker">Trilhos de segurança</span><h2>Regras da clínica</h2></div><ClipboardList size={20} /></div>
          {canEdit && <details className="resource-create"><summary><Plus size={15} /> Adicionar regra</summary><form className="form-stack" onSubmit={addRule}><div className="mini-grid two-columns"><div className="field"><label>Título</label><input className="input" name="title" required /></div><div className="field"><label>Categoria</label><input className="input" name="category" placeholder="comercial, médica, agendamento" /></div><div className="field"><label>Severidade</label><select className="select" name="severity"><option value="guidance">Orientação</option><option value="warning">Alerta</option><option value="block">Bloqueio</option></select></div><div className="field field-span-2"><label>Instrução</label><textarea className="textarea" name="instruction" required /></div></div><button className="button button-secondary" disabled={busy}>Adicionar</button></form></details>}
          <div className="resource-list">{rules.length === 0 ? <EmptyResource>Nenhuma regra cadastrada.</EmptyResource> : rules.map((item) => <article className={`resource-item ${item.active ? "" : "resource-inactive"}`} key={item.id}><div className="resource-item-main"><strong>{item.title}</strong><span>{item.category} · {RULE_SEVERITY_LABELS[item.severity]}</span><p>{item.instruction}</p></div>{canEdit && <div className="resource-actions"><button className="button button-ghost button-small" type="button" onClick={() => toggleResource("clinic_rules", item.id, item.active)}>{item.active ? "Desativar" : "Ativar"}</button><button className="button button-ghost button-small" type="button" onClick={() => deleteResource("clinic_rules", item.id)}><Trash2 size={15} /></button></div>}</article>)}</div>
        </section>

        <section className="card resource-section">
          <div className="section-title-row"><div><span className="resource-kicker">Conhecimento objetivo</span><h2>Perguntas frequentes</h2></div><HelpCircle size={20} /></div>
          {canEdit && <details className="resource-create"><summary><Plus size={15} /> Adicionar FAQ</summary><form className="form-stack" onSubmit={addFaq}><div className="field"><label>Procedimento relacionado</label><select className="select" name="procedure_id"><option value="">Geral</option>{procedures.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></div><div className="field"><label>Pergunta</label><input className="input" name="question" required /></div><div className="field"><label>Resposta factual aprovada</label><textarea className="textarea" name="answer" required /></div><button className="button button-secondary" disabled={busy}>Adicionar</button></form></details>}
          <div className="resource-list">{faqs.length === 0 ? <EmptyResource>Nenhuma pergunta frequente cadastrada.</EmptyResource> : faqs.map((item) => <article className={`resource-item ${item.active ? "" : "resource-inactive"}`} key={item.id}><div className="resource-item-main"><strong>{item.question}</strong><p>{item.answer}</p></div>{canEdit && <div className="resource-actions"><button className="button button-ghost button-small" type="button" onClick={() => toggleResource("clinic_faqs", item.id, item.active)}>{item.active ? "Desativar" : "Ativar"}</button><button className="button button-ghost button-small" type="button" onClick={() => deleteResource("clinic_faqs", item.id)}><Trash2 size={15} /></button></div>}</article>)}</div>
        </section>

        <section className="card resource-section commercial-wide-card">
          <div className="section-title-row"><div><span className="resource-kicker">Exemplos validados</span><h2>Respostas aprovadas</h2></div><BookOpenCheck size={20} /></div>
          {canEdit && <details className="resource-create"><summary><Plus size={15} /> Adicionar resposta</summary><form className="form-stack" onSubmit={addApprovedAnswer}><div className="mini-grid two-columns"><div className="field"><label>Nome interno</label><input className="input" name="label" required placeholder="Ex.: preço da rinoplastia" /></div><div className="field"><label>Intenção do paciente</label><input className="input" name="patient_intent" placeholder="descobrir preço, medo, disponibilidade" /></div><div className="field"><label>Procedimento relacionado</label><select className="select" name="procedure_id"><option value="">Geral</option>{procedures.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></div><div className="field field-span-2"><label>Resposta aprovada</label><textarea className="textarea" name="content" required /></div></div><button className="button button-secondary" disabled={busy}>Adicionar</button></form></details>}
          <div className="resource-list">{approvedAnswers.length === 0 ? <EmptyResource>Nenhuma resposta aprovada cadastrada.</EmptyResource> : approvedAnswers.map((item) => <article className={`resource-item ${item.active ? "" : "resource-inactive"}`} key={item.id}><div className="resource-item-main"><strong>{item.label}</strong><span>{item.patient_intent || "Intenção geral"}</span><p className="approved-copy">“{item.content}”</p></div>{canEdit && <div className="resource-actions"><button className="button button-ghost button-small" type="button" onClick={() => toggleResource("approved_answers", item.id, item.active)}>{item.active ? "Desativar" : "Ativar"}</button><button className="button button-ghost button-small" type="button" onClick={() => deleteResource("approved_answers", item.id)}><Trash2 size={15} /></button></div>}</article>)}</div>
        </section>
      </div>

      <section className="card commercial-footnote">
        <CircleDollarSign size={20} />
        <div><strong>Por que isso vem antes do motor SPIN?</strong><p>Na Iteração 3, diagnóstico e geração consultarão estes dados. Assim, a IA pode adaptar a estratégia sem inventar preço, promessa, procedimento, profissional ou regra de agendamento.</p></div>
      </section>
    </div>
  );
}
