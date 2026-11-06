-- CEAC Web Push: server-owned device registry and bounded delivery queue.
-- Staged only. Never store VAPID private keys, endpoints or service tokens in source.
create table public.ceac_push_subscriptions (
 id uuid primary key default gen_random_uuid(),
 org_id uuid not null references public.organisations(id),
 profile_id uuid not null references public.profiles(id),
 endpoint text not null check (length(endpoint) between 30 and 4096),
 endpoint_hash text not null check (endpoint_hash ~ '^[0-9a-f]{64}$'),
 p256dh text not null check(length(p256dh) <= 200),
 auth_key text not null check(length(auth_key) <= 100),
 preview_allowed boolean not null default false,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 revoked_at timestamptz,
 constraint ceac_push_profile_org_check unique (id,org_id,profile_id)
);
create unique index ceac_push_active_endpoint on public.ceac_push_subscriptions(endpoint_hash)
 where revoked_at is null;
create index ceac_push_active_profile on public.ceac_push_subscriptions(org_id,profile_id)
 where revoked_at is null;
alter table public.ceac_push_subscriptions enable row level security;
revoke all on table public.ceac_push_subscriptions from public,anon,authenticated;
grant select,insert,update,delete on public.ceac_push_subscriptions to service_role;

create table public.ceac_push_jobs (
 id uuid primary key default gen_random_uuid(),
 org_id uuid not null references public.organisations(id),
 profile_id uuid not null references public.profiles(id),
 subscription_id uuid not null references public.ceac_push_subscriptions(id),
 source_kind text not null check(source_kind in
   ('notice','work_due','work_overdue','meeting_reminder','personal_reminder','routine_reminder')),
 source_id uuid not null,
 source_key text not null check(length(source_key) <= 240),
 source_due_at timestamptz,
 status text not null default 'pending' check(status in
   ('pending','sending','retry','sent','failed','cancelled')),
 attempts integer not null default 0 check(attempts between 0 and 8),
 next_attempt_at timestamptz not null default now(),
 lease_token uuid,
 lease_until timestamptz,
 delivered_at timestamptz,
 expires_at timestamptz not null default (now()+interval '24 hours'),
 failure_code text,
 created_at timestamptz not null default now(),
 unique(subscription_id,source_key)
);
create index ceac_push_ready_jobs on public.ceac_push_jobs(next_attempt_at,created_at)
 where status in ('pending','retry','sending');
create index ceac_push_jobs_retention on public.ceac_push_jobs(created_at);
alter table public.ceac_push_jobs enable row level security;
revoke all on table public.ceac_push_jobs from public,anon,authenticated;
grant select,insert,update,delete on public.ceac_push_jobs to service_role;

create or replace function public.ceac_enqueue_notification_push()
 returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 insert into public.ceac_push_jobs(org_id,profile_id,subscription_id,source_kind,source_id,source_key,expires_at)
 select new.org_id,new.recipient_id,s.id,'notice',new.id,'notice:'||new.id::text,
   new.created_at+interval '24 hours'
 from public.ceac_push_subscriptions s
 join public.profiles p on p.id=s.profile_id and p.org_id=s.org_id and p.active
 where s.org_id=new.org_id and s.profile_id=new.recipient_id and s.revoked_at is null
 on conflict(subscription_id,source_key) do nothing;
 return new;
end $$;
revoke all on function public.ceac_enqueue_notification_push() from public,anon,authenticated;
create trigger ceac_notification_enqueue_push after insert on public.ceac_notification_events
 for each row execute function public.ceac_enqueue_notification_push();

-- Bounded reminder materialisation; cron or the protected dispatch endpoint
-- invokes this. Work dates are checked against live status before delivery.
create or replace function public.ceac_enqueue_push_reminders()
 returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare n integer:=0; added integer;
begin
 insert into public.ceac_push_jobs(org_id,profile_id,subscription_id,source_kind,source_id,source_key,source_due_at,expires_at)
 select w.org_id,w.assignee_id,s.id,'work_due',w.id,
   'work:'||w.id::text||':due:'||to_char(w.due_at at time zone 'UTC','YYYYMMDDHH24MISS'),
   w.due_at,w.due_at+interval '2 hours'
 from public.work_items w join public.ceac_push_subscriptions s
 on s.org_id=w.org_id and s.profile_id=w.assignee_id and s.revoked_at is null
 join public.profiles p on p.id=s.profile_id and p.active
 where w.kind <> 'routine' and w.status in ('not_started','in_progress','assigned')
   and w.due_at > now()+interval '10 minutes' and w.due_at <= now()+interval '30 minutes'
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
   and w.due_at <= now()-interval '5 minutes' and w.due_at > now()-interval '30 minutes'
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
 return n;
end $$;
revoke all on function public.ceac_enqueue_push_reminders() from public,anon,authenticated;
grant execute on function public.ceac_enqueue_push_reminders() to service_role;

-- Atomic, cross-worker claims. The lease token must match during completion.
create or replace function public.ceac_claim_push_jobs(p_limit integer default 10)
returns setof public.ceac_push_jobs
language sql security definer set search_path=public,pg_temp as $$
 with claimed as (
   select id from public.ceac_push_jobs
   where next_attempt_at<=now() and expires_at>now() and attempts<8
    and (status in ('pending','retry') or (status='sending' and lease_until<now()))
   order by created_at,id for update skip locked
   limit least(greatest(p_limit,1),20)
 )
 update public.ceac_push_jobs j set status='sending',attempts=j.attempts+1,
   lease_token=gen_random_uuid(),lease_until=now()+interval '90 seconds'
 from claimed where j.id=claimed.id returning j.*
$$;
revoke all on function public.ceac_claim_push_jobs(integer) from public,anon,authenticated;
grant execute on function public.ceac_claim_push_jobs(integer) to service_role;

create or replace function public.ceac_finish_push_job(
 p_id uuid,p_token uuid,p_state text,p_retry_at timestamptz default null,p_failure_code text default null
) returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare changed integer;
begin
 if p_state not in ('sent','retry','failed','cancelled') then return false;end if;
 update public.ceac_push_jobs set status=p_state,lease_token=null,lease_until=null,
  next_attempt_at=coalesce(p_retry_at,now()),delivered_at=case when p_state='sent' then now() else delivered_at end,
  failure_code=left(p_failure_code,60)
 where id=p_id and lease_token=p_token and status='sending';
 get diagnostics changed=row_count;
 return changed=1;
end $$;
revoke all on function public.ceac_finish_push_job(uuid,uuid,text,timestamptz,text) from public,anon,authenticated;
grant execute on function public.ceac_finish_push_job(uuid,uuid,text,timestamptz,text) to service_role;

-- VAPID credentials are provisioned only in Supabase Vault, never SQL files.
-- Restrict decryption to the service-role Edge Function.
create or replace function public.ceac_push_server_config()
 returns jsonb language sql security definer set search_path=public,vault,pg_temp as $$
 select jsonb_build_object(
  'publicKey',max(decrypted_secret) filter(where name='ceac_web_push_public'),
  'privateKey',max(decrypted_secret) filter(where name='ceac_web_push_private'),
  'workerToken',max(decrypted_secret) filter(where name='ceac_web_push_worker_token')
 ) from vault.decrypted_secrets
$$;
revoke all on function public.ceac_push_server_config() from public,anon,authenticated;
grant execute on function public.ceac_push_server_config() to service_role;
