-- Cevora Nexo · Iteração 3
-- Entrada de texto, diagnóstico, planejamento SPIN e resposta recomendada.

create type public.spin_interaction_status as enum ('processing', 'completed', 'failed');
create type public.sales_interaction_stage as enum ('opening', 'investigation', 'capability', 'commitment');
create type public.spin_stage as enum ('situation', 'problem', 'implication', 'need_payoff', 'capability', 'commitment', 'none');
create type public.spin_risk_level as enum ('low', 'medium', 'high');

create table public.spin_interactions (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete restrict,
  procedure_id uuid references public.procedures(id) on delete set null,
  patient_message text not null check (char_length(trim(patient_message)) between 2 and 6000),
  additional_context text not null default '' check (char_length(additional_context) <= 6000),
  status public.spin_interaction_status not null default 'processing',
  model_name text not null default '',
  prompt_version text not null default 'spin-v1',
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.spin_analyses (
  id uuid primary key default gen_random_uuid(),
  interaction_id uuid not null unique references public.spin_interactions(id) on delete cascade,
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  interaction_stage public.sales_interaction_stage not null,
  spin_stage public.spin_stage not null,
  intent text not null,
  summary text not null,
  explicit_need text not null default '',
  implicit_need text not null default '',
  objections text[] not null default '{}',
  emotional_state text not null default '',
  missing_information text[] not null default '{}',
  risk_level public.spin_risk_level not null default 'low',
  confidence numeric(4,3) not null check (confidence between 0 and 1),
  created_at timestamptz not null default now()
);

create table public.spin_plans (
  id uuid primary key default gen_random_uuid(),
  interaction_id uuid not null unique references public.spin_interactions(id) on delete cascade,
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  next_objective text not null,
  recommended_strategy text not null,
  rationale text not null,
  should_present_offer boolean not null default false,
  should_request_commitment boolean not null default false,
  avoid_actions text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table public.spin_responses (
  id uuid primary key default gen_random_uuid(),
  interaction_id uuid not null unique references public.spin_interactions(id) on delete cascade,
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  primary_response text not null,
  alternative_response text not null default '',
  explanation text not null,
  expected_next_step text not null,
  warnings text[] not null default '{}',
  validation jsonb not null default '{}'::jsonb,
  was_copied boolean not null default false,
  created_at timestamptz not null default now()
);

create index spin_interactions_clinic_created_idx on public.spin_interactions(clinic_id, created_at desc);
create index spin_interactions_creator_created_idx on public.spin_interactions(created_by, created_at desc);
create index spin_analyses_clinic_stage_idx on public.spin_analyses(clinic_id, spin_stage, created_at desc);

create trigger spin_interactions_set_updated_at before update on public.spin_interactions
for each row execute function public.set_updated_at();

alter table public.spin_interactions enable row level security;
alter table public.spin_analyses enable row level security;
alter table public.spin_plans enable row level security;
alter table public.spin_responses enable row level security;

create policy "spin_interactions_select_members" on public.spin_interactions for select to authenticated
using (public.is_clinic_member(spin_interactions.clinic_id));

create policy "spin_interactions_insert_self" on public.spin_interactions for insert to authenticated
with check (spin_interactions.created_by = auth.uid() and public.is_clinic_member(spin_interactions.clinic_id));

create policy "spin_interactions_update_self" on public.spin_interactions for update to authenticated
using (spin_interactions.created_by = auth.uid() and public.is_clinic_member(spin_interactions.clinic_id))
with check (spin_interactions.created_by = auth.uid() and public.is_clinic_member(spin_interactions.clinic_id));

create policy "spin_analyses_select_members" on public.spin_analyses for select to authenticated
using (public.is_clinic_member(spin_analyses.clinic_id));

create policy "spin_analyses_insert_owned" on public.spin_analyses for insert to authenticated
with check (
  public.is_clinic_member(spin_analyses.clinic_id)
  and exists (
    select 1 from public.spin_interactions interaction
    where interaction.id = spin_analyses.interaction_id
      and interaction.clinic_id = spin_analyses.clinic_id
      and interaction.created_by = auth.uid()
  )
);

create policy "spin_plans_select_members" on public.spin_plans for select to authenticated
using (public.is_clinic_member(spin_plans.clinic_id));

create policy "spin_plans_insert_owned" on public.spin_plans for insert to authenticated
with check (
  public.is_clinic_member(spin_plans.clinic_id)
  and exists (
    select 1 from public.spin_interactions interaction
    where interaction.id = spin_plans.interaction_id
      and interaction.clinic_id = spin_plans.clinic_id
      and interaction.created_by = auth.uid()
  )
);

create policy "spin_responses_select_members" on public.spin_responses for select to authenticated
using (public.is_clinic_member(spin_responses.clinic_id));

create policy "spin_responses_insert_owned" on public.spin_responses for insert to authenticated
with check (
  public.is_clinic_member(spin_responses.clinic_id)
  and exists (
    select 1 from public.spin_interactions interaction
    where interaction.id = spin_responses.interaction_id
      and interaction.clinic_id = spin_responses.clinic_id
      and interaction.created_by = auth.uid()
  )
);

grant select, insert on public.spin_interactions, public.spin_analyses, public.spin_plans, public.spin_responses to authenticated;
revoke update on public.spin_interactions from authenticated;
grant update (status, model_name, prompt_version, error_message) on public.spin_interactions to authenticated;
