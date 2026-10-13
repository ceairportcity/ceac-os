-- CEAC first-release authentication boundary.
-- Interactive access is Google OAuth only and every enabled user must present
-- a verified TOTP factor (AAL2) before Data API or private Storage access.

-- Auth must be configured to run this as the Before User Created hook.
-- Existing users with the same verified email are linked automatically and keep
-- their auth.users.id. A genuinely new Auth user requires a live CEAC invitation.
create or replace function public.ceac_before_user_created(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $ceac_hook$
declare
  candidate_email text := lower(coalesce(event -> 'user' ->> 'email', ''));
  candidate_provider text := coalesce(event -> 'user' -> 'app_metadata' ->> 'provider', '');
begin
  if candidate_provider <> 'google' then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'message', 'CEAC accounts must use an authorised Google invitation.',
        'http_code', 403
      )
    );
  end if;

  if candidate_email <> ''
     and exists (
       select 1
       from public.pending_invitations i
       where lower(i.email) = candidate_email
         and i.resolved_at is null
         and i.revoked_at is null
         and i.expires_at > now()
     ) then
    return '{}'::jsonb;
  end if;

  return jsonb_build_object(
    'error', jsonb_build_object(
      'message', 'This Google account is not authorised for CEAC.',
      'http_code', 403
    )
  );
end;
$ceac_hook$;

comment on function public.ceac_before_user_created(jsonb) is
  'Before User Created Auth hook: permits only Google identities with a live CEAC invitation. Existing verified-email users link without user creation.';

revoke all on function public.ceac_before_user_created(jsonb) from public, anon, authenticated;
grant execute on function public.ceac_before_user_created(jsonb) to supabase_auth_admin;

create or replace function public.ceac_session_is_google()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $ceac_google$
  select
    exists (
      select 1
      from jsonb_array_elements(coalesce(auth.jwt() -> 'amr', '[]'::jsonb)) as method
      where method ->> 'method' = 'oauth'
    )
    and (
      coalesce(auth.jwt() -> 'app_metadata' ->> 'provider', '') = 'google'
      or coalesce(auth.jwt() -> 'app_metadata' -> 'providers', '[]'::jsonb) ? 'google'
    );
$ceac_google$;

comment on function public.ceac_session_is_google() is
  'True for an OAuth session linked to Google. Release configuration must keep Google as the sole enabled OAuth provider; email may remain only as the non-OAuth rollback path.';

revoke all on function public.ceac_session_is_google() from public;
grant execute on function public.ceac_session_is_google() to authenticated, service_role;

create or replace function public.ceac_google_mfa_eligible()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    public.ceac_session_is_google()
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.active
        and lower(p.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    );
$$;

comment on function public.ceac_google_mfa_eligible() is
  'Returns one boolean indicating whether the current Google identity maps to its preserved active CEAC profile and may enroll, verify or use MFA.';

revoke all on function public.ceac_google_mfa_eligible() from public, anon;
grant execute on function public.ceac_google_mfa_eligible() to authenticated;

create or replace function public.ceac_session_is_google_aal2()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    public.ceac_google_mfa_eligible()
    and coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
    and exists (
      select 1
      from jsonb_array_elements(coalesce(auth.jwt() -> 'amr', '[]'::jsonb)) as method
      where method ->> 'method' = 'totp'
    );
$$;

comment on function public.ceac_session_is_google_aal2() is
  'True only for an active preserved CEAC identity signed in through Google OAuth and stepped up with verified TOTP to AAL2.';

revoke all on function public.ceac_session_is_google_aal2() from public;
grant execute on function public.ceac_session_is_google_aal2() to authenticated, service_role;

create or replace function public.ceac_require_google_aal2()
returns void
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  request_path text := current_setting('request.path', true);
begin
  if current_user not in ('anon', 'authenticated') then
    return;
  end if;

  if public.ceac_session_is_google_aal2() then
    return;
  end if;

  -- The sole pre-AAL2 Data API exception discloses one boolean to the
  -- signed-in Google identity itself. It cannot read or mutate application data.
  if current_user = 'authenticated'
     and request_path = 'rpc/ceac_google_mfa_eligible'
     and public.ceac_session_is_google() then
    return;
  end if;

  raise insufficient_privilege using
    message = 'CEAC protected access requires an active authorised identity, Google sign-in and verified authenticator AAL2.';
end;
$$;

comment on function public.ceac_require_google_aal2() is
  'PostgREST pre-request guard for active CEAC identity plus Google OAuth and TOTP AAL2, with one boolean pre-enrollment eligibility check.';

revoke all on function public.ceac_require_google_aal2() from public;
grant execute on function public.ceac_require_google_aal2() to anon, authenticated, service_role;

alter role authenticator set pgrst.db_pre_request = 'public.ceac_require_google_aal2';
notify pgrst, 'reload config';

-- Storage API uses database RLS rather than the PostgREST pre-request hook.
-- Restrictive policies compose with existing tenant and ownership policies.
drop policy if exists "CEAC Google AAL2 read objects" on storage.objects;
create policy "CEAC Google AAL2 read objects"
on storage.objects as restrictive for select to authenticated
using (public.ceac_session_is_google_aal2());

drop policy if exists "CEAC Google AAL2 insert objects" on storage.objects;
create policy "CEAC Google AAL2 insert objects"
on storage.objects as restrictive for insert to authenticated
with check (public.ceac_session_is_google_aal2());

drop policy if exists "CEAC Google AAL2 update objects" on storage.objects;
create policy "CEAC Google AAL2 update objects"
on storage.objects as restrictive for update to authenticated
using (public.ceac_session_is_google_aal2())
with check (public.ceac_session_is_google_aal2());

drop policy if exists "CEAC Google AAL2 delete objects" on storage.objects;
create policy "CEAC Google AAL2 delete objects"
on storage.objects as restrictive for delete to authenticated
using (public.ceac_session_is_google_aal2());

drop policy if exists "CEAC Google AAL2 read buckets" on storage.buckets;
create policy "CEAC Google AAL2 read buckets"
on storage.buckets as restrictive for select to authenticated
using (public.ceac_session_is_google_aal2());
