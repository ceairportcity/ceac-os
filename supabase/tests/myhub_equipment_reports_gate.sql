\set ON_ERROR_STOP on
-- Synthetic role-based checks only. Every change is rolled back.
begin;

set local role authenticated;
select set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);

select set_config('ceac.equipment.test_report',public.asset_submit_staff_report(
  'Laptop','Lenovo','ThinkPad','STAFF-TEST-SERIAL','STAFF-REPORTED-TAG',
  'Media room','In working condition','Received at equipment handover'
)::text,true);
select set_config('ceac.equipment.test_decline',public.asset_submit_staff_report(
  'Microphone','Shure',null,null,null,'Studio','Not working','Second unverified claim'
)::text,true);

do $staff_checks$
declare
  report_id uuid:=current_setting('ceac.equipment.test_report')::uuid;
begin
  if not exists (
    select 1 from public.asset_staff_reports
    where id=report_id and reporter_id=auth.uid()
      and status='pending' and asset_id is null and reviewed_by is null
  ) then raise exception 'Staff report was not saved as unverified.'; end if;
  if exists(select 1 from public.asset_items where serial_number='STAFF-TEST-SERIAL')
  then raise exception 'Staff report silently created official inventory.'; end if;
  if has_table_privilege('authenticated','public.asset_staff_reports','INSERT')
     or has_table_privilege('authenticated','public.asset_staff_reports','UPDATE')
     or has_table_privilege('authenticated','public.asset_items','INSERT')
  then raise exception 'Staff can bypass verified RPCs via raw table access.'; end if;
  begin
    perform public.asset_resolve_staff_report(report_id,'register','STAFF-SELFAPPROVED-TAG',null,'Self approved');
    raise exception 'Staff confirmed their own inventory report.';
  exception when insufficient_privilege then null;
  end;
end;
$staff_checks$;

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000005',true);
select set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000005","role":"authenticated","aal":"aal2"}',true);
do $other_person$
begin
  if exists (
    select 1 from public.asset_staff_reports where id=current_setting('ceac.equipment.test_report')::uuid
  ) then raise exception 'One staff member can read another person equipment report.'; end if;
end;
$other_person$;

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000003',true);
select set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',true);

do $hr_decision$
declare
  report_id uuid:=current_setting('ceac.equipment.test_report')::uuid;
  decline_id uuid:=current_setting('ceac.equipment.test_decline')::uuid;
  registered_id uuid;
begin
  if not public.app_has_capability('asset.manage',null) then
    raise exception 'Test HR does not have real asset management authority.';
  end if;
  if (select count(*) from public.asset_staff_reports where id in(report_id,decline_id))<>2 then
    raise exception 'HR cannot read pending staff asset reports.';
  end if;
  registered_id:=public.asset_resolve_staff_report(
    report_id,'register','CEAC-REPORT-GATE-001',null,'HR physically verified equipment'
  );
  if registered_id is null or not exists (
    select 1 from public.asset_items where id=registered_id
      and asset_code='CEAC-REPORT-GATE-001' and serial_number='STAFF-TEST-SERIAL'
      and current_status='assigned'
      and current_assignee_profile_id='31000000-0000-4000-8000-000000000001'
  ) then raise exception 'HR verification did not register and assign the equipment atomically.'; end if;
  if not exists (
    select 1 from public.asset_staff_reports where id=report_id
      and asset_id=registered_id and reviewed_by=auth.uid()
      and status='recorded' and reviewed_at is not null
  ) then raise exception 'Staff report was not marked verified with HR identity.'; end if;
  if not exists (
    select 1 from public.asset_assignment_events
      where asset_id=registered_id and to_profile_id='31000000-0000-4000-8000-000000000001'
  ) then raise exception 'Official custody audit is missing.'; end if;
  begin
    perform public.asset_resolve_staff_report(report_id,'decline',null,null,'Attempt second decision');
    raise exception 'Previously reviewed report was accepted again.';
  exception when insufficient_privilege then null;
  end;
  perform public.asset_resolve_staff_report(decline_id,'decline',null,null,'Not confirmed at handover');
  if not exists(
    select 1 from public.asset_staff_reports where id=decline_id
      and status='declined' and asset_id is null and reviewed_by=auth.uid()
  ) then raise exception 'HR could not decline with an attributable reason.'; end if;
end;
$hr_decision$;

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
do $staff_after$
begin
  if not exists (
    select 1 from public.asset_items where asset_code='CEAC-REPORT-GATE-001'
      and current_assignee_profile_id=auth.uid()
  ) then raise exception 'HR verified equipment is not visible in the staff personal register.'; end if;
  if (select count(*) from public.asset_staff_reports
      where reporter_id=auth.uid() and status in ('recorded','declined'))<2 then
    raise exception 'Staff cannot see HR review results.'; end if;
end;
$staff_after$;
rollback;
