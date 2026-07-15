-- Cevora Nexo · Iteração 9
-- Ambientes por função e encaminhamento médico operacional.

create type public.clinic_operational_role as enum (
  'attendant',
  'doctor',
  'administrative'
);

alter table public.clinic_members
  add column operational_role public.clinic_operational_role not null default 'attendant',
  add column professional_id uuid references public.professionals(id) on delete set null;

update public.clinic_members
set operational_role = case
  when role in ('owner', 'manager') then 'administrative'::public.clinic_operational_role
  else 'attendant'::public.clinic_operational_role
end;

create unique index clinic_members_professional_unique_idx
  on public.clinic_members(clinic_id, professional_id)
  where professional_id is not null;

create or replace function public.validate_clinic_member_function()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_professional_clinic uuid;
begin
  if new.operational_role = 'doctor' and new.professional_id is null then
    raise exception 'Vincule o acesso médico a um profissional da clínica.';
  end if;

  if new.operational_role <> 'doctor' then
    new.professional_id := null;
  end if;

  if new.professional_id is not null then
    select clinic_id into v_professional_clinic
    from public.professionals
    where id = new.professional_id
      and active = true;

    if not found or v_professional_clinic <> new.clinic_id then
      raise exception 'O profissional selecionado não pertence à clínica ou está inativo.';
    end if;
  end if;

  return new;
end;
$$;

create trigger clinic_members_validate_function
before insert or update of operational_role, professional_id, clinic_id
on public.clinic_members
for each row execute function public.validate_clinic_member_function();

create or replace function public.has_operational_role(
  target_clinic_id uuid,
  allowed_roles public.clinic_operational_role[]
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_platform_admin() or exists (
    select 1
    from public.clinic_members
    where clinic_id = target_clinic_id
      and user_id = auth.uid()
      and status = 'active'
      and operational_role = any(allowed_roles)
  );
$$;

alter type public.operational_task_source
  add value if not exists 'medical_referral';

alter type public.patient_timeline_event_type
  add value if not exists 'medical_referral_created';

alter type public.patient_timeline_event_type
  add value if not exists 'medical_referral_status';

create type public.medical_referral_status as enum (
  'pending',
  'in_review',
  'returned',
  'approved_operationally',
  'signed',
  'cancelled'
);

create type public.medical_referral_event_type as enum (
  'created',
  'assigned',
  'status_changed',
  'response',
  'note'
);

create table public.medical_referrals (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  document_id uuid references public.patient_documents(id) on delete set null,
  conversation_id uuid references public.sales_conversations(id) on delete set null,
  requested_by uuid not null references public.profiles(id) on delete restrict,
  doctor_user_id uuid not null references public.profiles(id) on delete restrict,
  assigned_back_to uuid references public.profiles(id) on delete set null,
  title text not null check (char_length(trim(title)) between 2 and 180),
  reason text not null default '',
  medical_response text not null default '',
  status public.medical_referral_status not null default 'pending',
  priority public.operational_task_priority not null default 'normal',
  due_at timestamptz,
  reviewed_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint medical_referrals_id_clinic_key unique (id, clinic_id)
);

create table public.medical_referral_events (
  id uuid primary key default gen_random_uuid(),
  referral_id uuid not null references public.medical_referrals(id) on delete cascade,
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  event_type public.medical_referral_event_type not null,
  title text not null check (char_length(trim(title)) between 2 and 180),
  description text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create or replace function public.validate_medical_referral_links()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link_clinic uuid;
  v_link_patient uuid;
begin
  select clinic_id into v_link_clinic
  from public.patients
  where id = new.patient_id;

  if not found or v_link_clinic <> new.clinic_id then
    raise exception 'O paciente selecionado não pertence à clínica.';
  end if;

  if not exists (
    select 1
    from public.clinic_members
    where clinic_id = new.clinic_id
      and user_id = new.requested_by
      and status = 'active'
  ) then
    raise exception 'O solicitante não pertence à equipe ativa.';
  end if;

  if not exists (
    select 1
    from public.clinic_members
    where clinic_id = new.clinic_id
      and user_id = new.doctor_user_id
      and status = 'active'
      and operational_role = 'doctor'
  ) then
    raise exception 'O médico selecionado não possui um acesso médico ativo.';
  end if;

  if new.assigned_back_to is not null and not exists (
    select 1
    from public.clinic_members
    where clinic_id = new.clinic_id
      and user_id = new.assigned_back_to
      and status = 'active'
  ) then
    raise exception 'O responsável pelo retorno não pertence à equipe ativa.';
  end if;

  if new.document_id is not null then
    select clinic_id, patient_id into v_link_clinic, v_link_patient
    from public.patient_documents
    where id = new.document_id;

    if not found or v_link_clinic <> new.clinic_id then
      raise exception 'O documento selecionado não pertence à clínica.';
    end if;

    if v_link_patient <> new.patient_id then
      raise exception 'O documento está vinculado a outro paciente.';
    end if;
  end if;

  if new.conversation_id is not null then
    select clinic_id, patient_id into v_link_clinic, v_link_patient
    from public.sales_conversations
    where id = new.conversation_id;

    if not found or v_link_clinic <> new.clinic_id then
      raise exception 'A conversa selecionada não pertence à clínica.';
    end if;

    if v_link_patient is not null and v_link_patient <> new.patient_id then
      raise exception 'A conversa está vinculada a outro paciente.';
    end if;
  end if;

  return new;
end;
$$;

create trigger medical_referrals_validate_links
before insert or update on public.medical_referrals
for each row execute function public.validate_medical_referral_links();

create trigger medical_referrals_set_updated_at
before update on public.medical_referrals
for each row execute function public.set_updated_at();

create index medical_referrals_doctor_status_due_idx
  on public.medical_referrals(doctor_user_id, status, due_at nulls last, updated_at desc);
create index medical_referrals_requester_status_idx
  on public.medical_referrals(requested_by, status, updated_at desc);
create index medical_referrals_clinic_status_idx
  on public.medical_referrals(clinic_id, status, updated_at desc);
create index medical_referrals_patient_created_idx
  on public.medical_referrals(patient_id, created_at desc);
create index medical_referral_events_referral_created_idx
  on public.medical_referral_events(referral_id, created_at desc);

alter table public.medical_referrals enable row level security;
alter table public.medical_referral_events enable row level security;

create policy "medical_referrals_select_scoped"
on public.medical_referrals for select to authenticated
using (
  public.has_clinic_role(clinic_id, array['owner', 'manager']::public.clinic_role[])
  or requested_by = auth.uid()
  or doctor_user_id = auth.uid()
  or assigned_back_to = auth.uid()
);

create policy "medical_referral_events_select_scoped"
on public.medical_referral_events for select to authenticated
using (
  exists (
    select 1
    from public.medical_referrals referral
    where referral.id = medical_referral_events.referral_id
      and (
        public.has_clinic_role(referral.clinic_id, array['owner', 'manager']::public.clinic_role[])
        or referral.requested_by = auth.uid()
        or referral.doctor_user_id = auth.uid()
        or referral.assigned_back_to = auth.uid()
      )
  )
);

revoke insert, update, delete on public.medical_referrals from anon, authenticated;
revoke insert, update, delete on public.medical_referral_events from anon, authenticated;
grant select on public.medical_referrals, public.medical_referral_events to authenticated;
