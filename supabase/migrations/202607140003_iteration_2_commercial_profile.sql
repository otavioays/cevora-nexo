-- Cevora Nexo · Iteração 2
-- Perfil comercial, procedimentos, profissionais, regras e conhecimento aprovado.

create type public.price_visibility as enum ('never', 'after_context', 'always');
create type public.rule_severity as enum ('guidance', 'warning', 'block');

create table public.clinic_profiles (
  clinic_id uuid primary key references public.clinics(id) on delete cascade,
  description text not null default '',
  city text not null default '',
  state text not null default '',
  address text not null default '',
  whatsapp text not null default '',
  website text not null default '',
  business_hours text not null default '',
  payment_information text not null default '',
  scheduling_rules text not null default '',
  tone_of_voice text not null default 'acolhedor, elegante e direto',
  tone_notes text not null default '',
  primary_goal text not null default 'conduzir o paciente para uma avaliação',
  pricing_policy text not null default '',
  prohibited_claims text[] not null default '{}',
  forbidden_words text[] not null default '{}',
  custom_instructions text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.procedures (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 120),
  category text not null default '',
  description text not null default '',
  target_patient text not null default '',
  benefits text not null default '',
  price_guidance text not null default '',
  price_visibility public.price_visibility not null default 'after_context',
  consultation_required boolean not null default true,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint procedures_id_clinic_key unique (id, clinic_id),
  constraint procedures_clinic_name_key unique (clinic_id, name)
);

create table public.professionals (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 120),
  specialty text not null default '',
  registration text not null default '',
  bio text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.clinic_rules (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 2 and 140),
  category text not null default 'comercial',
  instruction text not null check (char_length(trim(instruction)) >= 4),
  severity public.rule_severity not null default 'guidance',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.clinic_faqs (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  procedure_id uuid,
  question text not null check (char_length(trim(question)) >= 4),
  answer text not null check (char_length(trim(answer)) >= 4),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clinic_faqs_procedure_fk
    foreign key (procedure_id, clinic_id)
    references public.procedures(id, clinic_id)
    on delete set null
);

create table public.approved_answers (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  procedure_id uuid,
  label text not null check (char_length(trim(label)) between 2 and 120),
  patient_intent text not null default '',
  content text not null check (char_length(trim(content)) >= 4),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint approved_answers_procedure_fk
    foreign key (procedure_id, clinic_id)
    references public.procedures(id, clinic_id)
    on delete set null
);

create index procedures_clinic_active_idx on public.procedures(clinic_id, active, sort_order);
create index professionals_clinic_active_idx on public.professionals(clinic_id, active);
create index clinic_rules_clinic_active_idx on public.clinic_rules(clinic_id, active, severity);
create index clinic_faqs_clinic_active_idx on public.clinic_faqs(clinic_id, active);
create index approved_answers_clinic_active_idx on public.approved_answers(clinic_id, active);

create trigger clinic_profiles_set_updated_at before update on public.clinic_profiles
for each row execute function public.set_updated_at();
create trigger procedures_set_updated_at before update on public.procedures
for each row execute function public.set_updated_at();
create trigger professionals_set_updated_at before update on public.professionals
for each row execute function public.set_updated_at();
create trigger clinic_rules_set_updated_at before update on public.clinic_rules
for each row execute function public.set_updated_at();
create trigger clinic_faqs_set_updated_at before update on public.clinic_faqs
for each row execute function public.set_updated_at();
create trigger approved_answers_set_updated_at before update on public.approved_answers
for each row execute function public.set_updated_at();

alter table public.clinic_profiles enable row level security;
alter table public.procedures enable row level security;
alter table public.professionals enable row level security;
alter table public.clinic_rules enable row level security;
alter table public.clinic_faqs enable row level security;
alter table public.approved_answers enable row level security;

create policy "clinic_profiles_select_members" on public.clinic_profiles
for select to authenticated using (public.is_clinic_member(clinic_id));
create policy "clinic_profiles_insert_management" on public.clinic_profiles
for insert to authenticated with check (public.has_clinic_role(clinic_id, array['owner', 'manager']::public.clinic_role[]));
create policy "clinic_profiles_update_management" on public.clinic_profiles
for update to authenticated
using (public.has_clinic_role(clinic_id, array['owner', 'manager']::public.clinic_role[]))
with check (public.has_clinic_role(clinic_id, array['owner', 'manager']::public.clinic_role[]));

