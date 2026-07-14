-- Cevora Nexo · Iteração 4 · Funções seguras de conversa

create or replace function public.create_sales_conversation(
  p_clinic_id uuid,
  p_contact_label text,
  p_channel public.sales_conversation_channel default 'whatsapp',
  p_procedure_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conversation_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Autenticação obrigatória.';
  end if;

  if not public.is_clinic_member(p_clinic_id) then
    raise exception 'Você não pertence a esta clínica.';
  end if;

  if char_length(trim(coalesce(p_contact_label, ''))) < 2 then
    raise exception 'Informe uma referência válida para a conversa.';
  end if;

  if p_procedure_id is not null and not exists (
    select 1 from public.procedures
    where id = p_procedure_id and clinic_id = p_clinic_id and active = true
  ) then
    raise exception 'O procedimento selecionado não pertence à clínica ou está inativo.';
  end if;

  insert into public.sales_conversations (
    clinic_id,
    created_by,
    assigned_to,
    procedure_id,
    contact_label,
    channel
  ) values (
    p_clinic_id,
    auth.uid(),
    auth.uid(),
    p_procedure_id,
    trim(p_contact_label),
    p_channel
  )
  returning id into v_conversation_id;

  return v_conversation_id;
end;
$$;

create or replace function public.start_conversation_turn(
  p_conversation_id uuid,
  p_patient_message text,
  p_additional_context text default '',
  p_procedure_id uuid default null
)
returns table (interaction_id uuid, inbound_message_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conversation public.sales_conversations%rowtype;
  v_interaction_id uuid;
  v_message_id uuid;
  v_procedure_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Autenticação obrigatória.';
  end if;

  select * into v_conversation
  from public.sales_conversations
  where id = p_conversation_id
  for update;

  if not found then
    raise exception 'Conversa não encontrada.';
  end if;

  if not public.is_clinic_member(v_conversation.clinic_id) then
    raise exception 'Acesso negado.';
  end if;

  if v_conversation.status <> 'open' then
    raise exception 'Reabra a conversa antes de adicionar uma nova mensagem.';
  end if;

  if char_length(trim(coalesce(p_patient_message, ''))) < 2 then
    raise exception 'Informe uma mensagem válida.';
  end if;

  v_procedure_id := coalesce(p_procedure_id, v_conversation.procedure_id);

  if v_procedure_id is not null and not exists (
    select 1 from public.procedures
    where id = v_procedure_id
      and clinic_id = v_conversation.clinic_id
      and active = true
  ) then
    raise exception 'O procedimento selecionado não pertence à clínica ou está inativo.';
  end if;

  insert into public.spin_interactions (
    clinic_id,
    created_by,
    procedure_id,
    conversation_id,
    patient_message,
    additional_context,
    status,
    prompt_version
  ) values (
    v_conversation.clinic_id,
    auth.uid(),
    v_procedure_id,
    v_conversation.id,
    trim(p_patient_message),
    left(trim(coalesce(p_additional_context, '')), 6000),
    'processing',
    'spin-v2-conversation'
  )
  returning id into v_interaction_id;

  insert into public.conversation_messages (
    conversation_id,
    clinic_id,
    interaction_id,
    direction,
    status,
    content,
    created_by
  ) values (
    v_conversation.id,
    v_conversation.clinic_id,
    v_interaction_id,
    'patient',
    'received',
    trim(p_patient_message),
    auth.uid()
  )
  returning id into v_message_id;

  update public.sales_conversations
  set procedure_id = v_procedure_id,
      assigned_to = coalesce(assigned_to, auth.uid()),
      last_message_at = now()
  where id = v_conversation.id;

  return query select v_interaction_id, v_message_id;
end;
$$;

create or replace function public.complete_conversation_turn(
  p_interaction_id uuid,
  p_model_name text,
  p_analysis jsonb,
  p_plan jsonb,
  p_response jsonb,
  p_validation jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_interaction public.spin_interactions%rowtype;
  v_draft_message_id uuid;
begin
  select * into v_interaction
  from public.spin_interactions
  where id = p_interaction_id
  for update;

  if not found or v_interaction.conversation_id is null then
    raise exception 'Interação de conversa não encontrada.';
  end if;

  if v_interaction.created_by <> auth.uid() and not public.is_platform_admin() then
    raise exception 'Acesso negado.';
  end if;

  perform public.complete_spin_interaction(
    p_interaction_id,
    p_model_name,
    p_analysis,
    p_plan,
    p_response,
    p_validation
  );

  insert into public.conversation_messages (
    conversation_id,
    clinic_id,
    interaction_id,
    direction,
    status,
    content,
    created_by
  ) values (
    v_interaction.conversation_id,
    v_interaction.clinic_id,
    v_interaction.id,
    'clinic',
    'draft',
    trim(coalesce(p_response ->> 'primary_response', '')),
    auth.uid()
  )
  returning id into v_draft_message_id;

  update public.sales_conversations
  set interaction_stage = (p_analysis ->> 'interaction_stage')::public.sales_interaction_stage,
      spin_stage = (p_analysis ->> 'spin_stage')::public.spin_stage,
      summary = coalesce(p_analysis ->> 'summary', ''),
      explicit_need = coalesce(p_analysis ->> 'explicit_need', ''),
      implicit_need = coalesce(p_analysis ->> 'implicit_need', ''),
      objections = coalesce(array(select jsonb_array_elements_text(coalesce(p_analysis -> 'objections', '[]'::jsonb))), '{}'::text[]),
      emotional_state = coalesce(p_analysis ->> 'emotional_state', ''),
      missing_information = coalesce(array(select jsonb_array_elements_text(coalesce(p_analysis -> 'missing_information', '[]'::jsonb))), '{}'::text[]),
      risk_level = (p_analysis ->> 'risk_level')::public.spin_risk_level,
      next_objective = coalesce(p_plan ->> 'next_objective', ''),
      recommended_strategy = coalesce(p_plan ->> 'recommended_strategy', ''),
      last_message_at = now()
  where id = v_interaction.conversation_id;

  return v_draft_message_id;
end;
$$;

create or replace function public.mark_conversation_message_sent(
  p_message_id uuid,
  p_content text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_message public.conversation_messages%rowtype;
begin
  select * into v_message
  from public.conversation_messages
  where id = p_message_id
  for update;

  if not found then
    raise exception 'Mensagem não encontrada.';
  end if;

  if not public.is_clinic_member(v_message.clinic_id) then
    raise exception 'Acesso negado.';
  end if;

  if v_message.direction <> 'clinic' or v_message.status <> 'draft' then
    raise exception 'Somente um rascunho da clínica pode ser marcado como enviado.';
  end if;

  if char_length(trim(coalesce(p_content, ''))) < 2 then
    raise exception 'A mensagem enviada não pode ficar vazia.';
  end if;

  update public.conversation_messages
  set content = left(trim(p_content), 6000),
      status = 'sent',
      sent_at = now()
  where id = v_message.id;

  update public.sales_conversations
  set last_message_at = now()
  where id = v_message.conversation_id;
end;
$$;

create or replace function public.update_sales_conversation_status(
  p_conversation_id uuid,
  p_status public.sales_conversation_status
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clinic_id uuid;
begin
  select clinic_id into v_clinic_id
  from public.sales_conversations
  where id = p_conversation_id;

  if v_clinic_id is null then
    raise exception 'Conversa não encontrada.';
  end if;

  if not public.is_clinic_member(v_clinic_id) then
    raise exception 'Acesso negado.';
  end if;

  update public.sales_conversations
  set status = p_status
  where id = p_conversation_id;
end;
$$;

grant execute on function public.create_sales_conversation(uuid, text, public.sales_conversation_channel, uuid) to authenticated;
grant execute on function public.start_conversation_turn(uuid, text, text, uuid) to authenticated;
grant execute on function public.complete_conversation_turn(uuid, text, jsonb, jsonb, jsonb, jsonb) to authenticated;
grant execute on function public.mark_conversation_message_sent(uuid, text) to authenticated;
grant execute on function public.update_sales_conversation_status(uuid, public.sales_conversation_status) to authenticated;
