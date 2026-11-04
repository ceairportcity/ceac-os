-- CEAC owner decision (4 November 2026): all leave is decided by HR directly.
-- Existing pending and historically escalated requests stay intact and become
-- actionable by HR. Decision/audit events continue to be append-only.
-- No changes to leave entitlements, historical policy versions, or balances.
create or replace function public.workforce_leave_action(
  p_leave_request_id uuid,
  p_action text,
  p_reason text
) returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_org uuid := public.app_org_id();
  v_actor uuid := auth.uid();
  v_request public.leave_requests;
  v_from text;
  v_to text;
  v_allowed boolean := false;
  v_hr boolean;
begin
  if v_actor is null then
    raise exception 'Sign in to update leave.' using errcode='42501';
  end if;
  if p_action not in ('admin_approved','declined','cancelled_by_employee','approval_reversed','decision_corrected') then
    raise exception 'Leave decisions must be handled by HR.' using errcode='42501';
  end if;
  if p_action <> 'cancelled_by_employee' and length(btrim(coalesce(p_reason,''))) < 3 then
    raise exception 'A reason is required.';
  end if;

  select * into v_request from public.leave_requests
  where id=p_leave_request_id and org_id=v_org for update;
  if v_request.id is null then
    raise exception 'Leave request not found.' using errcode='42501';
  end if;
  v_from := v_request.status;
  v_hr := public.app_is_admin() and public.app_has_capability('workforce.manage',null);

  if p_action='cancelled_by_employee' then
    v_allowed := v_actor=v_request.profile_id and v_from in ('pending','escalated');
    v_to := 'cancelled';
  elsif p_action='admin_approved' then
    v_allowed := v_hr and v_from in ('pending','escalated');
    v_to := 'approved';
  elsif p_action='declined' then
    v_allowed := v_hr and v_from in ('pending','escalated');
    v_to := 'declined';
  elsif p_action='approval_reversed' then
    v_allowed := v_hr and v_from='approved';
    v_to := 'pending';
  elsif p_action='decision_corrected' then
    v_allowed := v_hr and v_from in ('approved','declined','cancelled');
    v_to := v_from;
  end if;

  if not v_allowed then
    raise exception 'That leave action requires HR authority and a valid request state.'
      using errcode='42501';
  end if;

  update public.leave_requests
  set status=v_to,
      decided_by=case when p_action='cancelled_by_employee' then decided_by else v_actor end,
      decided_at=case when p_action='cancelled_by_employee' then decided_at else now() end,
      decision_note=case when p_action='cancelled_by_employee' then decision_note else btrim(p_reason) end
  where id=v_request.id;

  insert into public.leave_request_events(
    org_id,leave_request_id,profile_id,action,from_status,to_status,reason,actor_id
  ) values (
    v_org,v_request.id,v_request.profile_id,p_action,v_from,v_to,
    nullif(btrim(coalesce(p_reason,'')),''),v_actor
  );
end;
$function$;

revoke all on function public.workforce_leave_action(uuid,text,text) from public,anon;
grant execute on function public.workforce_leave_action(uuid,text,text)
to authenticated,service_role;

comment on function public.workforce_leave_action(uuid,text,text)
is 'HR-only leave decisions. Pending or legacy escalated requests may be approved or declined by an authorised HR administrator. Managers have no decision authority.';


