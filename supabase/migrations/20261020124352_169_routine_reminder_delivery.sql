-- 169: opt-in routine reminders through existing CEAC Messages/heartbeat.
-- No external recipient transmission, new provider, automatic approval or completion.
alter table public.recurring_operations add column reminder_minutes_before integer
 check(reminder_minutes_before between 0 and 1440);
alter table public.routine_schedule_versions add column reminder_minutes_before integer
 check(reminder_minutes_before between 0 and 1440);

create function private.routine_schedule_dates(p_work_item_ids uuid[],p_from_date date,p_through_date date,p_org_id uuid)
returns table(operation_id uuid,scheduled_on date,schedule_version integer,due_at timestamptz,timezone text,due_time time,state text)
language plpgsql stable security invoker set search_path='' as $preview$
begin
 if current_user='authenticated' and (
  auth.uid() is null or p_org_id is distinct from public.app_org_id()
  or not public.app_stage2_universal_aal_allowed()) then
  raise exception 'An active verified account in this organisation is required.' using errcode='42501';
 end if;
 if p_org_id is null then raise exception 'An organisation is required.' using errcode='22023'; end if;
 if p_work_item_ids is null or cardinality(p_work_item_ids)>200
  or p_from_date is null or p_through_date is null or p_through_date<p_from_date
  or p_through_date-p_from_date>370 or p_through_date>current_date+370 then
  raise exception 'Use at most 200 responsibilities and a bounded one-year date window.' using errcode='22023';
 end if;
 if exists(select 1 from public.recurring_operations r join public.routine_schedule_versions v on v.operation_id=r.id
  where r.work_item_id=any(p_work_item_ids) and r.org_id=p_org_id
   and v.occurrence_limit is not null and v.effective_from<p_through_date-7305
   and coalesce(v.effective_to,p_through_date)>=p_from_date) then
  raise exception 'Count-limited schedule history exceeds the supported twenty-year window.' using errcode='22023';
 end if;
 return query
 with candidates as (
  select r.id op_id,r.active,r.paused_at,v.version,v.timezone tz,v.due_time,v.occurrence_limit,
    d::date day_value,
    row_number() over(partition by v.id order by d) ordinal
  from public.recurring_operations r
  join public.work_items w on w.id=r.work_item_id and w.org_id=r.org_id
  join public.routine_schedule_versions v on v.operation_id=r.id
  cross join lateral pg_catalog.generate_series(
   greatest(r.starts_on,v.effective_from,case when v.occurrence_limit is null then p_from_date else v.effective_from end)::timestamp,
   least(p_through_date,coalesce(r.ends_on,p_through_date),coalesce(v.effective_to,p_through_date))::timestamp,
   interval '1 day') d
  where r.work_item_id=any(p_work_item_ids) and r.org_id=p_org_id
   and (r.active or r.paused_at is not null)
   and v.effective_from<=p_through_date and coalesce(v.effective_to,p_through_date)>=p_from_date
   and case v.schedule_kind
    when 'daily' then (d::date-v.effective_from)%v.interval_count=0
    when 'weekly' then extract(isodow from d)::integer=any(v.weekdays)
      and (((d::date-v.effective_from+extract(isodow from v.effective_from)::integer-1)/7)%v.interval_count)=0
    when 'weekdays' then extract(isodow from d)::integer=any(v.weekdays)
      and (((d::date-v.effective_from+extract(isodow from v.effective_from)::integer-1)/7)%v.interval_count)=0
    when 'monthly' then extract(day from d)::integer=v.day_of_month
      and (((extract(year from d)::integer-extract(year from v.effective_from)::integer)*12
        +extract(month from d)::integer-extract(month from v.effective_from)::integer)%v.interval_count)=0
    else false end
 ), visible_dates as (
  select c.*,o.id proof_id,(c.day_value+coalesce(c.due_time,time '23:59:59.999999')) at time zone c.tz due_value
  from candidates c left join public.operation_occurrences o on o.operation_id=c.op_id and o.occurred_on=c.day_value
  where c.day_value between p_from_date and p_through_date
   and (c.occurrence_limit is null or c.ordinal<=c.occurrence_limit)
   and (o.id is not null or (
    not (c.paused_at is not null and c.day_value >= (c.paused_at at time zone c.tz)::date)
    and not exists(select 1 from public.routine_pause_periods p where p.operation_id=c.op_id
      and c.day_value >= (p.paused_at at time zone c.tz)::date
      and (p.resumed_at is null or c.day_value < (p.resumed_at at time zone c.tz)::date))
   ))
 )
 select c.op_id,c.day_value,c.version,c.due_value,c.tz,c.due_time,
  case when c.proof_id is not null then 'recorded' when c.due_value<now() then 'unrecorded_past' else 'scheduled' end
 from visible_dates c order by c.day_value,c.op_id;
end;
$preview$;
revoke all on function private.routine_schedule_dates(uuid[],date,date,uuid) from public,anon,authenticated;
grant execute on function private.routine_schedule_dates(uuid[],date,date,uuid) to authenticated,service_role;

