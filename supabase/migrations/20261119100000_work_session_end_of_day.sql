-- Server-owned 5:00 PM / 5:30 PM reminders and 5:45 PM automatic cutoff.
-- Only newly opened sessions (from activation) are eligible; historical open sessions are not modified.
create table private.work_session_cutoff_activation (
 singleton boolean primary key default true check(singleton),
 activated_at timestamptz not null default now()
);
insert into private.work_session_cutoff_activation(singleton) values(true) on conflict do nothing;
create table private.work_session_end_notice_log (
 work_session_id uuid not null references public.work_sessions(id) on delete cascade,
 stage text not null check(stage in ('first','final')),
 reminder_id uuid not null default gen_random_uuid(),
 primary key(work_session_id,stage)
);

create or replace function private.safeday(p_time timestamptz) returns date
language sql immutable set search_path to '' as $helper$
select (p_time at time zone 'Africa/Accra')::date;
$helper$;

create or replace function private.run_work_session_end_of_day()
returns table(closed integer,notices integer)
language plpgsql security definer set search_path to '' as $body$
declare
 v_active timestamptz; v_today date := (now() at time zone 'Africa/Accra')::date;
 v_clock time := (now() at time zone 'Africa/Accra')::time;
 v_stage text; v_notice integer:=0; v_closed integer:=0;
 v_row record; v_cutoff timestamptz; v_due timestamptz;
begin
 if not pg_catalog.pg_try_advisory_xact_lock(1682026,1745) then
  return query select 0,0; return;
 end if;
 select activated_at into v_active from private.work_session_cutoff_activation where singleton;
 if v_clock >= time '17:00' and v_clock < time '17:45' then
  v_stage := case when v_clock < time '17:30' then 'first' else 'final' end;
  with eligible as (
   select s.id,s.org_id,s.profile_id from public.work_sessions s join public.profiles p on p.id=s.profile_id and p.org_id=s.org_id and p.active
   where s.ended_at is null and s.started_at>=v_active
    and (s.started_at at time zone 'Africa/Accra')::date=v_today
    and not (s.flags ? 'overtime_until')
  ), logged as (
   insert into private.work_session_end_notice_log(work_session_id,stage)
   select e.id,v_stage from eligible e on conflict do nothing returning work_session_id,reminder_id
  )
  insert into public.personal_reminders(org_id,profile_id,title,remind_at)
  select e.org_id,e.profile_id,
   case when v_stage='first' then 'Your workday is ending. Finish or choose overtime before 5:45 PM.'
    else 'Work closes automatically at 5:45 PM. End now or choose overtime.' end,now()
  from logged l join eligible e on e.id=l.work_session_id;
  get diagnostics v_notice=row_count;
 end if;
 for v_row in
  select s.* from public.work_sessions s
   where s.ended_at is null and s.started_at>=v_active
   order by s.started_at,s.id for update skip locked
 loop
  v_cutoff:=((private.safeday(v_row.started_at)+time '17:45') at time zone 'Africa/Accra');
  if v_row.started_at>=v_cutoff then
   v_cutoff:=((private.safeday(v_row.started_at)+time '23:55') at time zone 'Africa/Accra');
  end if;
  begin
   v_due:=coalesce((v_row.flags->>'overtime_until')::timestamptz,v_cutoff);
  exception when invalid_datetime_format then v_due:=v_cutoff;
  end;
  v_due:=greatest(v_row.started_at,v_due);
  if now()>=v_due then
   update public.work_sessions set ended_at=v_due,end_reason='auto',
    end_location_status='not_verified',
    end_location_failure='Automatic administrative cutoff; actual finish time not independently verified',
    flags=coalesce(flags,'{}'::jsonb)||jsonb_build_object('administrative_auto_close',true)
   where id=v_row.id and ended_at is null;
   if found then
    insert into public.work_session_events(org_id,work_session_id,actor_id,action,effective_at,note)
      values(v_row.org_id,v_row.id,null,'ended',v_due,'Automatic administrative cutoff; review actual hours if different.');
    insert into public.activity_events(org_id,actor_id,verb,object_type,object_id,meta)
      values(v_row.org_id,null,'session_ended','work_session',v_row.id,jsonb_build_object('effective_at',v_due,'reason','auto'));
    v_closed:=v_closed+1;
   end if;
  end if;
 end loop;
 return query select v_closed,v_notice;
end;
$body$;


CREATE OR REPLACE FUNCTION public.reconcile_work_session(p_session_id uuid, p_action text, p_effective_ended_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_note text DEFAULT NULL::text)
 RETURNS work_sessions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  s public.work_sessions;
  v_new public.work_sessions;
  v_note text:=nullif(btrim(p_note),'');
  v_effective timestamptz;
