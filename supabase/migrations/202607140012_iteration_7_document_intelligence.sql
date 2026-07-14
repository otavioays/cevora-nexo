-- Cevora Nexo · Iteração 7
-- Inteligência documental assistida, com revisão humana obrigatória.

alter type public.patient_document_event_type
  add value if not exists 'ai_analysis_completed';

alter type public.patient_timeline_event_type
  add value if not exists 'document_analysis';

create table public.patient_document_ai_analyses (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null,
  patient_id uuid not null,
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  requested_by uuid not null references public.profiles(id) on delete restrict,
  provider text not null check (char_length(trim(provider)) between 2 and 40),
  model text not null check (char_length(trim(model)) between 2 and 160),
  privacy_confirmation text not null
    check (privacy_confirmation = 'fictitious_or_anonymized'),
  result jsonb not null check (jsonb_typeof(result) = 'object'),
  created_at timestamptz not null default now(),
  constraint patient_document_ai_analyses_document_fk
    foreign key (document_id, clinic_id)
    references public.patient_documents(id, clinic_id)
    on delete cascade,
  constraint patient_document_ai_analyses_patient_fk
    foreign key (patient_id, clinic_id)
    references public.patients(id, clinic_id)
    on delete cascade
);

create index patient_document_ai_analyses_document_created_idx
  on public.patient_document_ai_analyses(document_id, created_at desc);
create index patient_document_ai_analyses_clinic_created_idx
  on public.patient_document_ai_analyses(clinic_id, created_at desc);

alter table public.patient_document_ai_analyses enable row level security;

create policy "patient_document_ai_analyses_select_members"
on public.patient_document_ai_analyses for select to authenticated
using (public.is_clinic_member(clinic_id));

revoke insert, update, delete on public.patient_document_ai_analyses from anon, authenticated;
grant select on public.patient_document_ai_analyses to authenticated;
