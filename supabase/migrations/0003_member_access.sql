-- 0003 — Papéis de membro (admin/member) e criação de conta com código de convite.
-- Aplicar sobre schema_snapshot.sql + 0002, SOMENTE após revisão e teste em ambiente isolado (BEGIN ... ROLLBACK).
-- Não aplicar automaticamente em produção.
-- Se ainda não houver administrador, TODOS os membros atuais viram 'admin' (hoje existe um único membro).
-- O frontend lê app_members.role e chama as RPCs abaixo: aplicar esta migration ANTES de publicar o frontend.
-- Requer no painel do Supabase: cadastro por e-mail habilitado e "Confirm email" ligado (ver docs/decisions/0005-invite-signup.md).
-- Rollback: ver bloco comentado no fim do arquivo.

begin;

-- Papel do membro. authenticated continua apenas com SELECT na própria linha (policy existente): não há como se autopromover.
alter table public.app_members add column if not exists role text not null default 'member';
alter table public.app_members drop constraint if exists app_members_role_check;
alter table public.app_members add constraint app_members_role_check check (role in ('admin','member'));
update public.app_members set role='admin' where not exists(select 1 from public.app_members where role='admin');

-- Convites: só o hash SHA-256 do código é armazenado; o código em claro aparece uma única vez para o admin.
create table if not exists private.invite_codes(
 id uuid primary key default gen_random_uuid(),
 code_hash text not null unique,
 role text not null default 'member' check (role in ('admin','member')),
 note text not null default '' check (char_length(note)<=120),
 created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null,
 used_by uuid references auth.users(id) on delete set null,
 used_at timestamptz,
 revoked_at timestamptz
);
-- Tentativas de resgate por usuário, para limitar força bruta.
create table if not exists private.invite_attempts(
 id bigint generated always as identity primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 attempted_at timestamptz not null default now()
);
create index if not exists invite_attempts_user_idx on private.invite_attempts(user_id,attempted_at);
alter table private.invite_codes enable row level security;
alter table private.invite_attempts enable row level security;
revoke all on table private.invite_codes,private.invite_attempts from public,anon,authenticated;

create or replace function private.assert_admin()
 returns void
 language plpgsql
 stable
 security definer
 set search_path to ''
as $function$
begin
if (select auth.uid()) is null or not exists(select 1 from public.app_members where user_id=(select auth.uid()) and role='admin') then raise exception 'Apenas administradores podem gerenciar usuários' using errcode='42501';end if;
end;
$function$;

create or replace function private.create_invite(p_role text, p_valid_hours integer, p_note text)
 returns table(invite_id uuid, invite_code text, invite_expires_at timestamptz)
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare v_raw text;v_code text;v_id uuid;v_exp timestamptz;
begin
perform private.assert_admin();
if p_role is null or p_role not in ('admin','member') then raise exception 'Papel inválido';end if;
if p_valid_hours is null or p_valid_hours<1 or p_valid_hours>720 then raise exception 'Validade deve ficar entre 1 e 720 horas';end if;
if char_length(btrim(coalesce(p_note,'')))>120 then raise exception 'Observação muito longa';end if;
-- 16 dígitos hexadecimais aleatórios (64 bits) de gen_random_uuid(), pulando os nibbles fixos de versão/variante.
v_raw:=upper(replace(gen_random_uuid()::text,'-',''));
v_code:=substr(v_raw,1,4)||'-'||substr(v_raw,5,4)||'-'||substr(v_raw,9,4)||'-'||substr(v_raw,19,4);
v_exp:=now()+make_interval(hours=>p_valid_hours);
insert into private.invite_codes(code_hash,role,note,created_by,expires_at)
values(encode(sha256(convert_to(v_code,'UTF8')),'hex'),p_role,btrim(coalesce(p_note,'')),(select auth.uid()),v_exp)
returning private.invite_codes.id into v_id;
return query select v_id,v_code,v_exp;
end;
$function$;

