-- 105 — ERC5: Payroll population uses the employee roster, not auth profiles.
-- profile_id remains optional compatibility context for linked employees.

alter table hr_private.payroll_entries
  add column if not exists employee_id uuid references public.employee_roster(id) on delete restrict;

update hr_private.payroll_entries e
set employee_id=er.id
from public.employee_roster er
where e.employee_id is null
  and e.profile_id=er.profile_id
  and e.org_id=er.org_id;

alter table hr_private.payroll_entries alter column profile_id drop not null;

do $ensure_existing_entries_linked$
begin
  if exists(select 1 from hr_private.payroll_entries where employee_id is null) then
    raise exception 'Payroll employee migration requires every existing entry to map to an employee roster record.';
  end if;
end
$ensure_existing_entries_linked$;

alter table hr_private.payroll_entries alter column employee_id set not null;

alter table hr_private.payroll_entries
  drop constraint if exists payroll_entries_run_id_profile_id_key;
alter table hr_private.payroll_entries
  add constraint payroll_entries_run_employee_key unique(run_id,employee_id);

create index if not exists payroll_entries_employee_idx
  on hr_private.payroll_entries(org_id,employee_id,run_id);

create or replace function public.payroll_run_detail(p_run_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_org uuid:=public.app_org_id();
  v_run jsonb;
begin
  if auth.uid() is null or not (
    public.app_has_capability('payroll.prepare',null)
    or public.app_has_capability('payroll.approve',null)
  ) then
    raise exception 'You do not have authority to view payroll.' using errcode='42501';
  end if;

  select to_jsonb(x) into v_run
  from (
    select r.id,r.revision,r.status,r.correction_of,r.prepared_by,r.prepared_at,
           r.submitted_by,r.submitted_at,r.approved_by,r.approved_at,
           r.preparation_note,r.approval_note,r.total_additions_minor,
           r.total_deductions_minor,r.total_net_minor,r.locked_at,
           p.label,p.period_start,p.period_end,p.pay_date,p.currency
    from hr_private.payroll_runs r
    join hr_private.payroll_periods p on p.id=r.period_id
    where r.id=p_run_id and r.org_id=v_org
  ) x;

  if v_run is null then
    raise exception 'Payroll run not found.' using errcode='42501';
  end if;

  insert into hr_private.audit_events(
    org_id,actor_id,action,resource_type,resource_id,detail
  ) values (
    v_org,auth.uid(),'payroll_viewed','payroll_run',p_run_id,
    jsonb_build_object('surface','payroll')
  );

  return jsonb_build_object(
    'run',v_run,
    'entries',coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id',e.id,
          'employee_id',e.employee_id,
          'profile_id',e.profile_id,
          'employee_name',e.employee_name,
          'currency',e.currency,
          'compensation_record_id',e.compensation_record_id,
          'payment_detail_id',e.payment_detail_id,
          'compensation_snapshot',e.compensation_snapshot,
          'payment_snapshot',e.payment_snapshot,
          'additions_minor',e.additions_minor,
          'deductions_minor',e.deductions_minor,
          'net_minor',e.net_minor,
          'flags',e.flags,
          'note',e.note,
          'lines',coalesce((
            select jsonb_agg(to_jsonb(lx) order by lx.created_at,lx.id)
            from (
              select l.id,l.category,l.direction,l.label,l.amount_minor,l.source,l.note,l.created_at
              from hr_private.payroll_entry_lines l
              where l.entry_id=e.id
            ) lx
          ),'[]'::jsonb)
        )
        order by e.employee_name
      )
      from hr_private.payroll_entries e
      where e.run_id=p_run_id and e.org_id=v_org
    ),'[]'::jsonb)
  );
end;
$$;