begin
  if auth.uid() is null then raise exception 'Sign in to reconcile work.'; end if;
  if p_action not in ('continue','close','overtime') then
    raise exception 'Choose continue, close or overtime.';
  end if;

  select * into s from public.work_sessions where id=p_session_id for update;
  if s.id is null then raise exception 'That work session does not exist.'; end if;
  if s.org_id<>public.app_org_id() or s.profile_id<>auth.uid() then
    raise exception 'You can only reconcile your own work session.' using errcode='42501';
  end if;
  if s.ended_at is not null then raise exception 'That work session has already ended.'; end if;

  if p_action='overtime' then
    -- The owner may explicitly extend today's open session; never claim overtime without consent.
    if (s.started_at at time zone 'Africa/Accra')::date <> (now() at time zone 'Africa/Accra')::date then
      raise exception 'Correct an earlier-day session before requesting overtime.';
    end if;
    if p_effective_ended_at is null or p_effective_ended_at<=now()
       or p_effective_ended_at>now()+interval '3 hours'
       or p_effective_ended_at>=(((now() at time zone 'Africa/Accra')::date+1)::timestamp at time zone 'Africa/Accra') then
      raise exception 'Choose an overtime limit within the next 3 hours and before midnight.';
    end if;
    if p_effective_ended_at < (((now() at time zone 'Africa/Accra')::date+time '17:45') at time zone 'Africa/Accra') then
      raise exception 'Overtime must extend beyond the regular 5:45 PM cutoff.';
    end if;
    update public.work_sessions set
      flags=coalesce(flags,'{}'::jsonb)||jsonb_build_object('overtime_until',p_effective_ended_at)
    where id=s.id returning * into s;
    insert into public.work_session_events(org_id,work_session_id,actor_id,action,effective_at,note)
    values(s.org_id,s.id,auth.uid(),'continued',p_effective_ended_at,'User opted in to continued work; this is a cutoff, not verified attendance.');
    return s;
  end if;

  if p_action='continue' then
    if (coalesce(s.last_confirmed_at,s.started_at) at time zone 'Africa/Accra')::date
       >= (now() at time zone 'Africa/Accra')::date then
      raise exception 'This session is already current and does not need recovery.';
    end if;

    v_effective:=greatest(s.started_at,coalesce(s.last_confirmed_at,s.started_at));

    update public.work_sessions
    set ended_at=v_effective,
        end_reason='reconciled',
        corrected_by=auth.uid(),
        corrected_at=now()
    where id=s.id
    returning * into s;

    insert into public.work_session_events(org_id,work_session_id,actor_id,action,effective_at,note)
    values(s.org_id,s.id,auth.uid(),'reconciled',v_effective,
      coalesce(v_note,'Closed at the last confirmed point before continuing on a new day.'));

    insert into public.work_sessions(
      org_id,profile_id,work_item_id,place,started_at,last_confirmed_at,
      lat,lng,device_time,flags
    )
    values(
      s.org_id,s.profile_id,s.work_item_id,s.place,now(),now(),
      null,null,now(),jsonb_build_object('continued_from_session_id',s.id)
    )
    returning * into v_new;

    insert into public.work_session_events(org_id,work_session_id,actor_id,action,note)
    values(v_new.org_id,v_new.id,auth.uid(),'continued',
      coalesce(v_note,'Continued from a reconciled previous-day session.'));

    insert into public.activity_events(org_id,actor_id,verb,object_type,object_id,meta)
    values(s.org_id,auth.uid(),'session_reconciled','work_session',s.id,
      jsonb_build_object('effective_at',v_effective,'continued_as_session_id',v_new.id));

    return v_new;
  else
    if p_effective_ended_at is null then
      raise exception 'Choose when the work session actually ended.';
    end if;
    if p_effective_ended_at<s.started_at or p_effective_ended_at>now() then
      raise exception 'The end time must be after the start and not in the future.';
    end if;

    update public.work_sessions
    set ended_at=p_effective_ended_at,
        end_reason='reconciled',
        corrected_by=auth.uid(),
        corrected_at=now()
    where id=s.id
    returning * into s;

    insert into public.work_session_events(org_id,work_session_id,actor_id,action,effective_at,note)
    values(s.org_id,s.id,auth.uid(),'reconciled',s.ended_at,v_note);

    insert into public.activity_events(org_id,actor_id,verb,object_type,object_id,meta)
    values(s.org_id,auth.uid(),'session_reconciled','work_session',s.id,
      jsonb_build_object('effective_at',s.ended_at,'note',v_note));

    return s;
  end if;
end;
$function$

CREATE OR REPLACE FUNCTION public.app_heartbeat()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_started timestamptz:=clock_timestamp();v_delivered integer;v_closed integer;v_notices integer;
begin
 v_delivered:=private.deliver_routine_reminders();
 select closed,notices into v_closed,v_notices from private.run_work_session_end_of_day();
 insert into public.job_runs(job_name,status,detail,duration_ms)
 values('heartbeat','ok',jsonb_build_object('at',now(),'routine_reminders',v_delivered,'auto_closed_sessions',v_closed,'end_of_day_notices',v_notices),
  (extract(epoch from clock_timestamp()-v_started)*1000)::integer);
end;
$function$