create or replace function public.routine_schedule_preview(p_work_item_ids uuid[],p_from_date date,p_through_date date)
returns table(operation_id uuid,scheduled_on date,schedule_version integer,due_at timestamptz,timezone text,due_time time,state text)
language plpgsql stable security invoker set search_path='' as $api$
begin
 if auth.uid() is null or public.app_org_id() is null or not public.app_stage2_universal_aal_allowed() then
  raise exception 'Sign in with an active verified account.' using errcode='42501';
 end if;
 return query select * from private.routine_schedule_dates(p_work_item_ids,p_from_date,p_through_date,public.app_org_id());
end;
$api$;

create or replace function public.create_typed_work(
  p_kind text,
  p_unit_id uuid,
  p_title text,
  p_assignee_id uuid default null,
  p_sub_team_id uuid default null,
  p_project_id uuid default null,
  p_phase_id uuid default null,
  p_objective_id uuid default null,
  p_responsibility_id uuid default null,
  p_purpose text default null,
  p_expected_outcome text default null,
  p_due_at timestamptz default null,
  p_visibility text default 'unit',
  p_confidential boolean default false,
  p_details jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item uuid;
  v_org uuid;
  v_origin text;
  v_ref text;
  v_step text;
  v_position integer := 0;
  v_operation uuid;
  v_schedule text;
  v_weekdays smallint[];
  v_day integer;
  v_starts date;
  v_ends date;
  v_records_value boolean;
  v_value_label text;
  v_target date;
  v_responsible_unit uuid;
  v_question text;
  v_meeting_title text;
  v_meeting_on date;
  v_event uuid;
  v_evidence_required boolean;
  v_evidence_kind text;
begin
  if auth.uid() is null or public.app_org_id() is null or not public.app_stage2_universal_aal_allowed() then
    raise exception 'Complete authenticator verification before changing work.' using errcode='42501';
  end if;
  p_details := coalesce(p_details,'{}'::jsonb);
  v_origin := coalesce(p_details->>'origin','assigned');
  if v_origin not in ('assigned','self_created') or (v_origin='self_created' and p_kind<>'routine') then
    raise exception 'Unsupported typed-work origin.' using errcode='22023';
  end if;

  if p_kind='routine' then
    v_schedule := nullif(p_details->>'schedule_kind','');
    if v_schedule not in ('daily','weekly','monthly','weekdays') then
      raise exception 'Routine schedule must be daily, weekly, monthly or selected weekdays.';
    end if;
    v_starts := coalesce(nullif(p_details->>'starts_on','')::date,current_date);
    v_ends := nullif(p_details->>'ends_on','')::date;
    if v_ends is not null and v_ends < v_starts then
      raise exception 'Routine end date cannot be before its start date.';
    end if;

    if p_details ? 'weekdays' then
      select array_agg(x::smallint order by ord)
      into v_weekdays
      from jsonb_array_elements_text(p_details->'weekdays') with ordinality as a(x,ord);
    end if;

    if v_weekdays is not null and exists (
      select 1 from unnest(v_weekdays) d where d < 1 or d > 7
    ) then
      raise exception 'Routine weekdays use ISO days 1 to 7.';
    end if;

    if v_schedule='weekly' and coalesce(array_length(v_weekdays,1),0)=0 then
      v_weekdays := array[extract(isodow from v_starts)::smallint];
    end if;
    if v_schedule='weekdays' and coalesce(array_length(v_weekdays,1),0)=0 then
      raise exception 'Choose at least one weekday for this routine.';
    end if;

    if v_schedule='monthly' then
      v_day := coalesce(nullif(p_details->>'day_of_month','')::int,extract(day from v_starts)::int);
      if v_day not between 1 and 31 then raise exception 'Monthly day must be 1 to 31.'; end if;
    end if;

    v_records_value := coalesce((p_details->>'records_value')::boolean,false);
    v_value_label := nullif(btrim(p_details->>'value_label'),'');
    if v_records_value and v_value_label is null then
      raise exception 'Name the number this routine records.';
    end if;

    if v_origin='self_created' then
      -- A distinct, narrow self-work path. It cannot assign another person,
      -- create another typed kind, or borrow managerial/executive authority.
      v_org := public.app_org_id();
      if auth.uid() is null or v_org is null then
        raise exception 'Sign in with an active CEAC account.' using errcode='42501';
      end if;
      if p_assignee_id is distinct from auth.uid() or p_visibility is distinct from 'unit'
         or coalesce(p_confidential,false) then
        raise exception 'Your recurring responsibility must belong to you and your department.' using errcode='42501';
      end if;
      if nullif(btrim(p_title),'') is null or nullif(btrim(p_expected_outcome),'') is null then
        raise exception 'Enter the responsibility and expected result.' using errcode='22023';
      end if;
      if not exists (
        select 1 from public.unit_memberships m
        join public.units u on u.id=m.unit_id and u.org_id=m.org_id
        join public.profiles p on p.id=m.profile_id and p.org_id=m.org_id
        where m.profile_id=auth.uid() and m.unit_id=p_unit_id and m.org_id=v_org and u.active and p.active
      ) then
        raise exception 'You are not an active member of that department.' using errcode='42501';
      end if;
      if p_sub_team_id is not null and not exists (
        select 1 from public.sub_teams t where t.id=p_sub_team_id and t.unit_id=p_unit_id and t.org_id=v_org and t.active
      ) then raise exception 'That team part does not belong to your department.' using errcode='42501'; end if;
      if p_project_id is not null then
        if not exists (
          select 1 from public.projects p where p.id=p_project_id and p.org_id=v_org and p.status in ('planned','active')
          and (p.lead_unit_id=p_unit_id or exists (select 1 from public.project_units pu where pu.project_id=p.id and pu.unit_id=p_unit_id))
        ) then raise exception 'That project is not active for your department.' using errcode='42501'; end if;
      elsif p_phase_id is not null or p_objective_id is not null then
        raise exception 'Select a project before its objective or phase.' using errcode='22023';
      end if;
      if p_objective_id is not null and not exists (
        select 1 from public.objectives o where o.id=p_objective_id and o.project_id=p_project_id and o.unit_id=p_unit_id
      ) then raise exception 'That objective does not belong to this department and project.' using errcode='42501'; end if;
      if p_phase_id is not null and not exists (
        select 1 from public.project_phases ph where ph.id=p_phase_id and ph.project_id=p_project_id
      ) then raise exception 'That phase does not belong to this project.' using errcode='42501'; end if;
      if p_responsibility_id is not null and not exists (
        select 1 from public.responsibilities r where r.id=p_responsibility_id and r.unit_id=p_unit_id and r.org_id=v_org
      ) then raise exception 'That responsibility does not belong to your department.' using errcode='42501'; end if;
      if jsonb_typeof(coalesce(p_details->'steps','[]'::jsonb)) <> 'array'
         or jsonb_array_length(coalesce(p_details->'steps','[]'::jsonb)) > 12 then
        raise exception 'Use at most twelve completion steps.' using errcode='22023';
      end if;
      v_item := gen_random_uuid();
      v_ref := public.next_work_ref(p_unit_id,p_sub_team_id);
      -- Existing typed-work trigger contract, entered only after the narrow
      -- actor, membership, relationship and origin checks above.
      perform set_config('ceac.typed_create','on',true);
      insert into public.work_items (
        id,org_id,ref,kind,unit_id,sub_team_id,project_id,phase_id,objective_id,responsibility_id,
        assignee_id,assigned_by,title,purpose,expected_outcome,origin,visibility,confidential,status
      ) values (
        v_item,v_org,v_ref,'routine',p_unit_id,p_sub_team_id,p_project_id,p_phase_id,p_objective_id,p_responsibility_id,
        auth.uid(),auth.uid(),btrim(p_title),nullif(btrim(p_purpose),''),btrim(p_expected_outcome),
        'self_created','unit',false,'in_progress'
      );
      for v_step in select jsonb_array_elements_text(coalesce(p_details->'steps','[]'::jsonb)) loop
        if nullif(btrim(v_step),'') is not null then
          v_position := v_position+1;
          insert into public.checklist_items(work_item_id,label,position) values(v_item,btrim(v_step),v_position);
        end if;
      end loop;
    else
      v_item := create_typed_work_base(
        p_kind,p_unit_id,p_title,p_assignee_id,p_sub_team_id,p_project_id,p_phase_id,p_objective_id,
        p_responsibility_id,p_purpose,p_expected_outcome,null,p_visibility,p_confidential,'in_progress'
      );
    end if;

    insert into recurring_operations(
      org_id,unit_id,sub_team_id,responsibility_id,name,cadence,records_value,value_label,active,
      work_item_id,starts_on,ends_on,paused_at,schedule_kind,weekdays,day_of_month,interval_count,timezone,due_time,occurrence_limit,reminder_minutes_before
    )
    values(
      app_org_id(),p_unit_id,p_sub_team_id,p_responsibility_id,btrim(p_title),v_schedule,
      v_records_value,v_value_label,true,v_item,v_starts,v_ends,null,v_schedule,v_weekdays,v_day,
      coalesce((p_details->>'interval_count')::integer,1),coalesce(nullif(p_details->>'timezone',''),'Africa/Accra'),
      nullif(p_details->>'due_time','')::time,nullif(p_details->>'occurrence_limit','')::integer,nullif(p_details->>'reminder_minutes_before','')::integer
    )
    returning id into v_operation;

    insert into routine_schedule_versions(
      operation_id,version,effective_from,schedule_kind,weekdays,day_of_month,created_by,interval_count,timezone,due_time,occurrence_limit,reminder_minutes_before
    )
    values(v_operation,1,v_starts,v_schedule,v_weekdays,v_day,auth.uid(),
      coalesce((p_details->>'interval_count')::integer,1),coalesce(nullif(p_details->>'timezone',''),'Africa/Accra'),
      nullif(p_details->>'due_time','')::time,nullif(p_details->>'occurrence_limit','')::integer,nullif(p_details->>'reminder_minutes_before','')::integer);

  elsif p_kind='case' then
    if p_assignee_id is null then raise exception 'A case needs a named owner.'; end if;
    v_target := nullif(p_details->>'target_resolution_on','')::date;
    v_starts := coalesce(nullif(p_details->>'opened_on','')::date,current_date);
    if v_target is not null and v_target < v_starts then
      raise exception 'Case target date cannot be before it opened.';
    end if;

    v_item := create_typed_work_base(
      p_kind,p_unit_id,p_title,p_assignee_id,p_sub_team_id,p_project_id,p_phase_id,p_objective_id,
      p_responsibility_id,p_purpose,p_expected_outcome,p_due_at,p_visibility,p_confidential,'in_progress'
    );
    insert into work_cases(work_item_id,opened_on,target_resolution_on)
    values(v_item,v_starts,v_target);

  elsif p_kind='request' then
    if p_details ? 'responsible_unit_id' and nullif(p_details->>'responsible_unit_id','') is not null then
      v_responsible_unit := (p_details->>'responsible_unit_id')::uuid;
    end if;
    if p_assignee_id is null and v_responsible_unit is null then
      raise exception 'A request needs a responsible person or unit.';
    end if;
    if v_responsible_unit is not null and not exists (
      select 1 from units u where u.id=v_responsible_unit and u.org_id=app_org_id()
    ) then
      raise exception 'That responsible unit does not belong to this organisation.';
    end if;
    if p_assignee_id is not null and not exists (
      select 1
      from profiles p
      where p.id=p_assignee_id
        and p.org_id=app_org_id()
        and p.active
    ) then
      raise exception 'That responsible person is not active in this organisation.';
    end if;
    if p_assignee_id is not null and v_responsible_unit is not null and not exists (
      select 1 from unit_memberships m
      where m.profile_id=p_assignee_id and m.unit_id=v_responsible_unit and m.org_id=app_org_id()
    ) then
      raise exception 'That responsible person is not a member of the selected responsible unit.';
    end if;
    if p_confidential and p_assignee_id is null then
      raise exception 'A confidential request needs a named responsible person.';
    end if;

    v_item := create_typed_work_base(
      p_kind,p_unit_id,p_title,p_assignee_id,p_sub_team_id,p_project_id,p_phase_id,p_objective_id,
      p_responsibility_id,p_purpose,p_expected_outcome,p_due_at,p_visibility,p_confidential,'waiting_on'
    );
    insert into work_requests(work_item_id,requester_id,responsible_profile_id,responsible_unit_id)
    values(v_item,auth.uid(),p_assignee_id,v_responsible_unit);

  elsif p_kind='decision' then
    if p_assignee_id is null then raise exception 'A decision needs a named decision-maker.'; end if;
    v_question := coalesce(nullif(btrim(p_details->>'question'),''),btrim(p_title));

    v_item := create_typed_work_base(
      p_kind,p_unit_id,p_title,p_assignee_id,p_sub_team_id,p_project_id,p_phase_id,p_objective_id,
      p_responsibility_id,p_purpose,p_expected_outcome,p_due_at,p_visibility,p_confidential,'not_started'
    );
    insert into work_decisions(work_item_id,authority_profile_id,question)
    values(v_item,p_assignee_id,v_question);

  elsif p_kind='meeting_outcome' then
    if p_assignee_id is null then raise exception 'A meeting outcome needs an owner.'; end if;
    v_meeting_title := nullif(btrim(p_details->>'meeting_title'),'');
    v_meeting_on := nullif(p_details->>'meeting_on','')::date;
    if v_meeting_title is null or v_meeting_on is null then
      raise exception 'Record the meeting title and date.';
    end if;
    if p_details ? 'source_event_id' and nullif(p_details->>'source_event_id','') is not null then
      v_event := (p_details->>'source_event_id')::uuid;
      if not exists (select 1 from ministry_events e where e.id=v_event and e.org_id=app_org_id()) then
        raise exception 'That calendar event does not belong to this organisation.';
      end if;
    end if;

    v_item := create_typed_work_base(
      p_kind,p_unit_id,p_title,p_assignee_id,p_sub_team_id,p_project_id,p_phase_id,p_objective_id,
      p_responsibility_id,p_purpose,p_expected_outcome,p_due_at,p_visibility,p_confidential,'not_started'
    );
    insert into work_meeting_outcomes(work_item_id,meeting_title,meeting_on,meeting_note,source_event_id)
    values(v_item,v_meeting_title,v_meeting_on,nullif(btrim(p_details->>'meeting_note'),''),v_event);

  elsif p_kind='deliverable' then
    if p_assignee_id is null then raise exception 'A deliverable needs an owner.'; end if;
    if p_expected_outcome is null or length(btrim(p_expected_outcome))=0 then
      raise exception 'State what the finished deliverable must be.';
    end if;
    v_evidence_required := coalesce((p_details->>'evidence_required')::boolean,true);
    v_evidence_kind := coalesce(nullif(p_details->>'evidence_kind',''),case when v_evidence_required then 'file_or_link' else 'none' end);
    if v_evidence_kind not in ('file_or_link','file','link','none') then
      raise exception 'Deliverable evidence type is not supported.';
    end if;
    if not v_evidence_required then v_evidence_kind := 'none'; end if;

    v_item := create_typed_work_base(
      p_kind,p_unit_id,p_title,p_assignee_id,p_sub_team_id,p_project_id,p_phase_id,p_objective_id,
      p_responsibility_id,p_purpose,p_expected_outcome,p_due_at,p_visibility,p_confidential,'not_started'
    );
    insert into work_deliverables(work_item_id,evidence_required,evidence_kind)
    values(v_item,v_evidence_required,v_evidence_kind);

  else
    raise exception 'Unsupported typed work kind.';
  end if;

  insert into activity_events(org_id,actor_id,verb,object_type,object_id,meta)
  values(app_org_id(),auth.uid(),'created','work_item',v_item,jsonb_build_object('kind',p_kind,'origin',v_origin));

  return v_item;
end;
$$;

revoke all on function public.create_typed_work(text,uuid,text,uuid,uuid,uuid,uuid,uuid,uuid,text,text,timestamptz,text,boolean,jsonb)
  from public, anon;
grant execute on function public.create_typed_work(text,uuid,text,uuid,uuid,uuid,uuid,uuid,uuid,text,text,timestamptz,text,boolean,jsonb)
  to authenticated, service_role;




create or replace function public.change_routine_schedule(
  p_work_item_id uuid,
  p_effective_from date,
  p_schedule_kind text,
  p_weekdays smallint[] default null,
  p_day_of_month integer default null,
  p_ends_on date default null
)
returns integer
language plpgsql
security definer
set search_path=public
as $$
declare
  ro record;
  v_latest record;
  v_version integer;
begin
  if auth.uid() is null or public.app_org_id() is null or not public.app_stage2_universal_aal_allowed() then
    raise exception 'Sign in with the required account verification.' using errcode='42501';
  end if;
  select * into ro from recurring_operations where work_item_id=p_work_item_id for update;
  if ro is null then raise exception 'That routine does not exist.'; end if;
  if ro.org_id is distinct from app_org_id() then raise exception 'That belongs to another organisation.' using errcode='42501'; end if;
  if not (ro.unit_id in (select app_managed_units()) or app_is_admin() or exists (
    select 1 from public.work_items w join public.unit_memberships m
      on m.profile_id=auth.uid() and m.unit_id=w.unit_id and m.org_id=w.org_id
    where w.id=ro.work_item_id and w.org_id=app_org_id() and w.origin='self_created'
      and w.assignee_id=auth.uid() and w.assigned_by=auth.uid()
  )) then
    raise exception 'Only its creator, the department head or Administration can change this routine.' using errcode='42501';
  end if;
  if p_effective_from is null then
    raise exception 'Choose when the schedule starts.';
  end if;
  if p_schedule_kind not in ('daily','weekly','monthly','weekdays') then
    raise exception 'Routine schedule must be daily, weekly, monthly or selected weekdays.';
  end if;
  if p_weekdays is not null and exists (select 1 from unnest(p_weekdays) d where d<1 or d>7) then
    raise exception 'Routine weekdays use ISO days 1 to 7.';
  end if;
  if p_schedule_kind in ('weekly','weekdays') and coalesce(array_length(p_weekdays,1),0)=0 then
    raise exception 'Choose the scheduled weekday(s).';
  end if;
  if p_schedule_kind='monthly' and (p_day_of_month is null or p_day_of_month not between 1 and 31) then
    raise exception 'Monthly routines need a day from 1 to 31.';
  end if;
  if p_ends_on is not null and p_ends_on<p_effective_from then
    raise exception 'Routine end date cannot be before the new schedule starts.';
  end if;

  select * into v_latest
  from routine_schedule_versions
  where operation_id=ro.id
  order by version desc
  limit 1;

  if v_latest.id is null then
    if p_effective_from < current_date then
      raise exception 'The first configured schedule cannot start in the past.';
    end if;
  else
    if p_effective_from <= current_date then
      raise exception 'A schedule change must start on a future date.';
    end if;
    if p_effective_from <= v_latest.effective_from then
      raise exception 'The new schedule must start after the current schedule version.';
    end if;
  end if;

  if v_latest.id is not null then
    update routine_schedule_versions
    set effective_to=p_effective_from-1
    where id=v_latest.id;
    v_version:=v_latest.version+1;
  else
    v_version:=1;
  end if;

  insert into routine_schedule_versions(
    operation_id,version,effective_from,schedule_kind,weekdays,day_of_month,created_by,interval_count,timezone,due_time,occurrence_limit,reminder_minutes_before
  ) values(ro.id,v_version,p_effective_from,p_schedule_kind,p_weekdays,p_day_of_month,auth.uid(),ro.interval_count,ro.timezone,ro.due_time,ro.occurrence_limit,ro.reminder_minutes_before);

  update recurring_operations
  set cadence=p_schedule_kind,
      schedule_kind=p_schedule_kind,
      weekdays=p_weekdays,
      day_of_month=p_day_of_month,
      starts_on=coalesce(starts_on,p_effective_from),
      ends_on=p_ends_on
  where id=ro.id;

  insert into activity_events(org_id,actor_id,verb,object_type,object_id,meta)
  values(ro.org_id,auth.uid(),'routine_schedule_changed','work_item',p_work_item_id,
         jsonb_build_object('version',v_version,'effective_from',p_effective_from));

  return v_version;
end;
$$;

revoke all on function public.change_routine_schedule(uuid,date,text,smallint[],integer,date) from public,anon;
grant execute on function public.change_routine_schedule(uuid,date,text,smallint[],integer,date) to authenticated,service_role;




create or replace function private.change_routine_schedule_options(p_work_item_id uuid,p_effective_from date,p_options jsonb)
returns integer language plpgsql security definer set search_path='' as $options$
declare v_version integer; v_operation uuid; v_weekdays smallint[];
begin
 if auth.uid() is null or public.app_org_id() is null or not public.app_stage2_universal_aal_allowed() then
  raise exception 'Sign in with an active verified account.' using errcode='42501';
 end if;
 if p_options is null or jsonb_typeof(p_options)<>'object' or octet_length(p_options::text)>4000 then
  raise exception 'Provide a schedule.' using errcode='22023';
 end if;
 if p_options ? 'weekdays' then
  select array_agg(x::smallint) into v_weekdays from jsonb_array_elements_text(p_options->'weekdays') x;
 end if;
 v_version:=public.change_routine_schedule(p_work_item_id,p_effective_from,p_options->>'schedule_kind',
   v_weekdays,nullif(p_options->>'day_of_month','')::integer,nullif(p_options->>'ends_on','')::date);
 select r.id into strict v_operation from public.recurring_operations r where r.work_item_id=p_work_item_id;
 update public.routine_schedule_versions set
  interval_count=coalesce((p_options->>'interval_count')::integer,1),
  timezone=coalesce(nullif(p_options->>'timezone',''),'Africa/Accra'),
  due_time=nullif(p_options->>'due_time','')::time,
  occurrence_limit=nullif(p_options->>'occurrence_limit','')::integer,
  reminder_minutes_before=nullif(p_options->>'reminder_minutes_before','')::integer
 where operation_id=v_operation and version=v_version;
 update public.recurring_operations set
  interval_count=coalesce((p_options->>'interval_count')::integer,1),
  timezone=coalesce(nullif(p_options->>'timezone',''),'Africa/Accra'),
  due_time=nullif(p_options->>'due_time','')::time,
  occurrence_limit=nullif(p_options->>'occurrence_limit','')::integer,
  reminder_minutes_before=nullif(p_options->>'reminder_minutes_before','')::integer
 where id=v_operation;
 insert into public.activity_events(org_id,actor_id,verb,object_type,object_id,meta)
 values(public.app_org_id(),auth.uid(),'routine_schedule_options_changed','work_item',p_work_item_id,
  jsonb_build_object('version',v_version,'effective_from',p_effective_from,'options',p_options));
 return v_version;
end;
$options$;
revoke all on function private.change_routine_schedule_options(uuid,date,jsonb) from public,anon,authenticated;
grant execute on function private.change_routine_schedule_options(uuid,date,jsonb) to authenticated,service_role;

-- Opt-in in-app reminders. Existing heartbeat is the only scheduler.
create table public.routine_reminder_deliveries(
 id uuid primary key default gen_random_uuid(),
 org_id uuid not null references public.organisations(id) on delete restrict,
 operation_id uuid not null references public.recurring_operations(id) on delete restrict,
 work_item_id uuid not null references public.work_items(id) on delete restrict,
 for_profile_id uuid not null references public.profiles(id) on delete restrict,
 scheduled_on date not null,
 due_at timestamptz not null,
 delivered_at timestamptz not null default now(),
 unique(operation_id,scheduled_on,for_profile_id)
);
create index routine_reminder_recipient_idx on public.routine_reminder_deliveries(for_profile_id,org_id,delivered_at desc);
create index routine_reminder_work_idx on public.routine_reminder_deliveries(work_item_id);
create index routine_reminder_org_idx on public.routine_reminder_deliveries(org_id);
alter table public.routine_reminder_deliveries enable row level security;
revoke all on public.routine_reminder_deliveries from public,anon,authenticated;
grant select on public.routine_reminder_deliveries to authenticated;
grant select,insert on public.routine_reminder_deliveries to service_role;
create policy routine_reminder_recipient_read on public.routine_reminder_deliveries
 for select to authenticated using (
  for_profile_id=(select auth.uid()) and org_id=(select public.app_org_id())
  and (select public.app_stage2_universal_aal_allowed())
  and exists(select 1 from public.work_items w where w.id=work_item_id
   and w.org_id=routine_reminder_deliveries.org_id and w.assignee_id=(select auth.uid())
   and w.visibility<>'private')
 );
create trigger routine_reminder_immutable before update or delete on public.routine_reminder_deliveries
 for each row execute function public.platform_audit_immutable();
create trigger audit_routine_reminder after insert on public.routine_reminder_deliveries
 for each row execute function public.platform_audit_capture('routine_reminder','id','');

create table private.routine_reminder_sweep(
 singleton boolean primary key default true check(singleton),
 last_operation_id uuid
);
revoke all on private.routine_reminder_sweep from public,anon,authenticated,service_role;
insert into private.routine_reminder_sweep(singleton) values(true);

-- Never callable by browser/anon/service clients. Existing controlled heartbeat
-- owns delivery; no JWT fabrication or recipient impersonation.
create function private.deliver_routine_reminders()
returns integer language plpgsql security definer set search_path='' as $worker$
declare v_ids uuid[];v_last uuid;v_group record;v_count integer:=0;v_added integer;v_day date:=(now() at time zone 'Africa/Accra')::date;
 v_clock time:=(now() at time zone 'Africa/Accra')::time;v_key text:=(array['sun','mon','tue','wed','thu','fri','sat'])[extract(dow from now() at time zone 'Africa/Accra')::integer+1];
begin
 if not pg_catalog.pg_try_advisory_xact_lock(1682026,169) then return 0; end if;
 select last_operation_id into v_last from private.routine_reminder_sweep where singleton for update;
 select array_agg(batch.id order by batch.id) into v_ids from (
  select r.id from public.recurring_operations r
  where (v_last is null or r.id>v_last)
   and exists(select 1 from public.routine_schedule_versions v where v.operation_id=r.id and v.reminder_minutes_before is not null)
  order by r.id limit 200
 ) batch;
 if coalesce(cardinality(v_ids),0)=0 then
  update private.routine_reminder_sweep set last_operation_id=null where singleton;
  return 0;
 end if;
 for v_group in
  select r.org_id,array_agg(r.work_item_id order by r.id) work_ids
  from public.recurring_operations r where r.id=any(v_ids) group by r.org_id
 loop
  insert into public.routine_reminder_deliveries(org_id,operation_id,work_item_id,for_profile_id,scheduled_on,due_at)
  select r.org_id,r.id,w.id,w.assignee_id,d.scheduled_on,d.due_at
  from private.routine_schedule_dates(v_group.work_ids,v_day-2,v_day+2,v_group.org_id) d
  join public.recurring_operations r on r.id=d.operation_id and r.org_id=v_group.org_id
  join public.routine_schedule_versions v on v.operation_id=r.id and v.version=d.schedule_version
  join public.work_items w on w.id=r.work_item_id and w.org_id=r.org_id
  join public.profiles p on p.id=w.assignee_id and p.org_id=w.org_id and p.active
  join public.units u on u.id=w.unit_id and u.org_id=w.org_id and u.active
  -- Follow recorded effective workforce days/hours; never infer a person's
  -- attendance, hard-code Sundays/church days or invent a missing pattern.
  join lateral(
   select s.* from public.workforce_schedule_versions s
   where s.org_id=w.org_id and s.profile_id=w.assignee_id
    and (s.unit_id is null or s.unit_id=w.unit_id)
    and s.effective_from<=v_day and (s.effective_to is null or s.effective_to>=v_day)
    and not exists(select 1 from public.workforce_schedule_versions n
     where n.supersedes_id=s.id and n.effective_from<=v_day and (n.effective_to is null or n.effective_to>=v_day))
   order by s.created_at desc,s.id desc limit 1
  ) pattern on true
  join public.workforce_day_types dt on dt.id=nullif(pattern.day_map->>v_key,'')::uuid and dt.org_id=w.org_id and dt.active
  where d.state<>'recorded' and v.reminder_minutes_before is not null
   and d.due_at-make_interval(mins=>v.reminder_minutes_before)<=now()
   and d.due_at>=now()-interval '24 hours'
   and w.visibility<>'private' and w.status not in ('completed','cancelled','self_certified')
   and exists(select 1 from public.unit_memberships m where m.org_id=w.org_id and m.unit_id=w.unit_id and m.profile_id=w.assignee_id)
   and dt.session_expected
   and v_clock>=coalesce(nullif(pattern.clock_map->v_key->>'start','')::time,pattern.expected_start)
   and v_clock<coalesce(nullif(pattern.clock_map->v_key->>'end','')::time,pattern.expected_end)
   and not exists(select 1 from public.leave_requests l where l.org_id=w.org_id and l.profile_id=w.assignee_id
    and l.status='approved' and v_day between l.start_date and l.end_date)
  on conflict(operation_id,scheduled_on,for_profile_id) do nothing;
  get diagnostics v_added=row_count;v_count:=v_count+v_added;
 end loop;
 update private.routine_reminder_sweep set last_operation_id=v_ids[cardinality(v_ids)] where singleton;
 return v_count;
end;
$worker$;
revoke all on function private.deliver_routine_reminders() from public,anon,authenticated,service_role;

create or replace function public.app_heartbeat()
returns void language plpgsql security definer set search_path='' as $heartbeat$
declare v_started timestamptz:=clock_timestamp();v_delivered integer;
begin
 v_delivered:=private.deliver_routine_reminders();
 insert into public.job_runs(job_name,status,detail,duration_ms)
 values('heartbeat','ok',jsonb_build_object('at',now(),'routine_reminders',v_delivered),
  (extract(epoch from clock_timestamp()-v_started)*1000)::integer);
end;
$heartbeat$;
revoke all on function public.app_heartbeat() from public,anon,authenticated;
grant execute on function public.app_heartbeat() to service_role;

create or replace function public.my_work_attention_queue()
returns table(
  action_kind text,
  work_item_id uuid,
  work_ref text,
  work_title text,
  work_kind text,
  work_status text,
  action_at timestamptz,
  assignee_id uuid,
  assignee_name text,
  unit_name text,
  project_name text,
  responsible_reviewer_id uuid,
  responsible_reviewer_name text,
  submission_id uuid
)
language plpgsql
stable
security invoker
set search_path=public
as $$
begin
  if auth.uid() is null or public.app_org_id() is null then
    raise exception 'Sign in to view work actions.' using errcode='42501';
  end if;

  return query
  select
    'new_assignment'::text,
    w.id,
    w.ref,
    w.title,
    w.kind,
    w.status,
    w.created_at,
    w.assignee_id,
    assignee.full_name,
    unit_record.name,
    project_record.name,
    route.reviewer_id,
    reviewer.full_name,
    null::uuid
  from public.work_items w
  left join public.profiles assignee on assignee.id=w.assignee_id
  left join public.units unit_record on unit_record.id=w.unit_id
  left join public.projects project_record on project_record.id=w.project_id
  left join lateral (select public.app_responsible_reviewer_id(w.id) as reviewer_id) route on true
  left join public.profiles reviewer on reviewer.id=route.reviewer_id
  where w.org_id=public.app_org_id()
    and w.assignee_id=auth.uid()
    and w.visibility<>'private'
    and w.origin in ('assigned','assigned_by_exec')
    and w.status='not_started'

  union all

  select
    'returned_work'::text,
    w.id,
    w.ref,
    w.title,
    w.kind,
    w.status,
    w.last_movement_at,
    w.assignee_id,
    assignee.full_name,
    unit_record.name,
    project_record.name,
    route.reviewer_id,
    reviewer.full_name,
    null::uuid
  from public.work_items w
  left join public.profiles assignee on assignee.id=w.assignee_id
  left join public.units unit_record on unit_record.id=w.unit_id
  left join public.projects project_record on project_record.id=w.project_id
  left join lateral (select public.app_responsible_reviewer_id(w.id) as reviewer_id) route on true
  left join public.profiles reviewer on reviewer.id=route.reviewer_id
  where w.org_id=public.app_org_id()
    and w.assignee_id=auth.uid()
    and w.visibility<>'private'
    and w.status='returned'

  union all

  select
    'review_required'::text,
    w.id,
    w.ref,
    w.title,
    w.kind,
    w.status,
    s.submitted_at,
    w.assignee_id,
    assignee.full_name,
    unit_record.name,
    project_record.name,
    route.reviewer_id,
    reviewer.full_name,
    s.id
  from public.work_items w
  join lateral (
    select submission.id,submission.submitted_at
    from public.submissions submission
    where submission.work_item_id=w.id
    order by submission.submitted_at desc,submission.id desc
    limit 1
  ) s on true
  left join public.profiles assignee on assignee.id=w.assignee_id
  left join public.units unit_record on unit_record.id=w.unit_id
  left join public.projects project_record on project_record.id=w.project_id
  left join lateral (select public.app_responsible_reviewer_id(w.id) as reviewer_id) route on true
  left join public.profiles reviewer on reviewer.id=route.reviewer_id
  where w.org_id=public.app_org_id()
    and w.status='in_review'
    and public.app_can_review_item(w.id)

  union all
  select 'routine_due'::text,w.id,w.ref,w.title,w.kind,w.status,d.due_at,
    w.assignee_id,assignee.full_name,unit_record.name,project_record.name,null::uuid,null::text,null::uuid
  from public.routine_reminder_deliveries d
  join public.work_items w on w.id=d.work_item_id and w.org_id=d.org_id and w.assignee_id=auth.uid()
  left join public.profiles assignee on assignee.id=w.assignee_id
  left join public.units unit_record on unit_record.id=w.unit_id
  left join public.projects project_record on project_record.id=w.project_id
  join lateral public.routine_schedule_preview(array[w.id],d.scheduled_on,d.scheduled_on) schedule
    on schedule.operation_id=d.operation_id and schedule.scheduled_on=d.scheduled_on and schedule.state<>'recorded'
  where d.org_id=public.app_org_id() and d.for_profile_id=auth.uid()
    and d.delivered_at>=now()-interval '7 days'
    and w.status not in ('completed','cancelled','self_certified')
  order by 7 desc,2;
end;
$$;