-- Retorna o papel concedido, ou NULL para código inválido/expirado/usado/revogado.
-- Não lança exceção nesses casos para que a tentativa registrada não seja desfeita pelo rollback.
create or replace function private.redeem_invite(p_code text)
 returns text
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare v_uid uuid:=(select auth.uid());v_norm text;v_invite record;
begin
if v_uid is null then raise exception 'Faça login para usar o convite' using errcode='42501';end if;
if exists(select 1 from public.app_members where user_id=v_uid) then raise exception 'Esta conta já tem acesso';end if;
if not exists(select 1 from auth.users where id=v_uid and email_confirmed_at is not null) then raise exception 'Confirme seu e-mail antes de usar o convite' using errcode='42501';end if;
if (select count(*) from private.invite_attempts where user_id=v_uid and attempted_at>now()-interval '15 minutes')>=5 then raise exception 'Muitas tentativas. Aguarde 15 minutos e tente novamente.' using errcode='42501';end if;
insert into private.invite_attempts(user_id) values(v_uid);
v_norm:=upper(regexp_replace(coalesce(p_code,''),'[^0-9A-Za-z]','','g'));
if v_norm!~'^[0-9A-F]{16}$' then return null;end if;
v_norm:=substr(v_norm,1,4)||'-'||substr(v_norm,5,4)||'-'||substr(v_norm,9,4)||'-'||substr(v_norm,13,4);
select i.id,i.role into v_invite from private.invite_codes i
 where i.code_hash=encode(sha256(convert_to(v_norm,'UTF8')),'hex') and i.used_at is null and i.revoked_at is null and i.expires_at>now()
 for update;
if not found then return null;end if;
insert into public.app_members(user_id,role) values(v_uid,v_invite.role);
update private.invite_codes set used_by=v_uid,used_at=now() where id=v_invite.id;
delete from private.invite_attempts where user_id=v_uid;
return v_invite.role;
end;
$function$;

create or replace function private.list_invites()
 returns table(invite_id uuid, role text, note text, created_at timestamptz, expires_at timestamptz, used_at timestamptz, used_by_email text, revoked_at timestamptz)
 language plpgsql
 stable
 security definer
 set search_path to ''
as $function$
begin
perform private.assert_admin();
return query select i.id,i.role,i.note,i.created_at,i.expires_at,i.used_at,u.email::text,i.revoked_at
 from private.invite_codes i left join auth.users u on u.id=i.used_by
 order by i.created_at desc limit 100;
end;
$function$;

