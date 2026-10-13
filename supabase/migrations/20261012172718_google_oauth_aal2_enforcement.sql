-- CEAC first-release authentication boundary.
-- Interactive access is Google OAuth only and every enabled user must present
-- a verified TOTP factor (AAL2) before Data API or private Storage access.

create or replace function public.ceac_session_is_google()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
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
$$;

comment on function public.ceac_session_is_google() is
  'True only when the current Supabase session was established through Google OAuth.';

revoke all on function public.ceac_session_is_google() from public;
grant execute on function public.ceac_session_is_google() to authenticated, service_role;

create or replace function public.ceac_session_is_google_aal2()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select
    public.ceac_session_is_google()
    and coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
    and exists (
      select 1
      from jsonb_array_elements(coalesce(auth.jwt() -> 'amr', '[]'::jsonb)) as method
      where method ->> 'method' = 'totp'
    );
$$;

comment on function public.ceac_session_is_google_aal2() is
  'True only for a Google OAuth session stepped up with a verified TOTP factor to AAL2.';

revoke all on function public.ceac_session_is_google_aal2() from public;
grant execute on function public.ceac_session_is_google_aal2() to authenticated, service_role;

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
  'Returns one boolean indicating whether the current Google identity maps to its preserved active CEAC profile and may enroll or verify MFA.';

revoke all on function public.ceac_google_mfa_eligible() from public, anon;
grant execute on function public.ceac_google_mfa_eligible() to authenticated;

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
    message = 'CEAC protected access requires Google sign-in and verified authenticator AAL2.';
end;
$$;

comment on function public.ceac_require_google_aal2() is
  'PostgREST pre-request guard for CEAC Google OAuth plus TOTP AAL2 enforcement, with one boolean pre-enrollment eligibility check.';

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
