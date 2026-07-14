-- Cevora Nexo · Iteração 5 · Funções seguras de pacientes e linha do tempo

create or replace function public.append_patient_timeline_event(
  p_patient_id uuid,
  p_clinic_id uuid,
  p_event_type public.patient_timeline_event_type,
  p_title text,
  p_description text default '',
  p_metadata jsonb default '{}'::jsonb,
  p_created_by uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
  v_actor uuid;
begin
  if not exists (
    select 1 from public.patients
    where id = p_patient_id and clinic_id = p_clinic_id
  ) then
    raise exception 'Paciente não encontrado.';
  end if;

  v_actor := coalesce(p_created_by, auth.uid());
  if v_actor is null then
    raise exception 'Não foi possível identificar o autor do evento.';
  end if;

  insert into public.patient_timeline_events (
    patient_id,
    clinic_id,
    event_type,
    title,
    description,
    metadata,
    created_by
  ) values (
    p_patient_id,
    p_clinic_id,
    p_event_type,
    left(trim(p_title), 180),
    left(trim(coalesce(p_description, '')), 6000),
    coalesce(p_metadata, '{}'::jsonb),
    v_actor
  ) returning id into v_event_id;

  update public.patients
  set last_activity_at = now()
  where id = p_patient_id and clinic_id = p_clinic_id;

  return v_event_id;
end;
$$;

revoke all on function public.append_patient_timeline_event(
  uuid, uuid, public.patient_timeline_event_type, text, text, jsonb, uuid
) from public, anon, authenticated;

create or replace function public.create_patient(
  p_clinic_id uuid,
  p_reference_label text,
  p_status public.patient_status default 'lead',
  p_source text default '',
  p_assigned_to uuid default null,
  p_internal_notes text default ''
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_patient_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Autenticação obrigatória.';
  end if;

  if not public.is_clinic_member(p_clinic_id) then
    raise exception 'Você não pertence a esta clínica.';
  end if;

  if char_length(trim(coalesce(p_reference_label, ''))) < 2 then
    raise exception 'Informe uma referência válida para o paciente.';
  end if;

  if p_assigned_to is not null and not exists (
    select 1 from public.clinic_members
    where clinic_id = p_clinic_id
      and user_id = p_assigned_to
      and status = 'active'
  ) then
    raise exception 'O responsável selecionado não pertence à equipe ativa.';
  end if;

  insert into public.patients (
    clinic_id,
    created_by,
    assigned_to,
    reference_label,
    status,
    source,
    internal_notes
  ) values (
    p_clinic_id,
    auth.uid(),
    p_assigned_to,
    trim(p_reference_label),
    p_status,
    left(trim(coalesce(p_source, '')), 180),
    left(trim(coalesce(p_internal_notes, '')), 6000)
  ) returning id into v_patient_id;

  perform public.append_patient_timeline_event(
    v_patient_id,
    p_clinic_id,
    'created',
    'Registro criado',
    'O paciente/lead foi adicionado à memória comercial.',
    jsonb_build_object('status', p_status, 'source', left(trim(coalesce(p_source, '')), 180)),
    auth.uid()
  );

  return v_patient_id;
end;
$$;

create or replace function public.update_patient_record(
  p_patient_id uuid,
  p_reference_label text,
  p_status public.patient_status,
  p_source text,
  p_assigned_to uuid,
  p_internal_notes text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_patient public.patients%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Autenticação obrigatória.';
  end if;

  select * into v_patient
  from public.patients
  where id = p_patient_id
  for update;

  if not found then
    raise exception 'Paciente não encontrado.';
  end if;

  if not public.is_clinic_member(v_patient.clinic_id) then
    raise exception 'Acesso negado.';
  end if;

  if char_length(trim(coalesce(p_reference_label, ''))) < 2 then
    raise exception 'Informe uma referência válida para o paciente.';
  end if;

  if p_assigned_to is not null and not exists (
    select 1 from public.clinic_members
    where clinic_id = v_patient.clinic_id
      and user_id = p_assigned_to
      and status = 'active'
  ) then
    raise exception 'O responsável selecionado não pertence à equipe ativa.';
  end if;

  update public.patients
  set reference_label = trim(p_reference_label),
      status = p_status,
      source = left(trim(coalesce(p_source, '')), 180),
      assigned_to = p_assigned_to,
      internal_notes = left(trim(coalesce(p_internal_notes, '')), 6000),
      last_activity_at = now()
  where id = v_patient.id;

  if v_patient.status is distinct from p_status then
    perform public.append_patient_timeline_event(
      v_patient.id,
      v_patient.clinic_id,
      'status_change',
      'Estágio atualizado',
      format('O estágio mudou de %s para %s.', v_patient.status, p_status),
      jsonb_build_object('from', v_patient.status, 'to', p_status),
      auth.uid()
    );
  else
    perform public.append_patient_timeline_event(
      v_patient.id,
      v_patient.clinic_id,
      'profile_update',
      'Cadastro atualizado',
      'Referência, origem, responsável ou observações internas foram revisados.',
      '{}'::jsonb,
      auth.uid()
    );
  end if;
end;
$$;

create or replace function public.add_patient_note(
  p_patient_id uuid,
  p_note text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_patient public.patients%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Autenticação obrigatória.';
  end if;

  select * into v_patient
  from public.patients
  where id = p_patient_id;

  if not found then
    raise exception 'Paciente não encontrado.';
  end if;

  if not public.is_clinic_member(v_patient.clinic_id) then
    raise exception 'Acesso negado.';
  end if;

  if char_length(trim(coalesce(p_note, ''))) < 2 then
    raise exception 'Escreva uma nota válida.';
  end if;

  return public.append_patient_timeline_event(
    v_patient.id,
    v_patient.clinic_id,
    'note',
    'Nota interna',
    left(trim(p_note), 6000),
    '{}'::jsonb,
    auth.uid()
  );
end;
$$;

create or replace function public.upsert_patient_procedure_interest(
  p_patient_id uuid,
  p_procedure_id uuid,
  p_status public.patient_procedure_status default 'interested',
  p_notes text default ''
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_patient public.patients%rowtype;
  v_procedure_name text;
  v_interest_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Autenticação obrigatória.';
  end if;

  select * into v_patient
  from public.patients
  where id = p_patient_id;

  if not found then
    raise exception 'Paciente não encontrado.';
  end if;

  if not public.is_clinic_member(v_patient.clinic_id) then
    raise exception 'Acesso negado.';
  end if;

  select name into v_procedure_name
  from public.procedures
  where id = p_procedure_id
    and clinic_id = v_patient.clinic_id
    and active = true;

  if v_procedure_name is null then
    raise exception 'O procedimento selecionado não pertence à clínica ou está inativo.';
  end if;

  insert into public.patient_procedure_interests (
    patient_id,
    clinic_id,
    procedure_id,
    status,
    notes,
    created_by
  ) values (
    v_patient.id,
    v_patient.clinic_id,
    p_procedure_id,
    p_status,
    left(trim(coalesce(p_notes, '')), 3000),
    auth.uid()
  )
  on conflict (patient_id, procedure_id)
  do update set
    status = excluded.status,
    notes = excluded.notes
  returning id into v_interest_id;

  perform public.append_patient_timeline_event(
    v_patient.id,
    v_patient.clinic_id,
    'procedure_interest',
    'Interesse em procedimento atualizado',
    format('%s · estágio %s', v_procedure_name, p_status),
    jsonb_build_object('procedure_id', p_procedure_id, 'procedure_name', v_procedure_name, 'status', p_status),
    auth.uid()
  );

  return v_interest_id;
end;
$$;

create or replace function public.link_sales_conversation_patient(
  p_conversation_id uuid,
  p_patient_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conversation public.sales_conversations%rowtype;
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

  if p_patient_id is not null and not exists (
    select 1 from public.patients
    where id = p_patient_id and clinic_id = v_conversation.clinic_id
  ) then
    raise exception 'O paciente selecionado não pertence à clínica.';
  end if;

  update public.sales_conversations
  set patient_id = p_patient_id
  where id = v_conversation.id;
end;
$$;

create or replace function public.create_sales_conversation_with_patient(
  p_clinic_id uuid,
  p_contact_label text,
  p_channel public.sales_conversation_channel default 'whatsapp',
  p_procedure_id uuid default null,
  p_patient_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conversation_id uuid;
begin
  if p_patient_id is not null and not exists (
    select 1 from public.patients
    where id = p_patient_id and clinic_id = p_clinic_id
  ) then
    raise exception 'O paciente selecionado não pertence à clínica.';
  end if;

  v_conversation_id := public.create_sales_conversation(
    p_clinic_id,
    p_contact_label,
    p_channel,
    p_procedure_id
  );

  if p_patient_id is not null then
    perform public.link_sales_conversation_patient(v_conversation_id, p_patient_id);
  end if;

  return v_conversation_id;
end;
$$;

create or replace function public.sync_patient_from_conversation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid;
begin
  v_actor := coalesce(auth.uid(), new.created_by);

  if old.patient_id is distinct from new.patient_id then
    if old.patient_id is not null then
      perform public.append_patient_timeline_event(
        old.patient_id,
        new.clinic_id,
        'conversation_unlinked',
        'Conversa desvinculada',
        old.contact_label,
        jsonb_build_object('conversation_id', new.id),
        v_actor
      );
    end if;

    if new.patient_id is not null then
      perform public.append_patient_timeline_event(
        new.patient_id,
        new.clinic_id,
        'conversation_linked',
        'Conversa vinculada',
        new.contact_label,
        jsonb_build_object('conversation_id', new.id, 'channel', new.channel),
        v_actor
      );
    end if;
  end if;

  if new.patient_id is not null then
    update public.patients
    set last_activity_at = greatest(last_activity_at, new.last_message_at)
    where id = new.patient_id and clinic_id = new.clinic_id;

    if old.status is distinct from new.status then
      perform public.append_patient_timeline_event(
        new.patient_id,
        new.clinic_id,
        'conversation_outcome',
        'Status da conversa atualizado',
        format('%s · %s', new.contact_label, new.status),
        jsonb_build_object('conversation_id', new.id, 'from', old.status, 'to', new.status),
        v_actor
      );
    end if;
  end if;

  return new;
end;
$$;

create trigger sales_conversations_sync_patient
  after update of patient_id, last_message_at, status on public.sales_conversations
  for each row execute function public.sync_patient_from_conversation();

grant execute on function public.create_patient(uuid, text, public.patient_status, text, uuid, text) to authenticated;
grant execute on function public.update_patient_record(uuid, text, public.patient_status, text, uuid, text) to authenticated;
grant execute on function public.add_patient_note(uuid, text) to authenticated;
grant execute on function public.upsert_patient_procedure_interest(uuid, uuid, public.patient_procedure_status, text) to authenticated;
grant execute on function public.link_sales_conversation_patient(uuid, uuid) to authenticated;
grant execute on function public.create_sales_conversation_with_patient(uuid, text, public.sales_conversation_channel, uuid, uuid) to authenticated;