create or replace function private.revoke_invite(p_invite_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
perform private.assert_admin();
update private.invite_codes set revoked_at=now() where id=p_invite_id and used_at is null and revoked_at is null;
if not found then raise exception 'Convite não encontrado ou já utilizado';end if;
end;
$function$;

create or replace function private.list_members()
 returns table(user_id uuid, email text, role text, created_at timestamptz)
 language plpgsql
 stable
 security definer
 set search_path to ''
as $function$
begin
perform private.assert_admin();
return query select m.user_id,u.email::text,m.role,m.created_at
 from public.app_members m join auth.users u on u.id=m.user_id
 order by m.created_at;
end;
$function$;

-- p_role NULL remove o acesso; caso contrário altera o papel. Sempre mantém ao menos um administrador.
create or replace function private.change_member(p_user_id uuid, p_role text)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare v_current text;
begin
perform private.assert_admin();
if p_role is not null and p_role not in ('admin','member') then raise exception 'Papel inválido';end if;
-- Bloqueia as linhas de admins para que duas remoções simultâneas não zerem os administradores.
perform 1 from public.app_members where role='admin' for update;
select m.role into v_current from public.app_members m where m.user_id=p_user_id for update;
if not found then raise exception 'Membro não encontrado';end if;
if v_current='admin' and coalesce(p_role,'')<>'admin' and (select count(*) from public.app_members where role='admin')<=1 then raise exception 'O sistema precisa de ao menos um administrador';end if;
if p_role is null then delete from public.app_members where user_id=p_user_id;
else update public.app_members set role=p_role where user_id=p_user_id;end if;
end;
$function$;

create or replace function public.create_invite_code(p_role text default 'member', p_valid_hours integer default 72, p_note text default '')
 returns table(invite_id uuid, invite_code text, invite_expires_at timestamptz)
 language sql
 set search_path to ''
as $function$
select * from private.create_invite(p_role,p_valid_hours,p_note);
$function$;

create or replace function public.redeem_invite_code(p_code text)
 returns text
 language sql
 set search_path to ''
as $function$
select private.redeem_invite(p_code);
$function$;

create or replace function public.list_invite_codes()
 returns table(invite_id uuid, role text, note text, created_at timestamptz, expires_at timestamptz, used_at timestamptz, used_by_email text, revoked_at timestamptz)
 language sql
 set search_path to ''
as $function$
select * from private.list_invites();
$function$;

create or replace function public.revoke_invite_code(p_invite_id uuid)
 returns void
 language sql
 set search_path to ''
as $function$
select private.revoke_invite(p_invite_id);
$function$;

create or replace function public.list_members()
 returns table(user_id uuid, email text, role text, created_at timestamptz)
 language sql
 set search_path to ''
as $function$
select * from private.list_members();
$function$;

create or replace function public.set_member_role(p_user_id uuid, p_role text)
 returns void
 language sql
 set search_path to ''
as $function$
select private.change_member(p_user_id,p_role);
$function$;

create or replace function public.remove_member(p_user_id uuid)
 returns void
 language sql
 set search_path to ''
as $function$
select private.change_member(p_user_id,null);
$function$;

revoke all on function private.assert_admin() from public,anon,authenticated;
revoke all on function private.create_invite(text,integer,text) from public,anon;
grant execute on function private.create_invite(text,integer,text) to authenticated;
revoke all on function private.redeem_invite(text) from public,anon;
grant execute on function private.redeem_invite(text) to authenticated;
revoke all on function private.list_invites() from public,anon;
grant execute on function private.list_invites() to authenticated;
revoke all on function private.revoke_invite(uuid) from public,anon;
grant execute on function private.revoke_invite(uuid) to authenticated;
revoke all on function private.list_members() from public,anon;
grant execute on function private.list_members() to authenticated;
revoke all on function private.change_member(uuid,text) from public,anon;
grant execute on function private.change_member(uuid,text) to authenticated;
revoke all on function public.create_invite_code(text,integer,text) from public,anon;
grant execute on function public.create_invite_code(text,integer,text) to authenticated;
revoke all on function public.redeem_invite_code(text) from public,anon;
grant execute on function public.redeem_invite_code(text) to authenticated;
revoke all on function public.list_invite_codes() from public,anon;
grant execute on function public.list_invite_codes() to authenticated;
revoke all on function public.revoke_invite_code(uuid) from public,anon;
grant execute on function public.revoke_invite_code(uuid) to authenticated;
revoke all on function public.list_members() from public,anon;
grant execute on function public.list_members() to authenticated;
revoke all on function public.set_member_role(uuid,text) from public,anon;
grant execute on function public.set_member_role(uuid,text) to authenticated;
revoke all on function public.remove_member(uuid) from public,anon;
grant execute on function public.remove_member(uuid) to authenticated;

commit;

-- Teste sugerido em ambiente isolado (não produção), como admin autenticado:
--   begin;
--   select set_config('request.jwt.claims', json_build_object('sub','<uuid-admin>','role','authenticated')::text, true);
--   set local role authenticated;
--   select * from public.create_invite_code('member',1,'teste');      -- guardar invite_code
--   select set_config('request.jwt.claims', json_build_object('sub','<uuid-usuario-confirmado-sem-acesso>','role','authenticated')::text, true);
--   select public.redeem_invite_code('<invite_code>');                 -- 'member'
--   select public.redeem_invite_code('<invite_code>');                 -- erro: já tem acesso
--   select public.list_members();                                      -- erro: apenas administradores
--   rollback;
--
-- Rollback (revisar antes de executar; remove convites e papéis):
-- begin;
-- drop function if exists public.create_invite_code(text,integer,text), public.redeem_invite_code(text), public.list_invite_codes(),
--   public.revoke_invite_code(uuid), public.list_members(), public.set_member_role(uuid,text), public.remove_member(uuid);
-- drop function if exists private.create_invite(text,integer,text), private.redeem_invite(text), private.list_invites(),
--   private.revoke_invite(uuid), private.list_members(), private.change_member(uuid,text), private.assert_admin();
-- drop table if exists private.invite_attempts, private.invite_codes;
-- alter table public.app_members drop constraint if exists app_members_role_check;
-- alter table public.app_members drop column if exists role;
-- commit;
