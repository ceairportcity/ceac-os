\set ON_ERROR_STOP on
begin;

update public.profiles set job_title = 'Group Pastor'
where id = '31000000-0000-4000-8000-000000000004';

delete from public.unit_memberships where profile_id = '31000000-0000-4000-8000-000000000004';
set local role authenticated;

do $$
declare
  staff uuid := '31000000-0000-4000-8000-000000000001';
  manager uuid := '31000000-0000-4000-8000-000000000002';
  pastor uuid := '31000000-0000-4000-8000-000000000004';
  outsider uuid := '31000000-0000-4000-8000-000000000005';
  unit uuid := '20000000-0000-4000-8000-000000000011';
  week date := date_trunc('week', now() at time zone 'Africa/Accra')::date;
  plan uuid;
  target uuid;
  first_item uuid := gen_random_uuid();
  next_item uuid := gen_random_uuid();
  linked_item uuid := gen_random_uuid();
  linked_work uuid := '26000000-0000-4000-8000-000000000011';
  revision timestamptz;
begin
  perform set_config('request.jwt.claim.sub', manager::text, true);
  plan := public.update_weekly_work_plan('create',null,null,jsonb_build_object('unit',unit,'week',week));
  if plan is distinct from public.update_weekly_work_plan('create',null,null,jsonb_build_object('unit',unit,'week',week)) then
    raise exception 'Duplicate weekly draft.';
  end if;
  perform public.update_weekly_work_plan('save',plan,first_item,
    jsonb_build_object('title','Review the filming plan','owner',staff,'day',week,'blocker','Confirm the location.','decision',true));
  perform public.update_weekly_work_plan('save',plan,next_item,
    jsonb_build_object('title','Check equipment','owner',manager));
  begin
    update public.weekly_work_plan_items set completed_at = now() where id = first_item;
    raise exception 'Browser can bypass the weekly plan write RPC.';
  exception when insufficient_privilege then null;
  end;

  perform set_config('request.jwt.claim.sub', pastor::text, true);
  if exists (select from public.weekly_work_plans where id = plan) then raise exception 'Executive can see draft.'; end if;
  perform set_config('request.jwt.claim.sub', staff::text, true);
  if exists (select from public.weekly_work_plan_items where id = first_item) then raise exception 'Staff can see draft.'; end if;
  begin
    perform public.update_weekly_work_plan('tick',plan,first_item,'{"done":true}');
    raise exception 'Staff edited a draft.';
  exception when insufficient_privilege then null;
  end;

  perform set_config('request.jwt.claim.sub', manager::text, true);
  perform public.update_weekly_work_plan('share',plan,null,'{}');
  perform public.update_weekly_work_plan('share',plan,null,'{}');
  if (select count(*) from public.memos m join public.memo_versions v on v.id=m.current_version_id
      where m.sender_id=manager and m.status='sent' and v.body like '%weeklyPlan=' || plan::text) <> 1 then
    raise exception 'Sharing did not send exactly one memo for this plan.';
  end if;
  select updated_at into revision from public.weekly_work_plan_items where id = first_item;
  perform public.update_weekly_work_plan('save',plan,first_item,
    jsonb_build_object('title','Review the revised filming plan','owner',staff,'day',week+2,'blocker','Confirm the location.','decision',true,'updated_at',revision));
  begin
    perform public.update_weekly_work_plan('drop',plan,first_item,jsonb_build_object('updated_at',revision));
    raise exception 'Stale removal overwrote a newer update.';
  exception when serialization_failure then null;
  end;

  perform set_config('request.jwt.claim.sub', pastor::text, true);
  if not exists (select from public.weekly_work_plans p where p.id=plan and p.original_plan @> '[{"title":"Review the filming plan"}]') then
    raise exception 'Sharing did not preserve the original plan.';
  end if;
  if not exists (select from public.weekly_work_plan_changes c where c.plan_id=plan and c.action='Moved' and c.next_day=week+2) then
    raise exception 'The published move was not recorded.';
  end if;
  perform public.update_weekly_work_plan('answer',plan,first_item,'{"note":"Proceed with the selected location."}');
  perform set_config('request.jwt.claim.sub', staff::text, true);
  begin
    perform public.update_weekly_work_plan('tick',plan,next_item,'{"done":true}');
    raise exception 'Staff ticked another person’s item.';
  exception when insufficient_privilege then null;
  end;
  perform public.update_weekly_work_plan('tick',plan,first_item,'{"done":true}');
  perform public.update_weekly_work_plan('tick',plan,first_item,'{"done":false}');
  if not exists (select from public.weekly_work_plan_items where id=first_item and completed_at is null and decision_response is not null) then
    raise exception 'Undo or Executive decision was not recorded.';
  end if;

  perform set_config('request.jwt.claim.sub', outsider::text, true);
  if exists (select from public.weekly_work_plan_items where id=first_item) then raise exception 'Plan leaked outside the department.'; end if;
  begin
    perform public.update_weekly_work_plan('tick',plan,first_item,'{"done":true}');
    raise exception 'Unrelated actor modified an item.';
  exception when insufficient_privilege then null;
  end;

  perform set_config('request.jwt.claim.sub', manager::text, true);
  if not exists (select from public.work_items where id=linked_work and visibility='unit' and not confidential) then
    raise exception 'Expected a visible shared-work fixture.';
  end if;
  perform public.update_weekly_work_plan('save',plan,linked_item,jsonb_build_object('work',linked_work));
  begin
    perform public.update_weekly_work_plan('tick',plan,linked_item,'{"done":true}');
    raise exception 'Linked work acquired its own completion status.';
  exception when insufficient_privilege then null;
  end;
  target := public.update_weekly_work_plan('carry',plan,next_item,'{}');
  if target is distinct from public.update_weekly_work_plan('carry',plan,next_item,'{}') or
    not exists (select from public.weekly_work_plan_items where plan_id=target and carried_from=next_item) or
    not exists (select from public.weekly_work_plan_items where id=next_item and carried_at is not null) then
    raise exception 'Carry forward was not idempotent or lost source history.';
  end if;
end;
$$;

rollback;
