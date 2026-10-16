-- Stage 2: close the SECURITY DEFINER RPC bypass of public RLS.
-- This is a FORWARD-ONLY Stage 2 migration, un-applied in original production.
-- Calls at signed AAL1 may use Auth service solely to enrol/challenge TOTP.
-- Existing signed-in/HR/unit/project business authority logic is unchanged.
-- Every replacement preserves existing OID, grants, identity and actor checks.
-- Stage 1 remains operational while universal_totp_required DEFAULT FALSE.
-- Full local Auth/RLS/RPC negative acceptance and explicit P9 owner GO remain required.
-- Existing app_can_read_announcement: preserve callable signature, grants and original business predicates.
CREATE OR REPLACE FUNCTION public.app_can_read_announcement(p_announcement_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
  select public.app_stage2_universal_aal_allowed()
    and private.can_read_announcement(p_announcement_id);
$function$

-- Existing app_identity_confirmed: preserve callable signature, grants and original business predicates.
CREATE OR REPLACE FUNCTION public.app_identity_confirmed()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from public.profiles p
    join auth.users u on u.id=p.id
    where p.id=auth.uid()
      and p.active
      and u.email_confirmed_at is not null
      and public.app_stage2_universal_aal_allowed()
  );
$function$

-- Existing app_org_id: preserve callable signature, grants and original business predicates.
CREATE OR REPLACE FUNCTION public.app_org_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select p.org_id
  from public.profiles p
  join auth.users u on u.id=p.id
  where p.id=auth.uid()
    and p.active
    and u.email_confirmed_at is not null
    and public.app_stage2_universal_aal_allowed();
$function$

-- Existing app_privileged_aal_allowed: preserve callable signature, grants and original business predicates.
CREATE OR REPLACE FUNCTION public.app_privileged_aal_allowed()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select public.app_stage2_universal_aal_allowed() and coalesce((
    select
      not o.privileged_mfa_required
      or (
        coalesce(auth.jwt()->>'aal','aal1')='aal2'
        and jsonb_path_exists(
          coalesce(auth.jwt()->'amr','[]'::jsonb),
          '$[*] ? (@.method == "totp")'
        )
        and exists (
          select 1
          from auth.mfa_factors mf
          where mf.user_id=auth.uid()
            and mf.status='verified'::auth.factor_status
            and mf.factor_type='totp'::auth.factor_type
        )
      )
    from public.profiles p
    join public.organisations o on o.id=p.org_id
    join auth.users u on u.id=p.id
    where p.id=auth.uid()
      and p.active
      and u.email_confirmed_at is not null
  ),false);
$function$

