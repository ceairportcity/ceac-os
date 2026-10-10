\set ON_ERROR_STOP on
begin;

do $attendance_no_consequence$
declare
  r record;
  v_def text;
begin
  -- Attendance/work-session server functions may record facts, corrections and
  -- audit events. They must not execute payroll, compensation, discipline or
  -- compliance consequences.
  for r in
    select p.oid,p.proname
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and (
        p.proname ilike 'attendance%'
        or p.proname ilike '%work_session%'
        or p.proname='record_work_checkpoint'
        or p.proname='guard_attendance_response'
        or p.proname ilike 'workforce%attendance%'
      )
  loop
    v_def:=lower(pg_get_functiondef(r.oid));

    if v_def ~ '\bpayroll_[a-z0-9_]+[[:space:]]*\('
       or v_def ~ '(insert[[:space:]]+into|update|delete[[:space:]]+from)[[:space:]]+(public\.)?payroll'
       or v_def ~ '(insert[[:space:]]+into|update|delete[[:space:]]+from)[[:space:]]+hr_private\.(compensation_history|payment_details)'
       or v_def ~ '\bdisciplin(e|ary|ary_|e_)'
       or v_def ~ '\bsalary[[:space:]_]'
       or v_def ~ '(insert[[:space:]]+into|update|delete[[:space:]]+from)[[:space:]]+(public\.)?compliance' then
      raise exception 'S8 safety gate failure: function % crosses the factual-attendance consequence boundary.',r.proname;
    end if;
  end loop;

  -- Trigger functions on attendance/session evidence tables are part of the
  -- same boundary even when their names do not contain "attendance".
  for r in
    select distinct p.oid,p.proname
    from pg_trigger t
    join pg_class c on c.oid=t.tgrelid
    join pg_namespace n on n.oid=c.relnamespace
    join pg_proc p on p.oid=t.tgfoid
    where n.nspname='public'
      and c.relname in (
        'work_sessions',
        'attendance_notices',
        'attendance_returns',
        'work_session_checkpoints',
        'attendance_corrections'
      )
      and not t.tgisinternal
  loop
    v_def:=lower(pg_get_functiondef(r.oid));

    if v_def ~ '\bpayroll_[a-z0-9_]+[[:space:]]*\('
       or v_def ~ '(insert[[:space:]]+into|update|delete[[:space:]]+from)[[:space:]]+(public\.)?payroll'
       or v_def ~ '(insert[[:space:]]+into|update|delete[[:space:]]+from)[[:space:]]+hr_private\.(compensation_history|payment_details)'
       or v_def ~ '\bdisciplin(e|ary|ary_|e_)'
       or v_def ~ '\bsalary[[:space:]_]'
       or v_def ~ '(insert[[:space:]]+into|update|delete[[:space:]]+from)[[:space:]]+(public\.)?compliance' then
      raise exception 'S8 safety gate failure: attendance/session trigger function % crosses the consequence boundary.',r.proname;
    end if;
  end loop;
end
$attendance_no_consequence$;

do $attendance_privacy$
declare
  v_def text:=lower(pg_get_functiondef('public.attendance_day_evidence(date)'::regprocedure));
  v_notice_def text:=lower(pg_get_functiondef('public.attendance_create_notice(text,timestamptz,timestamptz,text,text)'::regprocedure));
begin
  -- Approved leave in the organisation-wide evidence projection is date/status
  -- context only. Protected/private leave reasons must not be added here.
  if v_def ~ 'l\.reason'
     or v_def ~ 'leave_reason'
     or v_def ~ 'medical_(reason|note|detail)' then
    raise exception 'S8 safety gate failure: attendance evidence exposes protected leave/medical narrative.';
  end if;

  if v_notice_def not like '%medical_absence%'
     or v_notice_def not like '%medical notices contain dates and status only%' then
    raise exception 'S8 safety gate failure: medical attendance notice sanitisation is missing.';
  end if;

  if not exists (
    select 1
    from pg_constraint con
    where con.conrelid='public.attendance_notices'::regclass
      and con.contype='c'
      and pg_get_constraintdef(con.oid) ilike '%medical_absence%'
      and pg_get_constraintdef(con.oid) ilike '%reason is null%'
      and pg_get_constraintdef(con.oid) ilike '%note is null%'
  ) then
    raise exception 'S8 safety gate failure: medical notice table constraint does not enforce narrative minimisation.';
  end if;
end
$attendance_privacy$;

do $attendance_automation_baseline$
begin
  -- There is currently no automatic attendance-triggered workflow/integration
  -- chain. A future notification-only integration is not categorically banned,
  -- but any such addition requires explicit S8 security review before this
  -- baseline is changed.
  if exists (
    select 1
    from public.workflow_definitions w
    where w.active
      and (
        lower(coalesce(w.trigger_event_type,'')) like '%attendance%'
        or lower(coalesce(w.trigger_event_type,'')) like '%work_session%'
      )
  ) then
    raise exception 'S8 safety gate failure: active attendance-triggered workflow requires explicit consequence-boundary review.';
  end if;

  if exists (
    select 1
    from public.integration_subscriptions s
    where s.active
      and (
        lower(coalesce(s.event_type,'')) like '%attendance%'
        or lower(coalesce(s.event_type,'')) like '%work_session%'
      )
  ) then
    raise exception 'S8 safety gate failure: active attendance-triggered integration requires explicit consequence-boundary review.';
  end if;
end
$attendance_automation_baseline$;

rollback;

select 'CEAC OS S8 attendance no-consequence gate passed' as result;
