-- Cevora Nexo · Iteração 6
-- Central privada de documentos, arquivos e auditoria operacional.

create type public.patient_document_type as enum (
  'prescription',
  'exam_request',
  'medical_certificate',
  'informed_consent',
  'instructions',
  'report',
  'other'
);

create type public.patient_document_status as enum (
  'created',
  'awaiting_signature',
  'ready_to_send',
  'sent',
  'viewed',
  'cancelled'
);

create type public.patient_document_event_type as enum (
  'created',
  'file_uploaded',
  'status_changed',
  'note',
  'downloaded'
);

alter type public.patient_timeline_event_type add value if not exists 'document_created';
alter type public.patient_timeline_event_type add value if not exists 'document_status';

create table public.patient_documents (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_id uuid not null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  assigned_to uuid references public.profiles(id) on delete set null,
  professional_id uuid references public.professionals(id) on delete set null,
  procedure_id uuid references public.procedures(id) on delete set null,
  document_type public.patient_document_type not null,
  title text not null check (char_length(trim(title)) between 2 and 180),
  description text not null default '',
  status public.patient_document_status not null default 'created',
  file_name text not null default '',
  storage_path text not null default '',
  mime_type text not null default '',
  size_bytes bigint not null default 0 check (size_bytes between 0 and 15728640),
  sent_at timestamptz,
  viewed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint patient_documents_id_clinic_key unique (id, clinic_id),
  constraint patient_documents_patient_fk
    foreign key (patient_id, clinic_id)
    references public.patients(id, clinic_id)
    on delete cascade,
  constraint patient_documents_file_consistency check (
    (storage_path = '' and file_name = '' and mime_type = '' and size_bytes = 0)
    or (storage_path <> '' and file_name <> '' and mime_type <> '' and size_bytes > 0)
  )
);

create table public.patient_document_events (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null,
  patient_id uuid not null,
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  event_type public.patient_document_event_type not null,
  title text not null check (char_length(trim(title)) between 2 and 180),
  description text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint patient_document_events_document_fk
    foreign key (document_id, clinic_id)
    references public.patient_documents(id, clinic_id)
    on delete cascade,
  constraint patient_document_events_patient_fk
    foreign key (patient_id, clinic_id)
    references public.patients(id, clinic_id)
    on delete cascade
);

create index patient_documents_clinic_activity_idx
  on public.patient_documents(clinic_id, updated_at desc);
create index patient_documents_patient_activity_idx
  on public.patient_documents(patient_id, updated_at desc);
create index patient_documents_clinic_status_idx
  on public.patient_documents(clinic_id, status, updated_at desc);
create index patient_document_events_document_created_idx
  on public.patient_document_events(document_id, created_at desc);

create trigger patient_documents_set_updated_at before update on public.patient_documents
for each row execute function public.set_updated_at();

alter table public.patient_documents enable row level security;
alter table public.patient_document_events enable row level security;

create policy "patient_documents_select_members"
on public.patient_documents for select to authenticated
using (public.is_clinic_member(clinic_id));

create policy "patient_document_events_select_members"
on public.patient_document_events for select to authenticated
using (public.is_clinic_member(clinic_id));

revoke insert, update, delete on public.patient_documents from anon, authenticated;
revoke insert, update, delete on public.patient_document_events from anon, authenticated;
grant select on public.patient_documents, public.patient_document_events to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'patient-documents',
  'patient-documents',
  false,
  15728640,
  array['application/pdf', 'image/jpeg', 'image/png']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "patient_document_files_select_members"
on storage.objects for select to authenticated
using (
  bucket_id = 'patient-documents'
  and exists (
    select 1
    from public.patient_documents document
    where document.storage_path = name
      and public.is_clinic_member(document.clinic_id)
  )
);

create policy "patient_document_files_insert_members"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'patient-documents'
  and exists (
    select 1
    from public.patient_documents document
    where document.clinic_id::text = (storage.foldername(name))[1]
      and document.patient_id::text = (storage.foldername(name))[2]
      and document.id::text = (storage.foldername(name))[3]
      and document.storage_path = ''
      and document.status in ('created', 'awaiting_signature', 'ready_to_send')
      and public.is_clinic_member(document.clinic_id)
  )
);

create policy "patient_document_files_delete_management"
on storage.objects for delete to authenticated
using (
  bucket_id = 'patient-documents'
  and exists (
    select 1
    from public.patient_documents document
    where document.storage_path = name
      and public.has_clinic_role(
        document.clinic_id,
        array['owner', 'manager']::public.clinic_role[]
      )
  )
);