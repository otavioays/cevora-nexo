-- Cevora Nexo · Iteração 8
-- Fila operacional, prazos, responsáveis e radar de pendências.

create type public.operational_task_status as enum (
  'open',
  'in_progress',
  'completed',
  'cancelled'
);

create type public.operational_task_priority as enum (
  'low',
  'normal',
  'high',
  'urgent'
);

create type public.operational_task_source as enum (
  'manual',
  'conversation_followup',
  'document_followup',
  'system_alert'
);

create type public.operational_task_event_type as enum (
  'created',
  'updated',
  'status_changed',
  'note'
);

alter type public.patient_timeline_event_type
  add value if not exists 'task_created';

alter type public.patient_timeline_event_type
  add value if not exists 'task_status';

create table public.operational_tasks (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_id uuid references public.patients(id) on delete set null,
  conversation_id uuid references public.sales_conversations(id) on delete set null,
  document_id uuid references public.patient_documents(id) on delete set null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  assigned_to uuid references public.profiles(id) on delete set null,
  source public.operational_task_source not null default 'manual',
  title text not null check (char_length(trim(title)) between 2 and 180),
  description text not null default '',
  status public.operational_task_status not null default 'open',
  priority public.operational_task_priority not null default 'normal',
  due_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint operational_tasks_id_clinic_key unique (id, clinic_id)
);

create table public.operational_task_events (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.operational_tasks(id) on delete cascade,
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  event_type public.operational_task_event_type not null,
  title text not null check (char_length(trim(title)) between 2 and 180),
  description text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create or replace function public.validate_operational_task_links()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link_clinic uuid;
  v_link_patient uuid;
begin
  if new.assigned_to is not null and not exists (
    select 1
    from public.clinic_members
    where clinic_id = new.clinic_id
      and user_id = new.assigned_to
      and status = 'active'
  ) then
    raise exception 'O responsável selecionado não pertence à equipe ativa.';
  end if;

  if new.patient_id is not null then
    select clinic_id into v_link_clinic
    from public.patients
    where id = new.patient_id;

    if not found or v_link_clinic <> new.clinic_id then
      raise exception 'O paciente selecionado não pertence à clínica.';
    end if;
  end if;

  if new.conversation_id is not null then
    select clinic_id, patient_id into v_link_clinic, v_link_patient
    from public.sales_conversations
    where id = new.conversation_id;

    if not found or v_link_clinic <> new.clinic_id then
      raise exception 'A conversa selecionada não pertence à clínica.';
    end if;

    if v_link_patient is not null then
      if new.patient_id is null then
        new.patient_id := v_link_patient;
      elsif new.patient_id <> v_link_patient then
        raise exception 'A conversa está vinculada a outro paciente.';
      end if;
    end if;
  end if;

  if new.document_id is not null then
    select clinic_id, patient_id into v_link_clinic, v_link_patient
    from public.patient_documents
    where id = new.document_id;

    if not found or v_link_clinic <> new.clinic_id then
      raise exception 'O documento selecionado não pertence à clínica.';
    end if;

    if new.patient_id is null then
      new.patient_id := v_link_patient;
    elsif new.patient_id <> v_link_patient then
      raise exception 'O documento está vinculado a outro paciente.';
    end if;
  end if;

  return new;
end;
$$;

create trigger operational_tasks_validate_links
before insert or update on public.operational_tasks
for each row execute function public.validate_operational_task_links();

create trigger operational_tasks_set_updated_at
before update on public.operational_tasks
for each row execute function public.set_updated_at();

create index operational_tasks_clinic_status_due_idx
  on public.operational_tasks(clinic_id, status, due_at nulls last, updated_at desc);
create index operational_tasks_assignee_status_due_idx
  on public.operational_tasks(assigned_to, status, due_at nulls last);
create index operational_tasks_patient_activity_idx
  on public.operational_tasks(patient_id, updated_at desc)
  where patient_id is not null;
create index operational_tasks_conversation_active_idx
  on public.operational_tasks(conversation_id, status)
  where conversation_id is not null;
create index operational_tasks_document_active_idx
  on public.operational_tasks(document_id, status)
  where document_id is not null;
create index operational_task_events_task_created_idx
  on public.operational_task_events(task_id, created_at desc);

alter table public.operational_tasks enable row level security;
alter table public.operational_task_events enable row level security;

create policy "operational_tasks_select_members"
on public.operational_tasks for select to authenticated
using (public.is_clinic_member(clinic_id));

create policy "operational_task_events_select_members"
on public.operational_task_events for select to authenticated
using (public.is_clinic_member(clinic_id));

revoke insert, update, delete on public.operational_tasks from anon, authenticated;
revoke insert, update, delete on public.operational_task_events from anon, authenticated;
grant select on public.operational_tasks, public.operational_task_events to authenticated;
