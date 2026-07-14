-- Cevora Nexo · Iteração 4
-- Conversas persistentes, mensagens e estado comercial acumulado.

create type public.sales_conversation_status as enum ('open', 'won', 'lost', 'archived');
create type public.sales_conversation_channel as enum ('whatsapp', 'instagram', 'phone', 'other');
create type public.conversation_message_direction as enum ('patient', 'clinic');
create type public.conversation_message_status as enum ('received', 'draft', 'sent');

create table public.sales_conversations (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete restrict,
  assigned_to uuid references public.profiles(id) on delete set null,
  procedure_id uuid references public.procedures(id) on delete set null,
  contact_label text not null check (char_length(trim(contact_label)) between 2 and 120),
  channel public.sales_conversation_channel not null default 'whatsapp',
  status public.sales_conversation_status not null default 'open',
  interaction_stage public.sales_interaction_stage not null default 'opening',
  spin_stage public.spin_stage not null default 'none',
  summary text not null default '',
  explicit_need text not null default '',
  implicit_need text not null default '',
  objections text[] not null default '{}',
  emotional_state text not null default '',
  missing_information text[] not null default '{}',
  risk_level public.spin_risk_level not null default 'low',
  next_objective text not null default '',
  recommended_strategy text not null default '',
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sales_conversations_id_clinic_key unique (id, clinic_id)
);

alter table public.spin_interactions
  add column conversation_id uuid;

alter table public.spin_interactions
  add constraint spin_interactions_conversation_clinic_fk
  foreign key (conversation_id, clinic_id)
  references public.sales_conversations(id, clinic_id)
  on delete cascade;

create table public.conversation_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null,
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  interaction_id uuid references public.spin_interactions(id) on delete set null,
  direction public.conversation_message_direction not null,
  status public.conversation_message_status not null,
  content text not null check (char_length(trim(content)) between 2 and 6000),
  created_by uuid not null references public.profiles(id) on delete restrict,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint conversation_messages_conversation_clinic_fk
    foreign key (conversation_id, clinic_id)
    references public.sales_conversations(id, clinic_id)
    on delete cascade,
  constraint conversation_messages_direction_status_check check (
    (direction = 'patient' and status = 'received')
    or (direction = 'clinic' and status in ('draft', 'sent'))
  )
);

create index sales_conversations_clinic_activity_idx
  on public.sales_conversations(clinic_id, last_message_at desc);
create index sales_conversations_clinic_status_idx
  on public.sales_conversations(clinic_id, status, last_message_at desc);
create index conversation_messages_conversation_created_idx
  on public.conversation_messages(conversation_id, created_at asc);
create index conversation_messages_interaction_idx
  on public.conversation_messages(interaction_id);
create index spin_interactions_conversation_created_idx
  on public.spin_interactions(conversation_id, created_at desc)
  where conversation_id is not null;

create trigger sales_conversations_set_updated_at before update on public.sales_conversations
for each row execute function public.set_updated_at();
create trigger conversation_messages_set_updated_at before update on public.conversation_messages
for each row execute function public.set_updated_at();

alter table public.sales_conversations enable row level security;
alter table public.conversation_messages enable row level security;

create policy "sales_conversations_select_members"
on public.sales_conversations for select to authenticated
using (public.is_clinic_member(clinic_id));

create policy "conversation_messages_select_members"
on public.conversation_messages for select to authenticated
using (public.is_clinic_member(clinic_id));

revoke insert, update, delete on public.sales_conversations from anon, authenticated;
revoke insert, update, delete on public.conversation_messages from anon, authenticated;

grant select on public.sales_conversations, public.conversation_messages to authenticated;