-- Update policy authoring to match the owner-approved HR-only approval rule.
-- Keep 15 + 9 entitlements, accrual, carryover checks, RLS and all active policy
-- history intact. Both required leave pools still validate exactly as before.
CREATE OR REPLACE FUNCTION public.workforce_record_leave_policy(p_name text, p_effective_from date, p_effective_to date, p_source_reference text, p_reason text, p_rules jsonb, p_activate boolean DEFAULT false, p_supersedes_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_org uuid:=public.app_org_id();
  v_actor uuid:=auth.uid();
  v_prior public.leave_policy_versions;
  v_key uuid;
  v_version integer;
  v_id uuid;
  v_rule jsonb;
  v_kind text;
  v_complete boolean;
  v_entitlement numeric;
  v_entitlement_unit text;
  v_accrual_method text;
  v_accrual_rate numeric;
  v_carryover_method text;
  v_carryover_limit numeric;
  v_approval_route text;
  v_opening_balance_required boolean;
begin
  if v_actor is null or not public.app_has_capability('workforce.manage',null) then
    raise exception 'You do not have authority to configure leave policy.' using errcode='42501';
  end if;
  if length(btrim(coalesce(p_name,'')))<3 or length(btrim(coalesce(p_reason,'')))<3 then
    raise exception 'Policy name and reason are required.';
  end if;
  if p_effective_from is null or (p_effective_to is not null and p_effective_to<p_effective_from) then
    raise exception 'Choose a valid policy date range.';
  end if;
  if jsonb_typeof(coalesce(p_rules,'[]'::jsonb))<>'array' then
    raise exception 'Policy rules must be a JSON array.';
  end if;
  if p_activate and jsonb_array_length(coalesce(p_rules,'[]'::jsonb))=0 then
    raise exception 'An active leave policy requires at least one complete confirmed rule.';
  end if;

  if p_supersedes_id is not null then
    select * into v_prior
    from public.leave_policy_versions
    where id=p_supersedes_id and org_id=v_org;
    if v_prior.id is null then raise exception 'Policy version being superseded was not found.'; end if;
    if exists(select 1 from public.leave_policy_versions where supersedes_id=v_prior.id) then
      raise exception 'That policy version has already been superseded.';
    end if;
    v_key:=v_prior.policy_key;
    v_version:=v_prior.version+1;
  else
    v_key:=gen_random_uuid();
    v_version:=1;
  end if;

  insert into public.leave_policy_versions(
    org_id,policy_key,version,name,effective_from,effective_to,state,supersedes_id,
    source_reference,reason,confirmed_by,confirmed_at,created_by
  ) values (
    v_org,v_key,v_version,btrim(p_name),p_effective_from,p_effective_to,
    'draft',p_supersedes_id,
    nullif(btrim(coalesce(p_source_reference,'')),''),btrim(p_reason),
    null,null,v_actor
  )
  returning id into v_id;

  for v_rule in select value from jsonb_array_elements(p_rules)
  loop
    v_kind:=lower(btrim(coalesce(v_rule->>'leave_kind','')));
    if length(v_kind)<2 then
      raise exception 'Every leave-policy rule needs a leave kind.';
    end if;

    v_entitlement:=nullif(v_rule->>'entitlement_amount','')::numeric;
    v_entitlement_unit:=nullif(v_rule->>'entitlement_unit','');
    v_accrual_method:=nullif(v_rule->>'accrual_method','');
    v_accrual_rate:=nullif(v_rule->>'accrual_rate','')::numeric;
    v_carryover_method:=nullif(v_rule->>'carryover_method','');
    v_carryover_limit:=nullif(v_rule->>'carryover_limit','')::numeric;
    -- Owner decision: no leave type may be configured with Manager approval.
    -- Record HR-only routing even for an older client submitting legacy route text.
    v_approval_route:='admin';
    v_opening_balance_required:=coalesce((v_rule->>'opening_balance_required')::boolean,false);

    if v_kind='annual' and (
      nullif(btrim(coalesce(v_rule->>'employment_type','')),'') is not null
      or v_entitlement is distinct from 15::numeric
      or v_entitlement_unit is distinct from 'days'
      or v_accrual_method is distinct from 'quarterly'
      or v_accrual_rate is distinct from 3.75::numeric
      or v_carryover_method is distinct from 'none'
      or v_carryover_limit is not null
      or v_approval_route is distinct from 'admin'
      or v_opening_balance_required
    ) then
      raise exception 'Annual leave is 15 working days, 3.75 per completed quarter, no routine carry-over, HR-only approval.';
    end if;

    -- Sick and study consume ONE shared allowance, not nine days each.
    -- Maternity/paternity are not silently capped by this owner clarification.
    if v_kind in ('sick','study') then
      raise exception 'Sick and study use the shared_other policy rule; do not give them separate allowances.';
    end if;
    if v_kind='shared_other' and (
      nullif(btrim(coalesce(v_rule->>'employment_type','')),'') is not null
      or v_entitlement is distinct from 9::numeric
      or v_entitlement_unit is distinct from 'days'
      or v_accrual_method is distinct from 'quarterly'
      or v_accrual_rate is distinct from 2.25::numeric
      or v_carryover_method is distinct from 'none'
      or v_carryover_limit is not null
      or v_approval_route is distinct from 'admin'
      or v_opening_balance_required
    ) then
      raise exception 'Sick and study share 9 working days, 2.25 per completed quarter, no routine carry-over, HR-only approval.';
    end if;
    if exists(select 1 from public.leave_policy_rules where policy_version_id=v_id and leave_kind=v_kind
       and employment_type is not distinct from nullif(btrim(coalesce(v_rule->>'employment_type','')),'')) then
      raise exception 'A policy must not contain duplicate leave rules.';
    end if;

    v_complete:=
      v_entitlement is not null
      and v_entitlement>=0
      and v_entitlement_unit is not null
      and v_accrual_method is not null
      and v_carryover_method is not null
      and v_approval_route is not null
      and (v_accrual_method not in ('monthly','quarterly') or v_accrual_rate is not null)
      and (v_carryover_method<>'limited' or v_carryover_limit is not null);

    insert into public.leave_policy_rules(
      org_id,policy_version_id,leave_kind,employment_type,
      entitlement_amount,entitlement_unit,accrual_method,accrual_rate,
      carryover_method,carryover_limit,approval_route,opening_balance_required,complete
    ) values (
      v_org,v_id,v_kind,nullif(btrim(coalesce(v_rule->>'employment_type','')),''),
      v_entitlement,v_entitlement_unit,v_accrual_method,v_accrual_rate,
      v_carryover_method,v_carryover_limit,v_approval_route,
      v_opening_balance_required,v_complete
    );
  end loop;

  if p_activate then
    if exists(
      select 1 from public.leave_policy_rules
      where policy_version_id=v_id and not complete
    ) then
      raise exception 'Only fully configured leave rules can be activated.';
    end if;

    if not exists(
      select 1
      from public.leave_policy_rules
      where policy_version_id=v_id
        and leave_kind='annual'
        and employment_type is null
        and entitlement_amount=15
        and entitlement_unit='days'
        and accrual_method='quarterly'
        and accrual_rate=3.75
        and carryover_method='none'
        and carryover_limit is null
        and approval_route='admin'
        and not opening_balance_required
        and complete
    ) then
      raise exception 'An active CEAC leave policy must preserve the locked annual-leave rule.';
    end if;

    if not exists(select 1 from public.leave_policy_rules where policy_version_id=v_id
      and leave_kind='shared_other' and employment_type is null
      and entitlement_amount=9 and entitlement_unit='days'
      and accrual_method='quarterly' and accrual_rate=2.25
      and carryover_method='none' and carryover_limit is null
      and approval_route='admin' and not opening_balance_required and complete) then
      raise exception 'An active policy must include the single shared 9-day sick/study allowance.';
    end if;

    update public.leave_policy_versions
    set state='retired'
    where org_id=v_org and state='active';

    update public.leave_policy_versions
    set state='active',confirmed_by=v_actor,confirmed_at=now()
    where id=v_id;
  end if;

  return v_id;
end;
$function$;

