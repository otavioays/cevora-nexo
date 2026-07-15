-- Cevora Nexo · Iteração 9 · Funções seguras de ambientes e encaminhamentos

create or replace function public.update_clinic_member_function(
  p_member_id uuid,
  p_operational_role public.clinic_operational_role,
  p_professional_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member public.clinic_members%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Autenticação obrigatória.';
  end if;

  select * into v_member
  from public.clinic_members
  where id = p_member_id
  for update;

  if not found then
    raise exception 'Membro não encontrado.';
  end if;

  if not public.has_clinic_role(
    v_member.clinic_id,
    array['owner', 'manager']::public.clinic_role[]
  ) then
    raise exception 'Somente proprietários e gestores podem alterar a função operacional.';
  end if;

  update public.clinic_members
  set operational_role = p_operational_role,
      professional_id = case when p_operational_role = 'doctor' then p_professional_id else null end
  where id = v_member.id;
end;
$$;

create or replace function public.append_medical_referral_event(
  p_referral_id uuid,
  p_event_type public.medical_referral_event_type,
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
  v_referral public.medical_referrals%rowtype;
  v_actor uuid;
  v_event_id uuid;
begin
  select * into v_referral
  from public.medical_referrals
  where id = p_referral_id;

  if not found then
    raise exception 'Encaminhamento não encontrado.';
  end if;

  v_actor := coalesce(p_created_by, auth.uid());
  if v_actor is null then
    raise exception 'Não foi possível identificar o autor do evento.';
  end if;

  insert into public.medical_referral_events (
    referral_id,
    clinic_id,
    event_type,
    title,
    description,
    metadata,
    created_by
  ) values (
    v_referral.id,
    v_referral.clinic_id,
    p_event_type,
    left(trim(p_title), 180),
    left(trim(coalesce(p_description, '')), 6000),
    coalesce(p_metadata, '{}'::jsonb),
    v_actor
  ) returning id into v_event_id;

  return v_event_id;
end;
$$;

revoke all on function public.append_medical_referral_event(
  uuid, public.medical_referral_event_type, text, text, jsonb, uuid
) from public, anon, authenticated;

create or replace function public.create_medical_referral(
  p_clinic_id uuid,
  p_patient_id uuid,
  p_doctor_user_id uuid,
  p_title text,
  p_reason text default '',
  p_priority public.operational_task_priority default 'normal',
  p_due_at timestamptz default null,
  p_document_id uuid default null,
  p_conversation_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referral public.medical_referrals%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Autenticação obrigatória.';
  end if;

  if not public.is_clinic_member(p_clinic_id) then
    raise exception 'Acesso negado.';
  end if;

  if char_length(trim(coalesce(p_title, ''))) < 2 then
    raise exception 'Informe um título válido.';
  end if;

  if not exists (
    select 1
    from public.clinic_members
    where clinic_id = p_clinic_id
      and user_id = p_doctor_user_id
      and status = 'active'
      and operational_role = 'doctor'
  ) then
    raise exception 'Selecione um médico com acesso ativo.';
  end if;

  insert into public.medical_referrals (
    clinic_id,
    patient_id,
    document_id,
    conversation_id,
    requested_by,
    doctor_user_id,
    assigned_back_to,
    title,
    reason,
    priority,
    due_at
  ) values (
    p_clinic_id,
    p_patient_id,
    p_document_id,
    p_conversation_id,
    auth.uid(),
    p_doctor_user_id,
    auth.uid(),
    trim(p_title),
    left(trim(coalesce(p_reason, '')), 6000),
    p_priority,
    p_due_at
  ) returning * into v_referral;

  perform public.append_medical_referral_event(
    v_referral.id,
    'created',
    'Encaminhamento médico criado',
    v_referral.title,
    jsonb_build_object(
      'doctor_user_id', v_referral.doctor_user_id,
      'priority', v_referral.priority,
      'due_at', v_referral.due_at,
      'document_id', v_referral.document_id,
      'conversation_id', v_referral.conversation_id
    ),
    auth.uid()
  );

  perform public.append_patient_timeline_event(
    v_referral.patient_id,
    v_referral.clinic_id,
    'medical_referral_created',
    'Encaminhamento para revisão médica',
    v_referral.title,
    jsonb_build_object('referral_id', v_referral.id, 'doctor_user_id', v_referral.doctor_user_id),
    auth.uid()
  );

  return v_referral.id;
end;
$$;

create or replace function public.update_medical_referral(
  p_referral_id uuid,
  p_status public.medical_referral_status,
  p_medical_response text default '',
  p_doctor_user_id uuid default null,
  p_due_at timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referral public.medical_referrals%rowtype;
  v_is_management boolean;
  v_is_doctor boolean;
  v_is_requester boolean;
  v_next_doctor uuid;
  v_status_changed boolean;
begin
  if auth.uid() is null then
    raise exception 'Autenticação obrigatória.';
  end if;

  select * into v_referral
  from public.medical_referrals
  where id = p_referral_id
  for update;

  if not found then
    raise exception 'Encaminhamento não encontrado.';
  end if;

  v_is_management := public.has_clinic_role(
    v_referral.clinic_id,
    array['owner', 'manager']::public.clinic_role[]
  );
  v_is_doctor := v_referral.doctor_user_id = auth.uid()
    and public.has_operational_role(
      v_referral.clinic_id,
      array['doctor']::public.clinic_operational_role[]
    );
  v_is_requester := v_referral.requested_by = auth.uid();
  v_next_doctor := coalesce(p_doctor_user_id, v_referral.doctor_user_id);

  if not (v_is_management or v_is_doctor or v_is_requester) then
    raise exception 'Acesso negado.';
  end if;

  if v_next_doctor <> v_referral.doctor_user_id and not v_is_management then
    raise exception 'Somente proprietários e gestores podem reatribuir o médico.';
  end if;

  if not exists (
    select 1
    from public.clinic_members
    where clinic_id = v_referral.clinic_id
      and user_id = v_next_doctor
      and status = 'active'
      and operational_role = 'doctor'
  ) then
    raise exception 'O médico selecionado não possui um acesso médico ativo.';
  end if;

  if v_is_requester and not v_is_management and not v_is_doctor then
    if p_status <> 'cancelled' or v_referral.status not in ('pending', 'returned') then
      raise exception 'O solicitante só pode cancelar encaminhamentos pendentes ou devolvidos.';
    end if;
  end if;

  if v_is_doctor and not v_is_management then
    if p_status not in ('in_review', 'returned', 'approved_operationally', 'signed') then
      raise exception 'Esta mudança de estado não está disponível no ambiente médico.';
    end if;
  end if;

  if p_status in ('returned', 'approved_operationally', 'signed')
    and char_length(trim(coalesce(p_medical_response, ''))) < 2 then
    raise exception 'Registre uma orientação antes de concluir esta etapa.';
  end if;

  v_status_changed := v_referral.status <> p_status;

  update public.medical_referrals
  set doctor_user_id = v_next_doctor,
      status = p_status,
      medical_response = case
        when trim(coalesce(p_medical_response, '')) <> '' then left(trim(p_medical_response), 6000)
        else medical_response
      end,
      due_at = p_due_at,
      assigned_back_to = case
        when p_status in ('returned', 'approved_operationally', 'signed') then requested_by
        else assigned_back_to
      end,
      reviewed_at = case
        when p_status in ('in_review', 'returned', 'approved_operationally', 'signed') then coalesce(reviewed_at, now())
        else reviewed_at
      end,
      completed_at = case
        when p_status in ('approved_operationally', 'signed') then coalesce(completed_at, now())
        else null
      end,
      cancelled_at = case when p_status = 'cancelled' then coalesce(cancelled_at, now()) else null end
  where id = v_referral.id;

  perform public.append_medical_referral_event(
    v_referral.id,
    case
      when v_next_doctor <> v_referral.doctor_user_id then 'assigned'
      when v_status_changed then 'status_changed'
      else 'response'
    end,
    case
      when v_next_doctor <> v_referral.doctor_user_id then 'Médico reatribuído'
      when v_status_changed then 'Status do encaminhamento atualizado'
      else 'Orientação atualizada'
    end,
    case
      when v_status_changed then format('O encaminhamento mudou de %s para %s.', v_referral.status, p_status)
      else left(trim(coalesce(p_medical_response, '')), 6000)
    end,
    jsonb_build_object(
      'from_status', v_referral.status,
      'to_status', p_status,
      'from_doctor_user_id', v_referral.doctor_user_id,
      'to_doctor_user_id', v_next_doctor,
      'due_at', p_due_at
    ),
    auth.uid()
  );

  if v_status_changed then
    perform public.append_patient_timeline_event(
      v_referral.patient_id,
      v_referral.clinic_id,
      'medical_referral_status',
      'Encaminhamento médico atualizado',
      format('%s · %s', v_referral.title, p_status),
      jsonb_build_object('referral_id', v_referral.id, 'from', v_referral.status, 'to', p_status),
      auth.uid()
    );
  end if;
end;
$$;

create or replace function public.add_medical_referral_note(
  p_referral_id uuid,
  p_note text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referral public.medical_referrals%rowtype;
  v_can_access boolean;
begin
  if auth.uid() is null then
    raise exception 'Autenticação obrigatória.';
  end if;

  select * into v_referral
  from public.medical_referrals
  where id = p_referral_id;

  if not found then
    raise exception 'Encaminhamento não encontrado.';
  end if;

  v_can_access := public.has_clinic_role(
      v_referral.clinic_id,
      array['owner', 'manager']::public.clinic_role[]
    )
    or v_referral.requested_by = auth.uid()
    or v_referral.doctor_user_id = auth.uid()
    or v_referral.assigned_back_to = auth.uid();

  if not v_can_access then
    raise exception 'Acesso negado.';
  end if;

  if char_length(trim(coalesce(p_note, ''))) < 2 then
    raise exception 'Escreva uma nota válida.';
  end if;

  return public.append_medical_referral_event(
    v_referral.id,
    'note',
    'Nota interna',
    left(trim(p_note), 6000),
    '{}'::jsonb,
    auth.uid()
  );
end;
$$;

grant execute on function public.update_clinic_member_function(
  uuid, public.clinic_operational_role, uuid
) to authenticated;
grant execute on function public.create_medical_referral(
  uuid, uuid, uuid, text, text, public.operational_task_priority, timestamptz, uuid, uuid
) to authenticated;
grant execute on function public.update_medical_referral(
  uuid, public.medical_referral_status, text, uuid, timestamptz
) to authenticated;
grant execute on function public.add_medical_referral_note(uuid, text) to authenticated;
