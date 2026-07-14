-- Cevora Nexo · Iteração 7 · Persistência segura da inteligência documental

create or replace function public.save_patient_document_ai_analysis(
  p_document_id uuid,
  p_provider text,
  p_model text,
  p_result jsonb,
  p_privacy_confirmation text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_document public.patient_documents%rowtype;
  v_analysis_id uuid;
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

  if v_document.storage_path = '' then
    raise exception 'Anexe um arquivo antes de solicitar a análise.';
  end if;

  if v_document.status = 'cancelled' then
    raise exception 'Documentos cancelados não podem ser analisados.';
  end if;

  if p_privacy_confirmation <> 'fictitious_or_anonymized' then
    raise exception 'Confirme que o arquivo é fictício ou anonimizado.';
  end if;

  if jsonb_typeof(p_result) <> 'object' then
    raise exception 'Resultado de análise inválido.';
  end if;

  insert into public.patient_document_ai_analyses (
    document_id,
    patient_id,
    clinic_id,
    requested_by,
    provider,
    model,
    privacy_confirmation,
    result
  ) values (
    v_document.id,
    v_document.patient_id,
    v_document.clinic_id,
    auth.uid(),
    left(trim(p_provider), 40),
    left(trim(p_model), 160),
    p_privacy_confirmation,
    p_result
  ) returning id into v_analysis_id;

  perform public.append_patient_document_event(
    v_document.id,
    'ai_analysis_completed',
    'Pré-análise assistida concluída',
    'O arquivo recebeu uma revisão operacional por IA. A revisão humana continua obrigatória.',
    jsonb_build_object(
      'analysis_id', v_analysis_id,
      'provider', left(trim(p_provider), 40),
      'model', left(trim(p_model), 160)
    ),
    auth.uid()
  );

  perform public.append_patient_timeline_event(
    v_document.patient_id,
    v_document.clinic_id,
    'document_analysis',
    'Documento pré-analisado',
    v_document.title,
    jsonb_build_object('document_id', v_document.id, 'analysis_id', v_analysis_id),
    auth.uid()
  );

  return v_analysis_id;
end;
$$;

grant execute on function public.save_patient_document_ai_analysis(
  uuid, text, text, jsonb, text
) to authenticated;