revoke all on function public.payroll_run_detail(uuid) from public,anon;
grant execute on function public.payroll_run_detail(uuid) to authenticated,service_role;

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
    where er.org_id=v_org and er.employment_status='active'
  ) then
    raise exception 'Payroll cannot start until the employee roster has active employees.';
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
    where er.org_id=v_org and er.employment_status='active'
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
      'employee_count',(select count(*) from hr_private.payroll_entries e where e.run_id=v_run)
    )
  );

  return v_run;
end;
$$;

revoke all on function public.payroll_create_run(text,date,date,text,date,text) from public,anon;
grant execute on function public.payroll_create_run(text,date,date,text,date,text) to authenticated,service_role;

create or replace function public.payroll_set_line(
  p_run_id uuid,
  p_profile_id uuid,
  p_line_id uuid,
  p_category text,
  p_direction text,
  p_label text,
  p_amount_minor bigint,
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
  v_entry uuid;
  v_line uuid;
  v_status text;
  v_employee uuid;
  v_profile uuid;
begin
  if v_actor is null
     or not public.app_has_capability('payroll.prepare',null)
     or public.app_is_exec() then
    raise exception 'Only Administration with payroll preparation authority can change a draft payroll run.'
      using errcode='42501';
  end if;

  select r.status,e.id,e.employee_id,e.profile_id
  into v_status,v_entry,v_employee,v_profile
  from hr_private.payroll_runs r
  join hr_private.payroll_entries e on e.run_id=r.id
  where r.id=p_run_id and r.org_id=v_org
    and (e.employee_id=p_profile_id or e.profile_id=p_profile_id)
    and e.org_id=v_org
  for update of r,e;

  if v_entry is null then
    raise exception 'Payroll employee entry not found.' using errcode='42501';
  end if;
  if v_status<>'draft' then
    raise exception 'Only draft payroll runs can be changed.' using errcode='42501';
  end if;

  if p_line_id is not null and p_amount_minor is null then
    delete from hr_private.payroll_entry_lines
    where id=p_line_id and entry_id=v_entry and org_id=v_org;
    if not found then raise exception 'Payroll line not found.' using errcode='42501'; end if;
    v_line:=p_line_id;
  else
    if p_amount_minor is null or p_amount_minor<0
       or nullif(btrim(coalesce(p_label,'')),'') is null then
      raise exception 'Payroll line label and non-negative amount are required.';
    end if;

    if p_category='base_salary' then
      delete from hr_private.payroll_entry_lines
      where entry_id=v_entry and category='base_salary'
        and (p_line_id is null or id<>p_line_id);
    end if;

    if p_line_id is null then
      insert into hr_private.payroll_entry_lines(
        org_id,entry_id,category,direction,label,amount_minor,source,note,created_by
      ) values (
        v_org,v_entry,p_category,p_direction,btrim(p_label),p_amount_minor,
        'manual',nullif(btrim(coalesce(p_note,'')),''),v_actor
      ) returning id into v_line;
    else
      update hr_private.payroll_entry_lines
      set category=p_category,direction=p_direction,label=btrim(p_label),
          amount_minor=p_amount_minor,source='manual',
          note=nullif(btrim(coalesce(p_note,'')),'')
      where id=p_line_id and entry_id=v_entry and org_id=v_org
      returning id into v_line;
      if v_line is null then raise exception 'Payroll line not found.' using errcode='42501'; end if;
    end if;
  end if;

  update hr_private.payroll_entries
  set updated_by=v_actor,updated_at=now()
  where id=v_entry;

  perform hr_private.payroll_recalculate(p_run_id);

  insert into hr_private.audit_events(
    org_id,actor_id,action,resource_type,resource_id,subject_profile_id,subject_employee_id,reason,detail
  ) values (
    v_org,v_actor,
    case when p_amount_minor is null then 'payroll_line_removed' else 'payroll_line_recorded' end,
    'payroll_line',v_line,v_profile,v_employee,
    nullif(btrim(coalesce(p_note,'')),''),
    jsonb_build_object('run_id',p_run_id,'category',p_category,'direction',p_direction)
  );

  return v_line;
end;
$$;

revoke all on function public.payroll_set_line(uuid,uuid,uuid,text,text,text,bigint,text) from public,anon;
grant execute on function public.payroll_set_line(uuid,uuid,uuid,text,text,text,bigint,text) to authenticated,service_role;

create or replace function public.payroll_create_correction(
  p_source_run_id uuid,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_org uuid:=public.app_org_id();
  v_actor uuid:=auth.uid();
  v_source hr_private.payroll_runs;
  v_new_run uuid;
  v_new_entry uuid;
  v_entry record;
  v_revision integer;
begin
  if v_actor is null
     or not public.app_has_capability('payroll.prepare',null)
     or public.app_is_exec() then
    raise exception 'Only Administration with payroll preparation authority can create a payroll correction.'
      using errcode='42501';
  end if;
  if nullif(btrim(coalesce(p_reason,'')),'') is null or length(btrim(p_reason))<3 then
    raise exception 'A correction reason is required.';
  end if;

  select * into v_source
  from hr_private.payroll_runs
  where id=p_source_run_id and org_id=v_org
  for share;

  if v_source.id is null then raise exception 'Approved payroll run not found.' using errcode='42501'; end if;
  if v_source.status<>'approved' then raise exception 'Corrections can only be created from an approved payroll run.'; end if;
  if exists(
    select 1 from hr_private.payroll_runs r
    where r.correction_of=p_source_run_id and r.status in ('draft','in_review')
  ) then
    raise exception 'An open correction already exists for this approved payroll run.';
  end if;

  select coalesce(max(r.revision),0)+1 into v_revision
  from hr_private.payroll_runs r
  where r.period_id=v_source.period_id;

  insert into hr_private.payroll_runs(
    org_id,period_id,revision,status,correction_of,prepared_by,preparation_note
  ) values (
    v_org,v_source.period_id,v_revision,'draft',p_source_run_id,v_actor,btrim(p_reason)
  ) returning id into v_new_run;

  for v_entry in
    select e.* from hr_private.payroll_entries e
    where e.run_id=p_source_run_id
    order by e.employee_name
  loop
    insert into hr_private.payroll_entries(
      org_id,run_id,employee_id,profile_id,employee_name,currency,
      compensation_record_id,payment_detail_id,compensation_snapshot,payment_snapshot,
      additions_minor,deductions_minor,net_minor,flags,note,updated_by
    ) values (
      v_org,v_new_run,v_entry.employee_id,v_entry.profile_id,v_entry.employee_name,v_entry.currency,
      v_entry.compensation_record_id,v_entry.payment_detail_id,
      v_entry.compensation_snapshot,v_entry.payment_snapshot,
      v_entry.additions_minor,v_entry.deductions_minor,v_entry.net_minor,
      v_entry.flags,v_entry.note,v_actor
    ) returning id into v_new_entry;

    insert into hr_private.payroll_entry_lines(
      org_id,entry_id,category,direction,label,amount_minor,source,note,created_by,created_at
    )
    select v_org,v_new_entry,l.category,l.direction,l.label,l.amount_minor,
           l.source,l.note,v_actor,l.created_at
    from hr_private.payroll_entry_lines l
    where l.entry_id=v_entry.id
    order by l.created_at,l.id;
  end loop;

  perform hr_private.payroll_recalculate(v_new_run);

  insert into hr_private.audit_events(
    org_id,actor_id,action,resource_type,resource_id,reason,detail
  ) values (
    v_org,v_actor,'payroll_correction_created','payroll_run',v_new_run,btrim(p_reason),
    jsonb_build_object('correction_of',p_source_run_id)
  );

  return v_new_run;
end;
$$;

revoke all on function public.payroll_create_correction(uuid,text) from public,anon;
grant execute on function public.payroll_create_correction(uuid,text) to authenticated,service_role;

comment on column hr_private.payroll_entries.employee_id is
  'Canonical payroll employee subject. profile_id is optional linked-account context.';
