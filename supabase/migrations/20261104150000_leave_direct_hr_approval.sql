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
