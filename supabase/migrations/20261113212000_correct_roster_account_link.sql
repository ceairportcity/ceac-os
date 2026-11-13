-- Correct a verified employee's login link without changing operational roles.
create function public.admin_correct_roster_account_link(
  p_employee_id uuid,
  p_previous_profile_id uuid,
  p_profile_id uuid,
  p_expected_updated_at timestamptz,
  p_evidence_file_id uuid,
  p_confirmed_account_email text,
  p_independently_verified boolean,
  p_reason text
) returns jsonb
language plpgsql security definer set search_path=''
as $correction$
declare
  v_org uuid := public.app_org_id();
  v_employee public.employee_roster%rowtype;
  v_reason text := btrim(coalesce(p_reason, ''));
  v_schedule_count integer;
begin
  if auth.uid() is null or v_org is null or not public.app_is_admin()
    or not public.app_stage2_universal_aal_allowed() then
    raise exception 'Only authorised Administration may correct an employee account link.' using errcode='42501';
  end if;
  if p_previous_profile_id is null or p_profile_id is null
    or p_previous_profile_id = p_profile_id
    or p_expected_updated_at is null or p_evidence_file_id is null
    or p_independently_verified is distinct from true
    or length(v_reason) not between 12 and 2000 then
    raise exception 'Confirm both accounts, the private document and the reason for this correction.' using errcode='22023';
  end if;

  select * into v_employee from public.employee_roster
  where id=p_employee_id and org_id=v_org for update;
  if not found or v_employee.profile_id is distinct from p_previous_profile_id
    or v_employee.updated_at is distinct from p_expected_updated_at
    or v_employee.employment_status <> 'active' then
    raise exception 'The employee record changed or is inactive. Reopen it before correcting the account.' using errcode='40001';
  end if;

  perform 1 from public.profiles
  where org_id=v_org and id in (p_previous_profile_id,p_profile_id)
  order by id for update;
  if not exists (
    select 1 from public.profiles p join auth.users a on a.id=p.id
    where p.id=p_profile_id and p.org_id=v_org and p.active
      and a.email_confirmed_at is not null
      and lower(btrim(a.email))=lower(btrim(p.email))
      and lower(btrim(a.email))=lower(btrim(p_confirmed_account_email))
  ) or exists (
    select 1 from public.employee_roster where profile_id=p_profile_id
  ) then
    raise exception 'The replacement login must be an active, verified account with no employee record linked.' using errcode='42501';
  end if;

  perform 1 from public.operational_file_links l
  join public.operational_files f on f.id=l.file_id and f.org_id=l.org_id
  where l.org_id=v_org and l.context_type='employee_document'
    and l.context_id=p_employee_id and l.file_id=p_evidence_file_id
    and f.state='active' and f.storage_bucket='ceac-operational-private'
    and f.finalised_at is not null
  for share of l,f;
  if not found then
    raise exception 'Select a finalised private document from this employee record.' using errcode='42501';
  end if;
  if not exists (
    select 1 from public.employee_unit_memberships e
    join public.unit_memberships m on m.org_id=e.org_id and m.unit_id=e.unit_id
    where e.org_id=v_org and e.employee_id=p_employee_id and m.profile_id=p_profile_id
  ) then
    raise exception 'The replacement login needs an operational unit in common with the employee record.' using errcode='42501';
  end if;

  -- Roster schedule rows keep their IDs, versions, dates and provenance.
  -- Refuse to combine independent schedule histories silently.
  if exists (
    select 1 from public.workforce_schedule_versions s where s.org_id=v_org
    and s.profile_id=p_profile_id and s.employee_id is distinct from p_employee_id
  ) or exists (
    select 1 from public.workforce_schedule_versions s where s.org_id=v_org
    and s.employee_id=p_employee_id and s.profile_id is not null
    and s.profile_id not in (p_previous_profile_id,p_profile_id)
  ) then
    raise exception 'These accounts have conflicting schedule records. Reconcile the schedules before replacing the link.' using errcode='23514';
  end if;

  update public.workforce_schedule_versions set profile_id=p_profile_id
  where org_id=v_org and employee_id=p_employee_id and profile_id=p_previous_profile_id;
  get diagnostics v_schedule_count = row_count;

  update public.employee_roster
  set profile_id=p_profile_id, updated_at=clock_timestamp(), updated_by=auth.uid()
  where id=p_employee_id and org_id=v_org;

  insert into public.employee_roster_change_events(
    org_id, employee_id, actor_id, reason, before_record, after_record
  ) values (
    v_org, p_employee_id, auth.uid(), v_reason,
    jsonb_build_object('linked_profile_id',p_previous_profile_id),
    jsonb_build_object('linked_profile_id',p_profile_id,
      'evidence_file_id',p_evidence_file_id,'schedule_versions_relinked',v_schedule_count)
  );
  return jsonb_build_object('employee_id',p_employee_id,'profile_id',p_profile_id,'linked',true);
end
$correction$;

revoke all on function public.admin_correct_roster_account_link(uuid,uuid,uuid,timestamptz,uuid,text,boolean,text)
  from public,anon,authenticated;
grant execute on function public.admin_correct_roster_account_link(uuid,uuid,uuid,timestamptz,uuid,text,boolean,text)
  to authenticated;
