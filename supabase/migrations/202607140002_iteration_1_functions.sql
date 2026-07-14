-- Cevora Nexo · Iteração 1 · Funções seguras de domínio

create or replace function public.create_clinic_with_owner(p_name text, p_slug text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clinic_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Autenticação obrigatória.';
  end if;

  if char_length(trim(p_name)) < 2 then
    raise exception 'Informe um nome válido para a clínica.';
  end if;

  if p_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'O identificador da clínica é inválido.';
  end if;

  insert into public.clinics (name, slug)
  values (trim(p_name), lower(p_slug))
  returning id into v_clinic_id;

  insert into public.clinic_members (clinic_id, user_id, role, status)
  values (v_clinic_id, auth.uid(), 'owner', 'active');

  return v_clinic_id;
exception
  when unique_violation then
    raise exception 'Esse identificador já está em uso.';
end;
$$;

create or replace function public.create_clinic_invitation(
  p_clinic_id uuid,
  p_email text,
  p_role public.clinic_role default 'attendant'
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_actor_role public.clinic_role;
  v_token uuid;
  v_existing_user uuid;
begin
  select role into v_actor_role
  from public.clinic_members
  where clinic_id = p_clinic_id
    and user_id = auth.uid()
    and status = 'active';

  if v_actor_role is null and not public.is_platform_admin() then
    raise exception 'Você não pertence a esta clínica.';
  end if;

  if not public.is_platform_admin() and v_actor_role not in ('owner', 'manager') then
    raise exception 'Seu papel não permite criar convites.';
  end if;

  if p_role = 'owner' and not public.is_platform_admin() and v_actor_role <> 'owner' then
    raise exception 'Somente proprietários podem convidar outro proprietário.';
  end if;

  select id into v_existing_user
  from public.profiles
  where lower(email) = lower(trim(p_email))
  limit 1;

  if v_existing_user is not null and exists (
    select 1 from public.clinic_members
    where clinic_id = p_clinic_id and user_id = v_existing_user
  ) then
    raise exception 'Esse e-mail já pertence à equipe.';
  end if;

  update public.clinic_invitations
  set status = 'revoked'
  where clinic_id = p_clinic_id
    and lower(email) = lower(trim(p_email))
    and status = 'pending';

  insert into public.clinic_invitations (clinic_id, email, role, invited_by)
  values (p_clinic_id, lower(trim(p_email)), p_role, auth.uid())
  returning token into v_token;

  return v_token;
end;
$$;

create or replace function public.get_clinic_invitation_preview(p_token uuid)
returns table (
  clinic_name text,
  email text,
  role public.clinic_role,
  status public.invitation_status,
  expires_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.name,
    i.email,
    i.role,
    case
      when i.status = 'pending' and i.expires_at <= now() then 'expired'::public.invitation_status
      else i.status
    end,
    i.expires_at
  from public.clinic_invitations i
  join public.clinics c on c.id = i.clinic_id
  where i.token = p_token
  limit 1;
$$;

create or replace function public.accept_clinic_invitation(p_token uuid)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_invitation public.clinic_invitations%rowtype;
  v_user_email text;
begin
  if auth.uid() is null then
    raise exception 'Entre na sua conta para aceitar o convite.';
  end if;

  select lower(email) into v_user_email from auth.users where id = auth.uid();

  select * into v_invitation
  from public.clinic_invitations
  where token = p_token
  for update;

  if not found then
    raise exception 'Convite não encontrado.';
  end if;

  if v_invitation.status <> 'pending' then
    raise exception 'Este convite não está mais disponível.';
  end if;

  if v_invitation.expires_at <= now() then
    update public.clinic_invitations set status = 'expired' where id = v_invitation.id;
    raise exception 'Este convite expirou.';
  end if;

  if lower(v_invitation.email) <> v_user_email then
    raise exception 'Entre usando o e-mail para o qual o convite foi emitido.';
  end if;

  insert into public.clinic_members (clinic_id, user_id, role, status)
  values (v_invitation.clinic_id, auth.uid(), v_invitation.role, 'active')
  on conflict (clinic_id, user_id)
  do update set role = excluded.role, status = 'active';

  update public.clinic_invitations
  set status = 'accepted', accepted_at = now(), accepted_by = auth.uid()
  where id = v_invitation.id;

  return v_invitation.clinic_id;
end;
$$;

create or replace function public.update_clinic_member_role(p_member_id uuid, p_role public.clinic_role)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target public.clinic_members%rowtype;
  v_actor_role public.clinic_role;
  v_active_owners integer;
begin
  select * into v_target from public.clinic_members where id = p_member_id for update;
  if not found then raise exception 'Membro não encontrado.'; end if;

  select role into v_actor_role from public.clinic_members
  where clinic_id = v_target.clinic_id and user_id = auth.uid() and status = 'active';

  if not public.is_platform_admin() then
    if v_actor_role is null then raise exception 'Acesso negado.'; end if;
    if v_actor_role = 'attendant' then raise exception 'Seu papel não permite esta ação.'; end if;
    if v_actor_role = 'manager' and (v_target.role <> 'attendant' or p_role <> 'attendant') then
      raise exception 'Gestores só podem administrar atendentes.';
    end if;
  end if;

  if v_target.role = 'owner' and p_role <> 'owner' and v_target.status = 'active' then
    select count(*) into v_active_owners from public.clinic_members
    where clinic_id = v_target.clinic_id and role = 'owner' and status = 'active';
    if v_active_owners <= 1 then raise exception 'A clínica precisa manter ao menos um proprietário ativo.'; end if;
  end if;

  update public.clinic_members set role = p_role where id = p_member_id;
end;
$$;

create or replace function public.set_clinic_member_status(p_member_id uuid, p_status public.member_status)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target public.clinic_members%rowtype;
  v_actor_role public.clinic_role;
  v_active_owners integer;
begin
  select * into v_target from public.clinic_members where id = p_member_id for update;
  if not found then raise exception 'Membro não encontrado.'; end if;
  if v_target.user_id = auth.uid() then raise exception 'Você não pode desativar o próprio acesso.'; end if;

  select role into v_actor_role from public.clinic_members
  where clinic_id = v_target.clinic_id and user_id = auth.uid() and status = 'active';

  if not public.is_platform_admin() then
    if v_actor_role is null or v_actor_role = 'attendant' then raise exception 'Acesso negado.'; end if;
    if v_actor_role = 'manager' and v_target.role <> 'attendant' then
      raise exception 'Gestores só podem administrar atendentes.';
    end if;
  end if;

  if v_target.role = 'owner' and p_status = 'inactive' and v_target.status = 'active' then
    select count(*) into v_active_owners from public.clinic_members
    where clinic_id = v_target.clinic_id and role = 'owner' and status = 'active';
    if v_active_owners <= 1 then raise exception 'A clínica precisa manter ao menos um proprietário ativo.'; end if;
  end if;

  update public.clinic_members set status = p_status where id = p_member_id;
end;
$$;

create or replace function public.revoke_clinic_invitation(p_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clinic_id uuid;
begin
  select clinic_id into v_clinic_id
  from public.clinic_invitations
  where id = p_invitation_id and status = 'pending';

  if v_clinic_id is null then raise exception 'Convite pendente não encontrado.'; end if;
  if not public.has_clinic_role(v_clinic_id, array['owner', 'manager']::public.clinic_role[]) then
    raise exception 'Acesso negado.';
  end if;

  update public.clinic_invitations set status = 'revoked' where id = p_invitation_id;
end;
$$;

grant execute on function public.create_clinic_with_owner(text, text) to authenticated;
grant execute on function public.create_clinic_invitation(uuid, text, public.clinic_role) to authenticated;
grant execute on function public.get_clinic_invitation_preview(uuid) to anon, authenticated;
grant execute on function public.accept_clinic_invitation(uuid) to authenticated;
grant execute on function public.update_clinic_member_role(uuid, public.clinic_role) to authenticated;
grant execute on function public.set_clinic_member_status(uuid, public.member_status) to authenticated;
grant execute on function public.revoke_clinic_invitation(uuid) to authenticated;
