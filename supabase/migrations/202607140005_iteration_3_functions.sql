-- Cevora Nexo · Iteração 3 · Persistência atômica do resultado

create or replace function public.complete_spin_interaction(
  p_interaction_id uuid,
  p_model_name text,
  p_analysis jsonb,
  p_plan jsonb,
  p_response jsonb,
  p_validation jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_interaction public.spin_interactions%rowtype;
begin
  select * into v_interaction
  from public.spin_interactions
  where id = p_interaction_id
  for update;

  if not found then
    raise exception 'Interação não encontrada.';
  end if;

  if v_interaction.created_by <> auth.uid() and not public.is_platform_admin() then
    raise exception 'Acesso negado.';
  end if;

  if v_interaction.status <> 'processing' then
    raise exception 'Esta interação já foi finalizada.';
  end if;

  insert into public.spin_analyses (
    interaction_id,
    clinic_id,
    interaction_stage,
    spin_stage,
    intent,
    summary,
    explicit_need,
    implicit_need,
    objections,
    emotional_state,
    missing_information,
    risk_level,
    confidence
  ) values (
    v_interaction.id,
    v_interaction.clinic_id,
    (p_analysis ->> 'interaction_stage')::public.sales_interaction_stage,
    (p_analysis ->> 'spin_stage')::public.spin_stage,
    coalesce(p_analysis ->> 'intent', ''),
    coalesce(p_analysis ->> 'summary', ''),
    coalesce(p_analysis ->> 'explicit_need', ''),
    coalesce(p_analysis ->> 'implicit_need', ''),
    coalesce(array(select jsonb_array_elements_text(coalesce(p_analysis -> 'objections', '[]'::jsonb))), '{}'::text[]),
    coalesce(p_analysis ->> 'emotional_state', ''),
    coalesce(array(select jsonb_array_elements_text(coalesce(p_analysis -> 'missing_information', '[]'::jsonb))), '{}'::text[]),
    (p_analysis ->> 'risk_level')::public.spin_risk_level,
    greatest(0, least(1, coalesce((p_analysis ->> 'confidence')::numeric, 0)))
  );

  insert into public.spin_plans (
    interaction_id,
    clinic_id,
    next_objective,
    recommended_strategy,
    rationale,
    should_present_offer,
    should_request_commitment,
    avoid_actions
  ) values (
    v_interaction.id,
    v_interaction.clinic_id,
    coalesce(p_plan ->> 'next_objective', ''),
    coalesce(p_plan ->> 'recommended_strategy', ''),
    coalesce(p_plan ->> 'rationale', ''),
    coalesce((p_plan ->> 'should_present_offer')::boolean, false),
    coalesce((p_plan ->> 'should_request_commitment')::boolean, false),
    coalesce(array(select jsonb_array_elements_text(coalesce(p_plan -> 'avoid_actions', '[]'::jsonb))), '{}'::text[])
  );

  insert into public.spin_responses (
    interaction_id,
    clinic_id,
    primary_response,
    alternative_response,
    explanation,
    expected_next_step,
    warnings,
    validation
  ) values (
    v_interaction.id,
    v_interaction.clinic_id,
    coalesce(p_response ->> 'primary_response', ''),
    coalesce(p_response ->> 'alternative_response', ''),
    coalesce(p_response ->> 'explanation', ''),
    coalesce(p_response ->> 'expected_next_step', ''),
    coalesce(array(select jsonb_array_elements_text(coalesce(p_response -> 'warnings', '[]'::jsonb))), '{}'::text[]),
    coalesce(p_validation, '{}'::jsonb)
  );

  update public.spin_interactions
  set status = 'completed',
      model_name = trim(coalesce(p_model_name, '')),
      prompt_version = 'spin-v1',
      error_message = null
  where id = v_interaction.id;
end;
$$;

grant execute on function public.complete_spin_interaction(uuid, text, jsonb, jsonb, jsonb, jsonb) to authenticated;
