-- Cevora Nexo · Iteração 6 · Funções seguras da Central de Documentos

create or replace function public.append_patient_document_event(
  p_document_id uuid,
  p_event_type public.patient_document_event_type,
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
  v_document public.patient_documents%rowtype;
  v_event_id uuid;
  v_actor uuid;
begin
  select * into v_document
  from public.patient_documents
  where id = p_document_id;

  if not found then
    raise exception 'Documento não encontrado.';
  end if;

  v_actor := coalesce(p_created_by, auth.uid());
  if v_actor is null then
    raise exception 'Não foi possível identificar o autor do evento.';
  end if;

  insert into public.patient_document_events (
    document_id,
    patient_id,
    clinic_id,
    event_type,
    title,
    description,
    metadata,
    created_by
  ) values (
    v_document.id,
    v_document.patient_id,
    v_document.clinic_id,
    p_event_type,
    left(trim(p_title), 180),
    left(trim(coalesce(p_description, '')), 6000),
    coalesce(p_metadata, '{}'::jsonb),
    v_actor
  ) returning id into v_event_id;

  update public.patients
  set last_activity_at = now()
  where id = v_document.patient_id and clinic_id = v_document.clinic_id;

  return v_event_id;
end;
$$;

revoke all on function public.append_patient_document_event(
  uuid, public.patient_document_event_type, text, text, jsonb, uuid
) from public, anon, authenticated;

create or replace function public.create_patient_document(
  p_patient_id uuid,
  p_document_type public.patient_document_type,
  p_title text,
  p_description text default '',
  p_professional_id uuid default null,
  p_procedure_id uuid default null,
  p_assigned_to uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_patient public.patients%rowtype;
  v_document_id uuid;
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

  if char_length(trim(coalesce(p_title, ''))) < 2 then
    raise exception 'Informe um título válido.';
  end if;

  if p_assigned_to is not null and not exists (
    select 1 from public.clinic_members
    where clinic_id = v_patient.clinic_id
      and user_id = p_assigned_to
      and status = 'active'
  ) then
    raise exception 'O responsável selecionado não pertence à equipe ativa.';
  end if;

  if p_professional_id is not null and not exists (
    select 1 from public.professionals
    where id = p_professional_id
      and clinic_id = v_patient.clinic_id
      and active = true
  ) then
    raise exception 'O profissional selecionado não pertence à clínica ou está inativo.';
  end if;

  if p_procedure_id is not null and not exists (
    select 1 from public.procedures
    where id = p_procedure_id
      and clinic_id = v_patient.clinic_id
      and active = true
  ) then
    raise exception 'O procedimento selecionado não pertence à clínica ou está inativo.';
  end if;

  insert into public.patient_documents (
    clinic_id,
    patient_id,
    created_by,
    assigned_to,
    professional_id,
    procedure_id,
    document_type,
    title,
    description
  ) values (
    v_patient.clinic_id,
    v_patient.id,
    auth.uid(),
    p_assigned_to,
    p_professional_id,
    p_procedure_id,
    p_document_type,
    trim(p_title),
    left(trim(coalesce(p_description, '')), 6000)
  ) returning id into v_document_id;

  perform public.append_patient_document_event(
    v_document_id,
    'created',
    'Documento criado',
    trim(p_title),
    jsonb_build_object('document_type', p_document_type),
    auth.uid()
  );

  perform public.append_patient_timeline_event(
    v_patient.id,
    v_patient.clinic_id,
    'document_created',
    'Documento criado',
    trim(p_title),
    jsonb_build_object('document_id', v_document_id, 'document_type', p_document_type),
    auth.uid()
  );

  return v_document_id;
end;
$$;

create or replace function public.attach_patient_document_file(
  p_document_id uuid,
  p_file_name text,
  p_storage_path text,
  p_mime_type text,
  p_size_bytes bigint
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_document public.patient_documents%rowtype;
  v_expected_prefix text;
begin
  if auth.uid() is null then
    raise exception 'Autenticação obrigatória.';
  end if;

  select * into v_document
  from public.patient_documents
  where id = p_document_id
  for update;

  if not found then
    raise exception 'Documento não encontrado.';
  end if;

  if not public.is_clinic_member(v_document.clinic_id) then
    raise exception 'Acesso negado.';
  end if;

  if v_document.status in ('sent', 'viewed', 'cancelled') then
    raise exception 'O arquivo não pode ser alterado neste estágio.';
  end if;

  if v_document.storage_path <> '' then
    raise exception 'Este documento já possui um arquivo anexado.';
  end if;

  if p_mime_type not in ('application/pdf', 'image/jpeg', 'image/png') then
    raise exception 'Formato de arquivo não permitido.';
  end if;

  if p_size_bytes <= 0 or p_size_bytes > 15728640 then
    raise exception 'O arquivo deve possuir no máximo 15 MB.';
  end if;

  v_expected_prefix := format('%s/%s/%s/', v_document.clinic_id, v_document.patient_id, v_document.id);
  if left(p_storage_path, char_length(v_expected_prefix)) <> v_expected_prefix then
    raise exception 'Caminho de armazenamento inválido.';
  end if;

  update public.patient_documents
  set file_name = left(trim(p_file_name), 255),
      storage_path = left(trim(p_storage_path), 1000),
      mime_type = p_mime_type,
      size_bytes = p_size_bytes
  where id = v_document.id;

  perform public.append_patient_document_event(
    v_document.id,
    'file_uploaded',
    'Arquivo anexado',
    left(trim(p_file_name), 255),
    jsonb_build_object('mime_type', p_mime_type, 'size_bytes', p_size_bytes),
    auth.uid()
  );
end;
$$;

create or replace function public.update_patient_document_status(
  p_document_id uuid,
  p_status public.patient_document_status
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_document public.patient_documents%rowtype;
  v_is_management boolean;
begin
  if auth.uid() is null then
    raise exception 'Autenticação obrigatória.';
  end if;

  select * into v_document
  from public.patient_documents
  where id = p_document_id
  for update;

  if not found then
    raise exception 'Documento não encontrado.';
  end if;

  if not public.is_clinic_member(v_document.clinic_id) then
    raise exception 'Acesso negado.';
  end if;

  if v_document.status = p_status then
    return;
  end if;

  v_is_management := public.has_clinic_role(
    v_document.clinic_id,
    array['owner', 'manager']::public.clinic_role[]
  );

  if p_status = 'cancelled' then
    if not v_is_management then
      raise exception 'Somente proprietários e gestores podem cancelar documentos.';
    end if;
    if v_document.status = 'viewed' then
      raise exception 'Um documento visualizado não pode ser cancelado.';
    end if;
  elsif v_document.status = 'created' and p_status = 'awaiting_signature' then
    if v_document.storage_path = '' then
      raise exception 'Anexe o arquivo antes de solicitar assinatura.';
    end if;
  elsif v_document.status = 'created' and p_status = 'ready_to_send' then
    if not v_is_management then
      raise exception 'Somente proprietários e gestores podem confirmar que o documento está pronto.';
    end if;
    if v_document.storage_path = '' then
      raise exception 'Anexe o arquivo antes de liberá-lo para envio.';
    end if;
  elsif v_document.status = 'awaiting_signature' and p_status = 'ready_to_send' then
    if not v_is_management then
      raise exception 'Somente proprietários e gestores podem confirmar a assinatura.';
    end if;
    if v_document.storage_path = '' then
      raise exception 'O documento não possui arquivo anexado.';
    end if;
  elsif v_document.status in ('awaiting_signature', 'ready_to_send') and p_status = 'created' then
    if not v_is_management then
      raise exception 'Somente proprietários e gestores podem devolver o documento para correção.';
    end if;
  elsif v_document.status = 'ready_to_send' and p_status = 'sent' then
    if v_document.storage_path = '' then
      raise exception 'O documento não possui arquivo anexado.';
    end if;
  elsif v_document.status = 'sent' and p_status = 'viewed' then
    null;
  else
    raise exception 'Transição de status inválida: % para %.', v_document.status, p_status;
  end if;

  update public.patient_documents
  set status = p_status,
      sent_at = case when p_status = 'sent' then now() else sent_at end,
      viewed_at = case when p_status = 'viewed' then now() else viewed_at end,
      cancelled_at = case when p_status = 'cancelled' then now() else cancelled_at end
  where id = v_document.id;

  perform public.append_patient_document_event(
    v_document.id,
    'status_changed',
    'Status atualizado',
    format('O documento mudou de %s para %s.', v_document.status, p_status),
    jsonb_build_object('from', v_document.status, 'to', p_status),
    auth.uid()
  );

  perform public.append_patient_timeline_event(
    v_document.patient_id,
    v_document.clinic_id,
    'document_status',
    'Documento atualizado',
    format('%s · %s', v_document.title, p_status),
    jsonb_build_object('document_id', v_document.id, 'from', v_document.status, 'to', p_status),
    auth.uid()
  );
end;
$$;

create or replace function public.add_patient_document_note(
  p_document_id uuid,
  p_note text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_document public.patient_documents%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Autenticação obrigatória.';
  end if;

  select * into v_document
  from public.patient_documents
  where id = p_document_id;

  if not found then
    raise exception 'Documento não encontrado.';
  end if;

  if not public.is_clinic_member(v_document.clinic_id) then
    raise exception 'Acesso negado.';
  end if;

  if char_length(trim(coalesce(p_note, ''))) < 2 then
    raise exception 'Escreva uma nota válida.';
  end if;

  return public.append_patient_document_event(
    v_document.id,
    'note',
    'Nota interna',
    left(trim(p_note), 6000),
    '{}'::jsonb,
    auth.uid()
  );
end;
$$;

create or replace function public.log_patient_document_download(
  p_document_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_document public.patient_documents%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Autenticação obrigatória.';
  end if;

  select * into v_document
  from public.patient_documents
  where id = p_document_id;

  if not found or v_document.storage_path = '' then
    raise exception 'Arquivo não encontrado.';
  end if;

  if not public.is_clinic_member(v_document.clinic_id) then
    raise exception 'Acesso negado.';
  end if;

  return public.append_patient_document_event(
    v_document.id,
    'downloaded',
    'Arquivo acessado',
    v_document.file_name,
    '{}'::jsonb,
    auth.uid()
  );
end;
$$;

grant execute on function public.create_patient_document(
  uuid, public.patient_document_type, text, text, uuid, uuid, uuid
) to authenticated;
grant execute on function public.attach_patient_document_file(uuid, text, text, text, bigint) to authenticated;
grant execute on function public.update_patient_document_status(uuid, public.patient_document_status) to authenticated;
grant execute on function public.add_patient_document_note(uuid, text) to authenticated;
grant execute on function public.log_patient_document_download(uuid) to authenticated;