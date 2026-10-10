-- 119 — Phase 6A: volunteer operating model.
-- Volunteer is an engagement classification, never a fifth application role.
-- Managers may invite/configure volunteers only inside their managed scope.
-- Administration retains formal employment/protected-HR authority.
-- Volunteers are excluded from ordinary salary Payroll by default.

alter table public.employment_records
  drop constraint if exists employment_records_volunteer_unit_manager_check;
alter table public.employment_records
  add constraint employment_records_volunteer_unit_manager_check
  check (employment_type<>'volunteer' or membership_role<>'manager');

alter table public.pending_invitations
  add column if not exists engagement_type text not null default 'staff',
  add column if not exists engagement_working_pattern jsonb not null default '{"kind":"not_recorded"}'::jsonb;

alter table public.pending_invitations
  drop constraint if exists pending_invitations_engagement_type_check;
alter table public.pending_invitations
  add constraint pending_invitations_engagement_type_check
  check (engagement_type in ('staff','volunteer'));

alter table public.pending_invitations
  drop constraint if exists pending_invitations_engagement_working_pattern_check;
alter table public.pending_invitations
  add constraint pending_invitations_engagement_working_pattern_check
  check (
    jsonb_typeof(engagement_working_pattern)='object'
    and coalesce(engagement_working_pattern->>'kind','not_recorded')
      in ('not_recorded','no_attendance','event_based','specific_days','custom')
  );

grant update(engagement_type,engagement_working_pattern)
  on public.pending_invitations to authenticated;

drop policy if exists pending_invitation_volunteer_update on public.pending_invitations;
create policy pending_invitation_volunteer_update
on public.pending_invitations
for update
to authenticated
using (
  org_id=public.app_org_id()
  and resolved_at is null
  and revoked_at is null
  and expires_at>now()
  and unit_id in (select public.app_managed_units())
)
with check (
  org_id=public.app_org_id()
  and resolved_at is null
  and revoked_at is null
  and expires_at>now()
  and unit_id in (select public.app_managed_units())
  and engagement_type in ('staff','volunteer')
);

create table if not exists public.volunteer_working_pattern_versions(
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete restrict,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  unit_id uuid not null references public.units(id) on delete restrict,
  pattern_kind text not null
    check(pattern_kind in ('no_attendance','event_based','specific_days','custom')),
  configuration jsonb not null default '{}'::jsonb
    check(jsonb_typeof(configuration)='object'),
  effective_from date not null default current_date,
  effective_to date,
  supersedes_id uuid references public.volunteer_working_pattern_versions(id) on delete restrict,
  reason text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  check(effective_to is null or effective_to>=effective_from)
);

create index if not exists volunteer_pattern_profile_idx
  on public.volunteer_working_pattern_versions(profile_id,effective_from desc,created_at desc);
create index if not exists volunteer_pattern_unit_idx
  on public.volunteer_working_pattern_versions(org_id,unit_id,effective_from desc);

alter table public.volunteer_working_pattern_versions enable row level security;

drop policy if exists volunteer_pattern_read on public.volunteer_working_pattern_versions;
create policy volunteer_pattern_read
on public.volunteer_working_pattern_versions
for select
to authenticated
using (
  org_id=public.app_org_id()
  and (
    profile_id=auth.uid()
    or public.app_has_capability('people.manage',null)
    or public.app_has_capability('workforce.manage',null)
    or unit_id in (select public.app_managed_units())
  )
);

drop policy if exists volunteer_pattern_insert on public.volunteer_working_pattern_versions;
create policy volunteer_pattern_insert
on public.volunteer_working_pattern_versions
for insert
to authenticated
with check (
  org_id=public.app_org_id()
  and created_by=auth.uid()
  and exists(
    select 1
    from public.employment_records er
    where er.profile_id=volunteer_working_pattern_versions.profile_id
      and er.org_id=volunteer_working_pattern_versions.org_id
      and er.unit_id=volunteer_working_pattern_versions.unit_id
      and er.employment_type='volunteer'
      and er.employment_status='active'
  )
  and (
    public.app_has_capability('people.manage',null)
    or public.app_has_capability('workforce.manage',null)
    or unit_id in (select public.app_managed_units())
  )
);

