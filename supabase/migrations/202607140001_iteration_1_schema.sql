-- Cevora Nexo · Iteração 1
-- Fundação multi-clínica, autenticação, papéis, convites e isolamento por RLS.

create extension if not exists pgcrypto;

create type public.clinic_status as enum ('active', 'suspended');
create type public.clinic_role as enum ('owner', 'manager', 'attendant');
create type public.member_status as enum ('active', 'inactive');
create type public.invitation_status as enum ('pending', 'accepted', 'revoked', 'expired');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  email text not null,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.clinics (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  status public.clinic_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.clinic_members (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.clinic_role not null default 'attendant',
  status public.member_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clinic_members_clinic_user_key unique (clinic_id, user_id)
);

create table public.clinic_invitations (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  email text not null check (position('@' in email) > 1),
  role public.clinic_role not null default 'attendant',
  token uuid not null unique default gen_random_uuid(),
  status public.invitation_status not null default 'pending',
  invited_by uuid not null references public.profiles(id) on delete restrict,
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  accepted_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.platform_admins (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index clinic_members_user_id_idx on public.clinic_members(user_id);
create index clinic_members_clinic_status_idx on public.clinic_members(clinic_id, status);
create index clinic_invitations_clinic_status_idx on public.clinic_invitations(clinic_id, status);
create index clinic_invitations_email_idx on public.clinic_invitations(lower(email));

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger clinics_set_updated_at before update on public.clinics
for each row execute function public.set_updated_at();
create trigger clinic_members_set_updated_at before update on public.clinic_members
for each row execute function public.set_updated_at();
create trigger clinic_invitations_set_updated_at before update on public.clinic_invitations
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  insert into public.profiles (id, display_name, email)
  values (
    new.id,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), ''),
    lower(coalesce(new.email, ''))
  )
  on conflict (id) do update
    set email = excluded.email,
        display_name = coalesce(public.profiles.display_name, excluded.display_name);
  return new;
end;
$$;

create trigger on_auth_user_created
after insert or update of email, raw_user_meta_data on auth.users
for each row execute function public.handle_new_user();

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.platform_admins where user_id = auth.uid()
  );
$$;

create or replace function public.is_clinic_member(target_clinic_id uuid)
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
  );
$$;

create or replace function public.has_clinic_role(target_clinic_id uuid, allowed_roles public.clinic_role[])
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
      and role = any(allowed_roles)
  );
$$;

alter table public.profiles enable row level security;
alter table public.clinics enable row level security;
alter table public.clinic_members enable row level security;
alter table public.clinic_invitations enable row level security;
alter table public.platform_admins enable row level security;

create policy "profiles_select_self_or_same_clinic"
on public.profiles for select
to authenticated
using (
  id = auth.uid()
  or public.is_platform_admin()
  or exists (
    select 1
    from public.clinic_members target_member
    join public.clinic_members viewer_member
      on viewer_member.clinic_id = target_member.clinic_id
    where target_member.user_id = profiles.id
      and target_member.status = 'active'
      and viewer_member.user_id = auth.uid()
      and viewer_member.status = 'active'
  )
);

create policy "profiles_update_self"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy "clinics_select_members"
on public.clinics for select
to authenticated
using (public.is_clinic_member(id));

create policy "clinics_update_management"
on public.clinics for update
to authenticated
using (public.has_clinic_role(id, array['owner', 'manager']::public.clinic_role[]))
with check (public.has_clinic_role(id, array['owner', 'manager']::public.clinic_role[]));

create policy "clinic_members_select_same_clinic"
on public.clinic_members for select
to authenticated
using (public.is_clinic_member(clinic_id));

create policy "invitations_select_management"
on public.clinic_invitations for select
to authenticated
using (public.has_clinic_role(clinic_id, array['owner', 'manager']::public.clinic_role[]));

create policy "platform_admins_select_self"
on public.platform_admins for select
to authenticated
using (user_id = auth.uid());

-- Restrict direct writes. Sensitive mutations happen through audited RPC functions below.
revoke all on public.platform_admins from anon, authenticated;
revoke insert, delete on public.profiles from anon, authenticated;
revoke update on public.profiles from authenticated;
grant update (display_name, avatar_url) on public.profiles to authenticated;
revoke insert, delete on public.clinics from anon, authenticated;
revoke update on public.clinics from authenticated;
grant update (name, slug) on public.clinics to authenticated;
revoke insert, update, delete on public.clinic_members from anon, authenticated;
revoke insert, update, delete on public.clinic_invitations from anon, authenticated;

grant select on public.profiles, public.clinics, public.clinic_members, public.clinic_invitations to authenticated;