create policy "procedures_select_members" on public.procedures
for select to authenticated using (public.is_clinic_member(clinic_id));
create policy "procedures_insert_management" on public.procedures
for insert to authenticated with check (public.has_clinic_role(clinic_id, array['owner', 'manager']::public.clinic_role[]));
create policy "procedures_update_management" on public.procedures
for update to authenticated
using (public.has_clinic_role(clinic_id, array['owner', 'manager']::public.clinic_role[]))
with check (public.has_clinic_role(clinic_id, array['owner', 'manager']::public.clinic_role[]));
create policy "procedures_delete_management" on public.procedures
for delete to authenticated using (public.has_clinic_role(clinic_id, array['owner', 'manager']::public.clinic_role[]));

create policy "professionals_select_members" on public.professionals
for select to authenticated using (public.is_clinic_member(clinic_id));
create policy "professionals_insert_management" on public.professionals
for insert to authenticated with check (public.has_clinic_role(clinic_id, array['owner', 'manager']::public.clinic_role[]));
create policy "professionals_update_management" on public.professionals
for update to authenticated
using (public.has_clinic_role(clinic_id, array['owner', 'manager']::public.clinic_role[]))
with check (public.has_clinic_role(clinic_id, array['owner', 'manager']::public.clinic_role[]));
create policy "professionals_delete_management" on public.professionals
for delete to authenticated using (public.has_clinic_role(clinic_id, array['owner', 'manager']::public.clinic_role[]));

create policy "clinic_rules_select_members" on public.clinic_rules
for select to authenticated using (public.is_clinic_member(clinic_id));
create policy "clinic_rules_insert_management" on public.clinic_rules
for insert to authenticated with check (public.has_clinic_role(clinic_id, array['owner', 'manager']::public.clinic_role[]));
create policy "clinic_rules_update_management" on public.clinic_rules
for update to authenticated
using (public.has_clinic_role(clinic_id, array['owner', 'manager']::public.clinic_role[]))
with check (public.has_clinic_role(clinic_id, array['owner', 'manager']::public.clinic_role[]));
create policy "clinic_rules_delete_management" on public.clinic_rules
for delete to authenticated using (public.has_clinic_role(clinic_id, array['owner', 'manager']::public.clinic_role[]));

create policy "clinic_faqs_select_members" on public.clinic_faqs
for select to authenticated using (public.is_clinic_member(clinic_id));
create policy "clinic_faqs_insert_management" on public.clinic_faqs
for insert to authenticated with check (public.has_clinic_role(clinic_id, array['owner', 'manager']::public.clinic_role[]));
create policy "clinic_faqs_update_management" on public.clinic_faqs
for update to authenticated
using (public.has_clinic_role(clinic_id, array['owner', 'manager']::public.clinic_role[]))
with check (public.has_clinic_role(clinic_id, array['owner', 'manager']::public.clinic_role[]));
create policy "clinic_faqs_delete_management" on public.clinic_faqs
for delete to authenticated using (public.has_clinic_role(clinic_id, array['owner', 'manager']::public.clinic_role[]));

create policy "approved_answers_select_members" on public.approved_answers
for select to authenticated using (public.is_clinic_member(clinic_id));
create policy "approved_answers_insert_management" on public.approved_answers
for insert to authenticated with check (public.has_clinic_role(clinic_id, array['owner', 'manager']::public.clinic_role[]));
create policy "approved_answers_update_management" on public.approved_answers
for update to authenticated
using (public.has_clinic_role(clinic_id, array['owner', 'manager']::public.clinic_role[]))
with check (public.has_clinic_role(clinic_id, array['owner', 'manager']::public.clinic_role[]));
create policy "approved_answers_delete_management" on public.approved_answers
for delete to authenticated using (public.has_clinic_role(clinic_id, array['owner', 'manager']::public.clinic_role[]));

grant select, insert, update on public.clinic_profiles to authenticated;
grant select, insert, update, delete on public.procedures to authenticated;
grant select, insert, update, delete on public.professionals to authenticated;
grant select, insert, update, delete on public.clinic_rules to authenticated;
grant select, insert, update, delete on public.clinic_faqs to authenticated;
grant select, insert, update, delete on public.approved_answers to authenticated;