revoke all on public.volunteer_working_pattern_versions from public,anon;
grant select,insert on public.volunteer_working_pattern_versions to authenticated;

create or replace function public.phase6_sync_volunteer_working_pattern()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_pattern jsonb;
begin
  v_pattern:=jsonb_build_object('kind',new.pattern_kind) || coalesce(new.configuration,'{}'::jsonb);

  update public.employment_records
  set working_pattern=v_pattern,
      updated_at=now(),
      updated_by=new.created_by
  where profile_id=new.profile_id
    and org_id=new.org_id
    and unit_id=new.unit_id
    and employment_type='volunteer'
    and employment_status='active';

  if found then
    perform public.employment_append_snapshot(
      new.profile_id,
      'working_pattern_changed',
      new.effective_from,
      coalesce(nullif(btrim(new.reason),''),'Volunteer working arrangement updated.'),
      new.created_by,
      null
    );
  end if;

  return new;
end;
$$;

revoke all on function public.phase6_sync_volunteer_working_pattern()
  from public,anon,authenticated;

drop trigger if exists volunteer_pattern_sync_employment
  on public.volunteer_working_pattern_versions;
create trigger volunteer_pattern_sync_employment
after insert on public.volunteer_working_pattern_versions
for each row execute function public.phase6_sync_volunteer_working_pattern();

create table if not exists public.volunteer_change_recommendations(
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete restrict,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  unit_id uuid not null references public.units(id) on delete restrict,
  recommendation_kind text not null
    check(recommendation_kind in ('status_change','engagement_change','compensation_change')),
  requested_summary text not null check(length(btrim(requested_summary)) between 3 and 1000),
  reason text not null check(length(btrim(reason)) between 3 and 2000),
  status text not null default 'pending'
    check(status in ('pending','accepted','declined')),
  requested_by uuid not null references public.profiles(id) on delete restrict,
  requested_at timestamptz not null default now(),
  decided_by uuid references public.profiles(id) on delete restrict,
  decided_at timestamptz,
  decision_note text,
  check(
    (status='pending' and decided_by is null and decided_at is null)
    or
    (status in ('accepted','declined') and decided_by is not null and decided_at is not null)
  )
);

create index if not exists volunteer_change_profile_idx
  on public.volunteer_change_recommendations(profile_id,requested_at desc);
create index if not exists volunteer_change_pending_idx
  on public.volunteer_change_recommendations(org_id,status,requested_at desc);

alter table public.volunteer_change_recommendations enable row level security;

drop policy if exists volunteer_change_read on public.volunteer_change_recommendations;
create policy volunteer_change_read
on public.volunteer_change_recommendations
for select
to authenticated
using (
  org_id=public.app_org_id()
  and (
    profile_id=auth.uid()
    or public.app_has_capability('people.manage',null)
    or unit_id in (select public.app_managed_units())
  )
);

drop policy if exists volunteer_change_manager_insert on public.volunteer_change_recommendations;
create policy volunteer_change_manager_insert
on public.volunteer_change_recommendations
for insert
to authenticated
with check (
  org_id=public.app_org_id()
  and requested_by=auth.uid()
  and status='pending'
  and unit_id in (select public.app_managed_units())
  and exists(
    select 1 from public.employment_records er
    where er.profile_id=volunteer_change_recommendations.profile_id
      and er.org_id=volunteer_change_recommendations.org_id
      and er.unit_id=volunteer_change_recommendations.unit_id
      and er.employment_type='volunteer'
      and er.employment_status='active'
  )
);

drop policy if exists volunteer_change_admin_update on public.volunteer_change_recommendations;
create policy volunteer_change_admin_update
on public.volunteer_change_recommendations
for update
to authenticated
using (
  org_id=public.app_org_id()
  and public.app_has_capability('people.manage',null)
)
with check (
  org_id=public.app_org_id()
  and public.app_has_capability('people.manage',null)
);

revoke all on public.volunteer_change_recommendations from public,anon;
grant select,insert,update on public.volunteer_change_recommendations to authenticated;

