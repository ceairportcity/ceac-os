-- CEAC first-release authentication boundary.
-- Interactive access is Google OAuth only and every enabled user must present
-- a verified TOTP factor (AAL2) before Data API or private Storage access.

create or replace function public.ceac_session_is_google_aal2()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select
    coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
    and exists (
      select 1
      from jsonb_array_elements(coalesce(auth.jwt() -> 'amr', '[]'::jsonb)) as method
      where method ->> 'method' = 'oauth'
    )
    and exists (
      select 1
      from jsonb_array_elements(coalesce(auth.jwt() -> 'amr', '[]'::jsonb)) as method
      where method ->> 'method' = 'totp'
    )
    and (
      coalesce(auth.jwt() -> 'app_metadata' ->> 'provider', '') = 'google'
      or coalesce(auth.jwt() -> 'app_metadata' -> 'providers', '[]'::jsonb) ? 'google'
    );
$$;

comment on function public.ceac_session_is_google_aal2() is
  'True only for a Google OAuth session stepped up with a verified TOTP factor to AAL2.';

revoke all on function public.ceac_session_is_google_aal2() from public;
grant execute on function public.ceac_session_is_google_aal2() to anon, authenticated, service_role;

create or replace function public.ceac_require_google_aal2()
returns void
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated')
     and not public.ceac_session_is_google_aal2() then
    raise insufficient_privilege using
      message = 'CEAC protected access requires Google sign-in and verified authenticator AAL2.';
  end if;
end;
$$;

comment on function public.ceac_require_google_aal2() is
  'PostgREST pre-request guard for CEAC Google OAuth plus TOTP AAL2 enforcement.';

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
