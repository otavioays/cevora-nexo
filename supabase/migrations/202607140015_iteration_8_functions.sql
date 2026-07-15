-- Cevora Nexo · Iteração 8 · Funções seguras da fila operacional

create or replace function public.append_operational_task_event(
  p_task_id uuid,
  p_event_type public.operational_task_event_type,
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
  v_task public.operational_tasks%rowtype;
  v_event_id uuid;
  v_actor uuid;
begin
  select * into v_task
  from public.operational_tasks
  where id = p_task_id;

  if not found then
    raise exception 'Tarefa não encontrada.';
  end if;

  v_actor := coalesce(p_created_by, auth.uid());
  if v_actor is null then
    raise exception 'Não foi possível identificar o autor do evento.';
  end if;

  insert into public.operational_task_events (
    task_id,
    clinic_id,
    event_type,
    title,
    description,
    metadata,
    created_by
  ) values (
    v_task.id,
    v_task.clinic_id,
    p_event_type,
    left(trim(p_title), 180),
    left(trim(coalesce(p_description, '')), 6000),
    coalesce(p_metadata, '{}'::jsonb),
    v_actor
  ) returning id into v_event_id;

  return v_event_id;
end;
$$;

revoke all on function public.append_operational_task_event(
  uuid, public.operational_task_event_type, text, text, jsonb, uuid
) from public, anon, authenticated;

create or replace function public.create_operational_task(
  p_clinic_id uuid,
  p_title text,
  p_description text default '',
  p_priority public.operational_task_priority default 'normal',
  p_due_at timestamptz default null,
  p_assigned_to uuid default null,
  p_patient_id uuid default null,
  p_conversation_id uuid default null,
  p_document_id uuid default null,
  p_source public.operational_task_source default 'manual'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task public.operational_tasks%rowtype;
  v_existing_id uuid;
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

  if p_source <> 'manual' and (p_conversation_id is not null or p_document_id is not null) then
    select id into v_existing_id
    from public.operational_tasks
    where clinic_id = p_clinic_id
      and status in ('open', 'in_progress')
      and (
        (p_conversation_id is not null and conversation_id = p_conversation_id)
        or (p_document_id is not null and document_id = p_document_id)
      )
    order by created_at desc
    limit 1;

    if v_existing_id is not null then
      return v_existing_id;
    end if;
  end if;

  insert into public.operational_tasks (
    clinic_id,
    patient_id,
    conversation_id,
    document_id,
    created_by,
    assigned_to,
    source,
    title,
    description,
    priority,
    due_at
  ) values (
    p_clinic_id,
    p_patient_id,
    p_conversation_id,
    p_document_id,
    auth.uid(),
    p_assigned_to,
    p_source,
    trim(p_title),
    left(trim(coalesce(p_description, '')), 6000),
    p_priority,
    p_due_at
  ) returning * into v_task;

  perform public.append_operational_task_event(
    v_task.id,
    'created',
    'Tarefa criada',
    v_task.title,
    jsonb_build_object(
      'priority', v_task.priority,
      'due_at', v_task.due_at,
      'source', v_task.source
    ),
    auth.uid()
  );

  if v_task.patient_id is not null then
    perform public.append_patient_timeline_event(
      v_task.patient_id,
      v_task.clinic_id,
      'task_created',
      'Tarefa operacional criada',
      v_task.title,
      jsonb_build_object('task_id', v_task.id, 'priority', v_task.priority),
      auth.uid()
    );
  end if;

  return v_task.id;
end;
$$;

create or replace function public.update_operational_task(
  p_task_id uuid,
  p_title text,
  p_description text,
  p_status public.operational_task_status,
  p_priority public.operational_task_priority,
  p_due_at timestamptz,
  p_assigned_to uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task public.operational_tasks%rowtype;
  v_is_management boolean;
  v_status_changed boolean;
begin
  if auth.uid() is null then
    raise exception 'Autenticação obrigatória.';
  end if;

  select * into v_task
  from public.operational_tasks
  where id = p_task_id
  for update;

  if not found then
    raise exception 'Tarefa não encontrada.';
  end if;

  if not public.is_clinic_member(v_task.clinic_id) then
    raise exception 'Acesso negado.';
  end if;

  if char_length(trim(coalesce(p_title, ''))) < 2 then
    raise exception 'Informe um título válido.';
  end if;

  v_is_management := public.has_clinic_role(
    v_task.clinic_id,
    array['owner', 'manager']::public.clinic_role[]
  );

  if p_status = 'cancelled' and not v_is_management then
    raise exception 'Somente proprietários e gestores podem cancelar tarefas.';
  end if;

  if v_task.status = 'cancelled' and p_status <> 'cancelled' and not v_is_management then
    raise exception 'Somente proprietários e gestores podem reabrir uma tarefa cancelada.';
  end if;

  v_status_changed := v_task.status <> p_status;

  update public.operational_tasks
  set title = trim(p_title),
      description = left(trim(coalesce(p_description, '')), 6000),
      status = p_status,
      priority = p_priority,
      due_at = p_due_at,
      assigned_to = p_assigned_to,
      completed_at = case when p_status = 'completed' then coalesce(completed_at, now()) else null end,
      cancelled_at = case when p_status = 'cancelled' then coalesce(cancelled_at, now()) else null end
  where id = v_task.id;

  perform public.append_operational_task_event(
    v_task.id,
    case when v_status_changed then 'status_changed' else 'updated' end,
    case when v_status_changed then 'Status da tarefa atualizado' else 'Tarefa atualizada' end,
    case
      when v_status_changed then format('A tarefa mudou de %s para %s.', v_task.status, p_status)
      else trim(p_title)
    end,
    jsonb_build_object(
      'from_status', v_task.status,
      'to_status', p_status,
      'priority', p_priority,
      'due_at', p_due_at,
      'assigned_to', p_assigned_to
    ),
    auth.uid()
  );

  if v_status_changed and v_task.patient_id is not null then
    perform public.append_patient_timeline_event(
      v_task.patient_id,
      v_task.clinic_id,
      'task_status',
      'Tarefa operacional atualizada',
      format('%s · %s', trim(p_title), p_status),
      jsonb_build_object('task_id', v_task.id, 'from', v_task.status, 'to', p_status),
      auth.uid()
    );
  end if;
end;
$$;

create or replace function public.add_operational_task_note(
  p_task_id uuid,
  p_note text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task public.operational_tasks%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Autenticação obrigatória.';
  end if;

  select * into v_task
  from public.operational_tasks
  where id = p_task_id;

  if not found then
    raise exception 'Tarefa não encontrada.';
  end if;

  if not public.is_clinic_member(v_task.clinic_id) then
    raise exception 'Acesso negado.';
  end if;

  if char_length(trim(coalesce(p_note, ''))) < 2 then
    raise exception 'Escreva uma nota válida.';
  end if;

  return public.append_operational_task_event(
    v_task.id,
    'note',
    'Nota interna',
    left(trim(p_note), 6000),
    '{}'::jsonb,
    auth.uid()
  );
end;
$$;

grant execute on function public.create_operational_task(
  uuid, text, text, public.operational_task_priority, timestamptz, uuid, uuid, uuid, uuid, public.operational_task_source
) to authenticated;
grant execute on function public.update_operational_task(
  uuid, text, text, public.operational_task_status, public.operational_task_priority, timestamptz, uuid
) to authenticated;
grant execute on function public.add_operational_task_note(uuid, text) to authenticated;