create table if not exists public.volunteer_engagement_notices(
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete restrict,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  employment_history_id uuid unique references public.employment_history(id) on delete restrict,
  notice_kind text not null
    check(notice_kind in ('engagement_change','status_change','working_pattern_change')),
  title text not null,
  summary text not null,
  effective_on date not null,
  agreement_reference text,
  requires_acknowledgement boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  acknowledged_at timestamptz
);

create index if not exists volunteer_notice_profile_idx
  on public.volunteer_engagement_notices(profile_id,created_at desc);

alter table public.volunteer_engagement_notices enable row level security;

drop policy if exists volunteer_notice_read on public.volunteer_engagement_notices;
create policy volunteer_notice_read
on public.volunteer_engagement_notices
for select
to authenticated
using (
  org_id=public.app_org_id()
  and (
    profile_id=auth.uid()
    or public.app_has_capability('people.manage',null)
  )
);

drop policy if exists volunteer_notice_self_ack on public.volunteer_engagement_notices;
create policy volunteer_notice_self_ack
on public.volunteer_engagement_notices
for update
to authenticated
using (
  org_id=public.app_org_id()
  and profile_id=auth.uid()
)
with check (
  org_id=public.app_org_id()
  and profile_id=auth.uid()
);

revoke all on public.volunteer_engagement_notices from public,anon;
grant select on public.volunteer_engagement_notices to authenticated;
grant update(acknowledged_at) on public.volunteer_engagement_notices to authenticated;

create or replace function public.phase6_volunteer_employment_notice()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_previous_type text;
  v_kind text;
  v_title text;
  v_summary text;
begin
  if new.change_type='baseline_import' then
    return new;
  end if;

  select eh.employment_type
  into v_previous_type
  from public.employment_history eh
  where eh.profile_id=new.profile_id
    and eh.id<>new.id
  order by eh.created_at desc,eh.id desc
  limit 1;

  if new.employment_type<>'volunteer' and coalesce(v_previous_type,'')<>'volunteer' then
    return new;
  end if;

  v_kind:=case
    when new.change_type='working_pattern_changed' then 'working_pattern_change'
    when new.change_type in ('status_changed','exit_recorded') then 'status_change'
    else 'engagement_change'
  end;
  v_title:=case
    when v_kind='working_pattern_change' then 'Volunteer working arrangement updated'
    when v_kind='status_change' then 'Volunteer status updated'
    else 'Volunteer engagement updated'
  end;
  v_summary:=case
    when v_kind='working_pattern_change' then 'Administration recorded a change to your volunteer working arrangement.'
    when v_kind='status_change' then 'Administration recorded a change to your volunteer engagement status.'
    else 'Administration recorded a change to your volunteer engagement.'
  end;

  insert into public.volunteer_engagement_notices(
    org_id,profile_id,employment_history_id,notice_kind,title,summary,effective_on,created_by
  ) values(
    new.org_id,new.profile_id,new.id,v_kind,v_title,v_summary,new.effective_on,new.actor_id
  )
  on conflict(employment_history_id) do nothing;

  return new;
end;
$$;

revoke all on function public.phase6_volunteer_employment_notice() from public,anon,authenticated;

drop trigger if exists employment_history_volunteer_notice on public.employment_history;
create trigger employment_history_volunteer_notice
after insert on public.employment_history
for each row execute function public.phase6_volunteer_employment_notice();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_invite public.pending_invitations%rowtype;
  v_pattern jsonb;
  v_employee_id uuid;