-- Existing my_account_activity: preserve callable signature, grants and original business predicates.
CREATE OR REPLACE FUNCTION public.my_account_activity(p_limit integer DEFAULT 50)
 RETURNS TABLE(at timestamp with time zone, action text, resource_type text, by_me boolean, actor_name text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select e.created_at, e.action, e.resource_type,
         (e.actor_id = auth.uid()),
         coalesce(p.full_name, 'the system')
    from platform_audit_events e
    left join profiles p on p.id = e.actor_id
   where (e.actor_id = auth.uid() or e.subject_profile_id = auth.uid())
     and public.app_stage2_universal_aal_allowed()
   order by e.created_at desc
   limit greatest(1, least(coalesce(p_limit, 50), 200));
$function$

-- Existing my_sessions: preserve callable signature, grants and original business predicates.
CREATE OR REPLACE FUNCTION public.my_sessions()
 RETURNS TABLE(session_id uuid, signed_in_at timestamp with time zone, last_seen timestamp with time zone, device text, ip text, is_current boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
  select s.id, s.created_at, coalesce(s.refreshed_at, s.updated_at, s.created_at),
         coalesce(s.user_agent, 'Unknown device'),
         coalesce(host(s.ip), 'unknown'),
         (s.id::text = current_setting('request.jwt.claims', true)::jsonb ->> 'session_id')
    from auth.sessions s
   where s.user_id = auth.uid()
     and public.app_stage2_universal_aal_allowed()
   order by coalesce(s.refreshed_at, s.updated_at, s.created_at) desc;
$function$

-- Existing update_my_personal_details: preserve callable signature, grants and original business predicates.
CREATE OR REPLACE FUNCTION public.update_my_personal_details(p_preferred_name text, p_phone text, p_birthday date, p_emergency_contact_name text, p_emergency_contact_phone text, p_emergency_contact_relationship text, p_address_text text, p_social_handles jsonb DEFAULT '{}'::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_org uuid;
  v_changed text[] := '{}';
  v_profile public.profiles;
  v_details public.profile_personal_details;
begin
  if not public.app_stage2_universal_aal_allowed() then
    raise exception 'Complete authenticator verification before updating personal details.' using errcode='42501';
  end if;
  if auth.uid() is null then
    raise exception 'Sign in to update your details.' using errcode='42501';
  end if;

  select * into v_profile
  from public.profiles
  where id=auth.uid() and active;

  if v_profile.id is null then
    raise exception 'Your active profile was not found.' using errcode='42501';
  end if;

  v_org:=v_profile.org_id;

  if p_birthday>current_date then
    raise exception 'Birthday cannot be in the future.';
  end if;

  if jsonb_typeof(coalesce(p_social_handles,'{}'::jsonb))<>'object'
     or length(coalesce(p_social_handles,'{}'::jsonb)::text)>2000 then
    raise exception 'Social handles must be a small object.';
  end if;

  if v_profile.preferred_name is distinct from nullif(btrim(coalesce(p_preferred_name,'')),'') then
    v_changed:=array_append(v_changed,'preferred_name');
  end if;
  if v_profile.phone is distinct from nullif(btrim(coalesce(p_phone,'')),'') then
    v_changed:=array_append(v_changed,'phone');
  end if;
  if v_profile.birthday is distinct from p_birthday then
    v_changed:=array_append(v_changed,'birthday');
  end if;

  select * into v_details
  from public.profile_personal_details
  where profile_id=auth.uid();

  if v_details.emergency_contact_name is distinct from nullif(btrim(coalesce(p_emergency_contact_name,'')),'')
     or v_details.emergency_contact_phone is distinct from nullif(btrim(coalesce(p_emergency_contact_phone,'')),'')
     or v_details.emergency_contact_relationship is distinct from nullif(btrim(coalesce(p_emergency_contact_relationship,'')),'') then
    v_changed:=array_append(v_changed,'emergency_contact');
  end if;

  if v_details.address_text is distinct from nullif(btrim(coalesce(p_address_text,'')),'') then
    v_changed:=array_append(v_changed,'address');
  end if;

  if coalesce(v_details.social_handles,'{}'::jsonb) is distinct from coalesce(p_social_handles,'{}'::jsonb) then
    v_changed:=array_append(v_changed,'social_handles');
  end if;

  perform set_config('ceac.profile_personal_update','on',true);

  update public.profiles
  set preferred_name=nullif(btrim(coalesce(p_preferred_name,'')),''),
      phone=nullif(btrim(coalesce(p_phone,'')),''),
      birthday=p_birthday
  where id=auth.uid();

  insert into public.profile_personal_details(
    profile_id,org_id,emergency_contact_name,emergency_contact_phone,
    emergency_contact_relationship,address_text,social_handles,updated_by
  ) values (
    auth.uid(),v_org,
    nullif(btrim(coalesce(p_emergency_contact_name,'')),''),
    nullif(btrim(coalesce(p_emergency_contact_phone,'')),''),
    nullif(btrim(coalesce(p_emergency_contact_relationship,'')),''),
    nullif(btrim(coalesce(p_address_text,'')),''),
    coalesce(p_social_handles,'{}'::jsonb),
    auth.uid()
  )
  on conflict(profile_id) do update
  set emergency_contact_name=excluded.emergency_contact_name,
      emergency_contact_phone=excluded.emergency_contact_phone,
      emergency_contact_relationship=excluded.emergency_contact_relationship,
      address_text=excluded.address_text,
      social_handles=excluded.social_handles,
      updated_at=now(),
      updated_by=auth.uid();

  if cardinality(v_changed)>0 then
    insert into public.profile_personal_detail_events(org_id,profile_id,actor_id,changed_fields)
    values(v_org,auth.uid(),auth.uid(),v_changed);
  end if;
end;
$function$
