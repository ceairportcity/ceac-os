-- Owner-only recurring personal planning contract: disposable integration fixture.
-- Must execute after migration 147 and seeded Staff/Manager identities.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000001',true);

do $test_create$
declare
  v_series uuid;
  v_monthly uuid;
  v_weekdays uuid;
  v_first integer;
  v_second integer;
  v_row uuid;
  v_count integer;
begin
  insert into public.personal_task_series(
    org_id,profile_id,title,start_date,cadence,ends_when,occurrence_limit
  ) values(
    public.app_org_id(),auth.uid(),'Private daily series',current_date-2,
    'daily','after_count',4
  ) returning id into v_series;
  perform set_config('ceac.recurrence_test_series_id',v_series::text,true);

  v_first:=public.personal_materialize_task_series(v_series,current_date+10);
  v_second:=public.personal_materialize_task_series(v_series,current_date+10);
  if v_first<>4 or v_second<>0 then
    raise exception 'Recurrence gate: duplicate generation % first, % second',v_first,v_second;
  end if;
  select count(*) into v_count from public.personal_day_tasks
    where series_id=v_series;
  if v_count<>4 then
    raise exception 'Recurrence gate: four scheduled instances expected, got %',v_count;
  end if;
  if not exists (
    select 1 from public.personal_day_tasks
    where series_id=v_series and plan_date<current_date
      and completed_at is null and dismissed_at is null
  ) then
    raise exception 'Recurrence gate: missed occurrences were silently completed or hidden';
  end if;

  select id into v_row from public.personal_day_tasks
    where series_id=v_series and plan_date=current_date-2;
  update public.personal_day_tasks
    set completed_at=now() where id=v_row;
  update public.personal_task_series
    set title='Edited future recurring title' where id=v_series;
  perform public.personal_materialize_task_series(v_series,current_date+10);
  if not exists(
    select 1 from public.personal_day_tasks
    where id=v_row and title='Private daily series'
      and completed_at is not null
  ) then
    raise exception 'Recurrence gate: editing series rewrote completed occurrence history';
  end if;

  update public.personal_day_tasks
    set dismissed_at=now()
    where series_id=v_series and plan_date=current_date-1;
  perform public.personal_materialize_task_series(v_series,current_date+10);
  if not exists(
    select 1 from public.personal_day_tasks
    where series_id=v_series and plan_date=current_date-1
      and dismissed_at is not null
  ) then
    raise exception 'Recurrence gate: dismissed occurrence was resurrected';
  end if;

  insert into public.personal_task_series(
    org_id,profile_id,title,start_date,cadence,ends_when,occurrence_limit
  ) values(
    public.app_org_id(),auth.uid(),'Last day of month',
    '2026-01-31','monthly','after_count',3
  ) returning id into v_monthly;
  perform public.personal_materialize_task_series(v_monthly,'2026-04-01');
  if (select array_agg(plan_date order by plan_date)
      from public.personal_day_tasks where series_id=v_monthly)
     <>array['2026-01-31'::date,'2026-02-28'::date,'2026-03-31'::date] then
    raise exception 'Recurrence gate: monthly rollover must clamp to month-end';
  end if;

  insert into public.personal_task_series(
    org_id,profile_id,title,start_date,cadence,ends_when,occurrence_limit
  ) values(
    public.app_org_id(),auth.uid(),'Weekdays only',
    '2026-10-10','weekdays','after_count',3
  ) returning id into v_weekdays;
  perform public.personal_materialize_task_series(v_weekdays,'2026-10-20');
  if (select array_agg(plan_date order by plan_date)
      from public.personal_day_tasks where series_id=v_weekdays)
     <>array['2026-10-12'::date,'2026-10-13'::date,'2026-10-14'::date] then
    raise exception 'Recurrence gate: weekday pattern skipped/moved an occurrence';
  end if;
end
$test_create$;

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000002',true);

do $test_denial$
declare
  v_series uuid:=nullif(current_setting('ceac.recurrence_test_series_id',true),'')::uuid;
  v_count integer;
begin
  select count(*) into v_count from public.personal_task_series where id=v_series;
  if v_count<>0 then
    raise exception 'Recurrence gate: Manager read another person private series';
  end if;
  select count(*) into v_count from public.personal_day_tasks where series_id=v_series;
  if v_count<>0 then
    raise exception 'Recurrence gate: Manager read another person private occurrences';
  end if;
  begin
    perform public.personal_materialize_task_series(v_series,current_date+7);
    raise exception 'Recurrence gate: Manager materialised Staff series without ownership';
  exception when sqlstate '42501' then null;
  end;
  begin
    insert into public.personal_day_tasks(
      org_id,profile_id,plan_date,title,series_id
    ) values(public.app_org_id(),auth.uid(),current_date,'Invalid foreign series',v_series);
    raise exception 'Recurrence gate: Manager attached another owner private series';
  exception when sqlstate '42501' then null;
  end;
end
$test_denial$;

reset role;
rollback;