begin
  if new.email is null then
    raise exception 'A valid CEAC invitation is required.';
  end if;

  select *
  into v_invite
  from public.pending_invitations
  where lower(email)=lower(new.email)
    and resolved_at is null
    and revoked_at is null
    and expires_at>now()
  order by invited_at desc
  limit 1
  for update;

  if v_invite.id is null then
    raise exception 'A valid, unexpired CEAC invitation is required.';
  end if;

  if v_invite.role<>'staff' then
    raise exception 'Invited accounts must begin as Staff.' using errcode='42501';
  end if;

  if not exists (
    select 1
    from public.units u
    where u.id=v_invite.unit_id
      and u.org_id=v_invite.org_id
      and u.active
  ) then
    raise exception 'The invitation unit is no longer active.' using errcode='42501';
  end if;

  v_pattern:=case
    when v_invite.engagement_type='volunteer'
      then coalesce(v_invite.engagement_working_pattern,'{"kind":"not_recorded"}'::jsonb)
    else '{"kind":"not_recorded"}'::jsonb
  end;

  insert into public.profiles(id,org_id,full_name,email,job_title)
  values(
    new.id,
    v_invite.org_id,
    coalesce(nullif(btrim(v_invite.full_name),''),split_part(lower(new.email),'@',1)),
    lower(new.email),
    null
  );

  insert into public.unit_memberships(org_id,unit_id,profile_id,role)
  values(v_invite.org_id,v_invite.unit_id,new.id,'staff');

  if v_invite.engagement_type='volunteer' then
    update public.employment_records
    set employment_type='volunteer',
        unit_id=v_invite.unit_id,
        manager_profile_id=public.employment_manager_for_unit(v_invite.org_id,v_invite.unit_id,new.id),
        membership_role='staff',
        working_pattern=v_pattern,
        employment_status='active',
        updated_at=now(),
        updated_by=v_invite.invited_by
    where profile_id=new.id;

    perform public.employment_append_snapshot(
      new.id,
      'employment_details_changed',
      current_date,
      'Volunteer engagement created from an authorised Manager invitation.',
      v_invite.invited_by,
      null
    );

    insert into public.employee_roster(
      org_id,profile_id,full_name,source_display_name,source_department_text,
      job_title,employment_type,employment_status,identity_state,
      source_system,source_row_key,created_by,updated_by
    )
    select
      v_invite.org_id,new.id,p.full_name,p.full_name,u.name,
      p.job_title,'volunteer','active','linked',
      'volunteer_invitation',v_invite.id::text,v_invite.invited_by,v_invite.invited_by
    from public.profiles p
    join public.units u on u.id=v_invite.unit_id
    where p.id=new.id
    on conflict(profile_id) do update
      set employment_type='volunteer',
          employment_status='active',
          identity_state='linked',
          updated_by=v_invite.invited_by,
          updated_at=now()
    returning id into v_employee_id;

    if v_employee_id is null then
      select id into v_employee_id from public.employee_roster where profile_id=new.id;
    end if;

    insert into public.employee_unit_memberships(
      org_id,employee_id,unit_id,is_primary,context_label,created_by,updated_by
    ) values(
      v_invite.org_id,v_employee_id,v_invite.unit_id,true,
      'Volunteer invitation placement',v_invite.invited_by,v_invite.invited_by
    )
    on conflict(employee_id,unit_id) do update
      set is_primary=true,updated_by=v_invite.invited_by,updated_at=now();

    if coalesce(v_pattern->>'kind','not_recorded') in ('no_attendance','event_based','specific_days','custom') then
      insert into public.volunteer_working_pattern_versions(
        org_id,profile_id,unit_id,pattern_kind,configuration,effective_from,reason,created_by
      ) values(
        v_invite.org_id,new.id,v_invite.unit_id,v_pattern->>'kind',
        v_pattern-'kind',current_date,
        'Initial working arrangement from volunteer invitation.',v_invite.invited_by
      );
    end if;
  end if;

  update public.pending_invitations
  set resolved_at=now()
  where id=v_invite.id;

  insert into public.activity_events(org_id,actor_id,verb,object_type,object_id,meta)
  values(
    v_invite.org_id,new.id,'account_activated','profile',new.id,
    jsonb_build_object(
      'invitation_id',v_invite.id,
      'unit_id',v_invite.unit_id,
      'engagement_type',v_invite.engagement_type
    )
  );

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public,anon,authenticated;

