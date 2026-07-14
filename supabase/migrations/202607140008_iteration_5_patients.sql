-- Cevora Nexo · Iteração 5
-- Pacientes/leads, interesses por procedimento e linha do tempo comercial.

create type public.patient_status as enum (
  'lead',
  'qualified',
  'scheduled',
  'converted',
  'inactive',
  'lost'
);

create type public.patient_procedure_status as enum (
  'interested',
  'evaluating',
  'scheduled',
  'completed',
  'discarded'
);

create type public.patient_timeline_event_type as enum (
  'created',
  'note',
  'profile_update',
  'status_change',
  'procedure_interest',
  'conversation_linked',
  'conversation_unlinked',
  'conversation_outcome'
);

create table public.patients (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete restrict,
  assigned_to uuid references public.profiles(id) on delete set null,
  reference_label text not null check (char_length(trim(reference_label)) between 2 and 120),
  status public.patient_status not null default 'lead',
  source text not null default '',
  internal_notes text not null default '',
  last_activity_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint patients_id_clinic_key unique (id, clinic_id)
);

create table public.patient_procedure_interests (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null,
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  procedure_id uuid not null,
  status public.patient_procedure_status not null default 'interested',
  notes text not null default '',
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint patient_procedure_interests_patient_fk
    foreign key (patient_id, clinic_id)
    references public.patients(id, clinic_id)
    on delete cascade,
  constraint patient_procedure_interests_procedure_fk
    foreign key (procedure_id, clinic_id)
    references public.procedures(id, clinic_id)
    on delete cascade,
  constraint patient_procedure_interests_unique unique (patient_id, procedure_id)
);

create table public.patient_timeline_events (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null,
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  event_type public.patient_timeline_event_type not null,
  title text not null check (char_length(trim(title)) between 2 and 180),
  description text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint patient_timeline_events_patient_fk
    foreign key (patient_id, clinic_id)
    references public.patients(id, clinic_id)
    on delete cascade
);

alter table public.sales_conversations
  add column patient_id uuid;

alter table public.sales_conversations
  add constraint sales_conversations_patient_clinic_fk
  foreign key (patient_id, clinic_id)
  references public.patients(id, clinic_id)
  on delete restrict;

create index patients_clinic_activity_idx
  on public.patients(clinic_id, last_activity_at desc);
create index patients_clinic_status_idx
  on public.patients(clinic_id, status, last_activity_at desc);
create index patient_procedure_interests_patient_idx
  on public.patient_procedure_interests(patient_id, updated_at desc);
create index patient_timeline_events_patient_created_idx
  on public.patient_timeline_events(patient_id, created_at desc);
create index sales_conversations_patient_activity_idx
  on public.sales_conversations(patient_id, last_message_at desc)
  where patient_id is not null;

create trigger patients_set_updated_at before update on public.patients
for each row execute function public.set_updated_at();
create trigger patient_procedure_interests_set_updated_at before update on public.patient_procedure_interests
for each row execute function public.set_updated_at();

alter table public.patients enable row level security;
alter table public.patient_procedure_interests enable row level security;
alter table public.patient_timeline_events enable row level security;

create policy "patients_select_members"
on public.patients for select to authenticated
using (public.is_clinic_member(clinic_id));

create policy "patient_procedure_interests_select_members"
on public.patient_procedure_interests for select to authenticated
using (public.is_clinic_member(clinic_id));

create policy "patient_timeline_events_select_members"
on public.patient_timeline_events for select to authenticated
using (public.is_clinic_member(clinic_id));

revoke insert, update, delete on public.patients from anon, authenticated;
revoke insert, update, delete on public.patient_procedure_interests from anon, authenticated;
revoke insert, update, delete on public.patient_timeline_events from anon, authenticated;

grant select on public.patients, public.patient_procedure_interests, public.patient_timeline_events to authenticated;
