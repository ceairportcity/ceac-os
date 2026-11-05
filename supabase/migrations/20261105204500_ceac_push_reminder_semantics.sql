-- Follow-up: date-only deadlines and Calendar/routine push parity.
alter table public.ceac_push_jobs drop constraint ceac_push_jobs_source_kind_check;
alter table public.ceac_push_jobs add constraint ceac_push_jobs_source_kind_check
 check(source_kind in ('notice','work_due','work_overdue','meeting_reminder','personal_reminder','routine_reminder','calendar_reminder'));
-- Correct time semantics: date-only work is due throughout the Accra day.
-- Give a quiet morning reminder; warn once at 9 AM on the following day.
create or replace function public.ceac_push_work_alert_at(p_due timestamptz,p_kind text)
 returns timestamptz language sql stable set search_path=public,pg_temp as $$
 select case when (p_due at time zone 'Africa/Accra')::time=time '00:00:00'
   then (date_trunc('day',p_due at time zone 'Africa/Accra')
         +case when p_kind='due' then interval '9 hours' else interval '1 day 9 hours' end)
          at time zone 'Africa/Accra'
   else p_due+case when p_kind='due' then interval '-30 minutes' else interval '5 minutes' end
 end;
$$;

create or replace function public.ceac_enqueue_push_reminders()
 returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare n integer:=0; added integer;
begin
 insert into public.ceac_push_jobs(org_id,profile_id,subscription_id,source_kind,source_id,source_key,source_due_at,expires_at)
 select w.org_id,w.assignee_id,s.id,'work_due',w.id,
   'work:'||w.id::text||':due:'||to_char(w.due_at at time zone 'UTC','YYYYMMDDHH24MISS'),
   w.due_at,now()+interval '2 hours'
 from public.work_items w join public.ceac_push_subscriptions s
 on s.org_id=w.org_id and s.profile_id=w.assignee_id and s.revoked_at is null
 join public.profiles p on p.id=s.profile_id and p.active
 where w.kind <> 'routine' and w.status in ('not_started','in_progress','assigned')
   and public.ceac_push_work_alert_at(w.due_at,'due') > now()-interval '5 minutes' and public.ceac_push_work_alert_at(w.due_at,'due') <= now()+interval '5 minutes'
 limit 200
 on conflict(subscription_id,source_key) do nothing;
 get diagnostics added=row_count;n:=n+added;
 insert into public.ceac_push_jobs(org_id,profile_id,subscription_id,source_kind,source_id,source_key,source_due_at,expires_at)
 select w.org_id,w.assignee_id,s.id,'work_overdue',w.id,
   'work:'||w.id::text||':late:'||to_char(w.due_at at time zone 'UTC','YYYYMMDDHH24MISS'),
   w.due_at,now()+interval '2 hours'
 from public.work_items w join public.ceac_push_subscriptions s
 on s.org_id=w.org_id and s.profile_id=w.assignee_id and s.revoked_at is null
 join public.profiles p on p.id=s.profile_id and p.active
 where w.kind <> 'routine' and w.status in ('not_started','in_progress','assigned')
   and public.ceac_push_work_alert_at(w.due_at,'overdue') > now()-interval '5 minutes' and public.ceac_push_work_alert_at(w.due_at,'overdue') <= now()+interval '5 minutes'
 limit 200
 on conflict(subscription_id,source_key) do nothing;
 get diagnostics added=row_count;n:=n+added;
 insert into public.ceac_push_jobs(org_id,profile_id,subscription_id,source_kind,source_id,source_key,source_due_at,expires_at)
 select m.org_id,mp.profile_id,s.id,'meeting_reminder',m.id,
   'meeting:'||m.id::text||':30:'||to_char(m.starts_at at time zone 'UTC','YYYYMMDDHH24MISS'),
   m.starts_at,m.starts_at+interval '1 hour'
 from public.meeting_sessions m join public.meeting_participants mp on mp.meeting_id=m.id
 join public.ceac_push_subscriptions s on s.org_id=m.org_id and s.profile_id=mp.profile_id and s.revoked_at is null
 join public.profiles p on p.id=s.profile_id and p.active
 where coalesce(m.status,'') not ilike '%cancel%' and m.starts_at>now()+interval '25 minutes'
   and m.starts_at<=now()+interval '40 minutes'
 limit 200
 on conflict(subscription_id,source_key) do nothing;
 get diagnostics added=row_count;n:=n+added;
 insert into public.ceac_push_jobs(org_id,profile_id,subscription_id,source_kind,source_id,source_key,source_due_at,expires_at)
 select r.org_id,r.profile_id,s.id,'personal_reminder',r.id,
   'reminder:'||r.id::text,r.remind_at,r.remind_at+interval '1 hour'
 from public.personal_reminders r join public.ceac_push_subscriptions s
 on s.org_id=r.org_id and s.profile_id=r.profile_id and s.revoked_at is null
 join public.profiles p on p.id=s.profile_id and p.active
 where r.seen_at is null and r.remind_at>now()-interval '5 minutes' and r.remind_at<=now()+interval '5 minutes'
 limit 200
 on conflict(subscription_id,source_key) do nothing;
 get diagnostics added=row_count;n:=n+added;
 insert into public.ceac_push_jobs(org_id,profile_id,subscription_id,source_kind,source_id,source_key,source_due_at,expires_at)
 select d.org_id,d.for_profile_id,s.id,'routine_reminder',d.id,'routine:'||d.id::text,
   d.due_at,now()+interval '2 hours'
 from public.routine_reminder_deliveries d join public.ceac_push_subscriptions s
 on s.org_id=d.org_id and s.profile_id=d.for_profile_id and s.revoked_at is null
 join public.profiles p on p.id=s.profile_id and p.active
 where d.delivered_at>=now()-interval '10 minutes' and d.delivered_at<=now()
 limit 200
 on conflict(subscription_id,source_key) do nothing;
 get diagnostics added=row_count;n:=n+added;
 insert into public.ceac_push_jobs(org_id,profile_id,subscription_id,source_kind,source_id,source_key,source_due_at,expires_at)
 select e.org_id,e.profile_id,s.id,'calendar_reminder',e.id,
   'calendar:'||e.id::text||':'||to_char(e.reminder_at at time zone 'UTC','YYYYMMDDHH24MISS'),
   e.reminder_at,now()+interval '1 hour'
 from public.personal_calendar_events e join public.ceac_push_subscriptions s
 on s.org_id=e.org_id and s.profile_id=e.profile_id and s.revoked_at is null
 join public.profiles p on p.id=s.profile_id and p.active
 where e.reminder_at is not null and e.reminder_at>now()-interval '5 minutes'
 and e.reminder_at<=now()+interval '5 minutes'
 limit 200
 on conflict(subscription_id,source_key) do nothing;
 get diagnostics added=row_count;n:=n+added;
 return n;
end $$;