create or replace function public.payroll_create_run(
  p_label text,
  p_period_start date,
  p_period_end date,
  p_currency text,
  p_pay_date date default null,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_org uuid:=public.app_org_id();
  v_actor uuid:=auth.uid();
  v_period uuid;
  v_run uuid;
  v_entry uuid;
  v_row record;
  v_currency text:=upper(btrim(coalesce(p_currency,'')));
begin
  if v_actor is null
     or not public.app_has_capability('payroll.prepare',null)
     or public.app_is_exec() then
    raise exception 'Only Administration with payroll preparation authority can create a payroll run.'
      using errcode='42501';
  end if;

  if nullif(btrim(coalesce(p_label,'')),'') is null
     or p_period_start is null or p_period_end is null or p_period_end<p_period_start
     or v_currency!~'^[A-Z]{3}$' then
    raise exception 'Payroll label, valid period dates and a three-letter currency are required.';
  end if;

  if not exists(
    select 1 from public.employee_roster er
    where er.org_id=v_org
      and er.employment_status='active'
      and er.employment_type<>'volunteer'
  ) then
    raise exception 'Payroll cannot start until the roster has an active salary-eligible employee.';
  end if;

  select p.id into v_period
  from hr_private.payroll_periods p
  where p.org_id=v_org and p.period_start=p_period_start
    and p.period_end=p_period_end and p.currency=v_currency
  for update;

  if v_period is null then
    insert into hr_private.payroll_periods(
      org_id,label,period_start,period_end,pay_date,currency,created_by
    ) values (
      v_org,btrim(p_label),p_period_start,p_period_end,p_pay_date,v_currency,v_actor
    ) returning id into v_period;
  else
    if exists(select 1 from hr_private.payroll_runs r where r.period_id=v_period) then
      raise exception 'This payroll period already has a run. Use the correction flow after approval.';
    end if;
  end if;

  insert into hr_private.payroll_runs(
    org_id,period_id,revision,status,prepared_by,preparation_note
  ) values (
    v_org,v_period,1,'draft',v_actor,nullif(btrim(coalesce(p_note,'')),'')
  ) returning id into v_run;

  for v_row in
    select
      er.id employee_id,
      er.profile_id,
      er.full_name,
      c.id compensation_id,
      c.amount_minor,
      c.currency compensation_currency,
      c.basis_label,
      c.effective_on,
      c.ends_on,
      pd.id payment_id,
      pd.payment_type,
      pd.provider_name,
      pd.account_name,
      pd.account_reference,
      pd.branch_reference
    from public.employee_roster er
    left join lateral (
      select ch.*
      from hr_private.compensation_history ch
      where ch.org_id=v_org
        and ch.status='active'
        and ch.effective_on<=p_period_end
        and (ch.ends_on is null or ch.ends_on>=p_period_start)
        and (
          ch.employee_id=er.id
          or (ch.employee_id is null and er.profile_id is not null and ch.profile_id=er.profile_id)
        )
      order by ch.effective_on desc,ch.recorded_at desc
      limit 1
    ) c on true
    left join lateral (
      select pay.*
      from hr_private.payment_details pay
      where pay.org_id=v_org
        and pay.status='active'
        and (
          pay.employee_id=er.id
          or (pay.employee_id is null and er.profile_id is not null and pay.profile_id=er.profile_id)
        )
      order by pay.recorded_at desc
      limit 1
    ) pd on true
    where er.org_id=v_org
      and er.employment_status='active'
      and er.employment_type<>'volunteer'
    order by er.full_name
  loop
    insert into hr_private.payroll_entries(
      org_id,run_id,employee_id,profile_id,employee_name,currency,
      compensation_record_id,payment_detail_id,compensation_snapshot,payment_snapshot,
      updated_by
    ) values (
      v_org,v_run,v_row.employee_id,v_row.profile_id,v_row.full_name,v_currency,
      v_row.compensation_id,v_row.payment_id,
      case when v_row.compensation_id is null then '{}'::jsonb else jsonb_build_object(
        'amount_minor',v_row.amount_minor,'currency',v_row.compensation_currency,
        'basis_label',v_row.basis_label,'effective_on',v_row.effective_on,'ends_on',v_row.ends_on
      ) end,
      case when v_row.payment_id is null then '{}'::jsonb else jsonb_build_object(
        'payment_type',v_row.payment_type,'provider_name',v_row.provider_name,
        'account_name',v_row.account_name,'account_reference',v_row.account_reference,
        'branch_reference',v_row.branch_reference
      ) end,
      v_actor
    ) returning id into v_entry;

    if v_row.compensation_id is not null and v_row.compensation_currency=v_currency then
      insert into hr_private.payroll_entry_lines(
        org_id,entry_id,category,direction,label,amount_minor,source,note,created_by
      ) values (
        v_org,v_entry,'base_salary','addition','Base salary',v_row.amount_minor,
        'compensation','Recorded protected compensation for this payroll period.',v_actor
      );
    end if;
  end loop;

  perform hr_private.payroll_recalculate(v_run);

  insert into hr_private.audit_events(
    org_id,actor_id,action,resource_type,resource_id,reason,detail
  ) values (
    v_org,v_actor,'payroll_run_created','payroll_run',v_run,
    nullif(btrim(coalesce(p_note,'')),''),
    jsonb_build_object(
      'period_id',v_period,
      'currency',v_currency,
      'employee_count',(select count(*) from hr_private.payroll_entries e where e.run_id=v_run),
      'volunteers_excluded',(
        select count(*) from public.employee_roster er
        where er.org_id=v_org and er.employment_status='active' and er.employment_type='volunteer'
      )
    )
  );

  return v_run;
end;
$$;

revoke all on function public.payroll_create_run(text,date,date,text,date,text) from public,anon;
grant execute on function public.payroll_create_run(text,date,date,text,date,text) to authenticated,service_role;

create or replace function public.payroll_readiness_summary()
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_org uuid:=public.app_org_id();
  v_actor uuid:=auth.uid();
  v_result jsonb;
  v_volunteer_count integer;
begin
  if v_actor is null or not (
    public.app_has_capability('payroll.prepare',null)
    or public.app_has_capability('payroll.approve',null)
  ) then
    raise exception 'You do not have authority to view Payroll readiness.' using errcode='42501';
  end if;

  select count(*)::int into v_volunteer_count
  from public.employee_roster er
  where er.org_id=v_org
    and er.employment_status='active'
    and er.employment_type='volunteer';

  with employees as (
    select
      er.id,
      er.profile_id,
      er.full_name,
      er.identity_state,
      exists(
        select 1
        from hr_private.compensation_history ch
        where ch.org_id=v_org
          and ch.status='active'
          and (
            ch.employee_id=er.id
            or (ch.employee_id is null and er.profile_id is not null and ch.profile_id=er.profile_id)
          )
      ) as has_compensation,
      exists(
        select 1
        from hr_private.payment_details pd
        where pd.org_id=v_org
          and pd.status='active'
          and (
            pd.employee_id=er.id
            or (pd.employee_id is null and er.profile_id is not null and pd.profile_id=er.profile_id)
          )
      ) as has_payment
    from public.employee_roster er
    where er.org_id=v_org
      and er.employment_status='active'
      and er.employment_type<>'volunteer'
  )
  select jsonb_build_object(
    'employee_count',count(*)::int,
    'volunteer_count',v_volunteer_count,
    'linked_count',count(*) filter(where profile_id is not null)::int,
    'roster_only_count',count(*) filter(where identity_state='roster_only')::int,
    'identity_review_count',count(*) filter(where identity_state='needs_review')::int,
    'compensation_recorded_count',count(*) filter(where has_compensation)::int,
    'compensation_missing_count',count(*) filter(where not has_compensation)::int,
    'payment_recorded_count',count(*) filter(where has_payment)::int,
    'payment_missing_count',count(*) filter(where not has_payment)::int,
    'employees',coalesce(jsonb_agg(jsonb_build_object(
      'employee_id',id,
      'employee_name',full_name,
      'identity_state',identity_state,
      'has_compensation',has_compensation,
      'has_payment',has_payment
    ) order by full_name),'[]'::jsonb)
  )
  into v_result
  from employees;

  insert into hr_private.audit_events(
    org_id,actor_id,action,resource_type,detail
  ) values (
    v_org,v_actor,'payroll_readiness_viewed','payroll',
    jsonb_build_object('surface','payroll_readiness','volunteers_excluded',v_volunteer_count)
  );

  return coalesce(v_result,jsonb_build_object(
    'employee_count',0,
    'volunteer_count',v_volunteer_count,
    'linked_count',0,
    'roster_only_count',0,
    'identity_review_count',0,
    'compensation_recorded_count',0,
    'compensation_missing_count',0,
    'payment_recorded_count',0,
    'payment_missing_count',0,
    'employees','[]'::jsonb
  ));
end;
$$;

revoke all on function public.payroll_readiness_summary() from public,anon;
grant execute on function public.payroll_readiness_summary() to authenticated,service_role;
