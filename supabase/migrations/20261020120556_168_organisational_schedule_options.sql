
-- Existing organisational routines retain their identity, permissions and proof.
-- Options belong to a dated schedule version, never to private Calendar tasks.
alter table public.recurring_operations
 add column interval_count integer not null default 1 check(interval_count between 1 and 366),
 add column timezone text not null default 'Africa/Accra',
 add column due_time time check(due_time < time '24:00'),
 add column occurrence_limit integer check(occurrence_limit between 1 and 5000);
alter table public.routine_schedule_versions
 add column interval_count integer not null default 1 check(interval_count between 1 and 366),
 add column timezone text not null default 'Africa/Accra',
 add column due_time time check(due_time < time '24:00'),
 add column occurrence_limit integer check(occurrence_limit between 1 and 5000);
create function private.guard_routine_schedule_options()
returns trigger language plpgsql security invoker set search_path='' as $guard$
begin
 if not exists(select 1 from pg_catalog.pg_timezone_names z where z.name=new.timezone) then
  raise exception 'Choose a recognised IANA time zone.' using errcode='22023';
 end if;
 return new;
end;
$guard$;
revoke all on function private.guard_routine_schedule_options() from public,anon,authenticated;
create trigger recurring_operations_schedule_options before insert or update of timezone
 on public.recurring_operations for each row execute function private.guard_routine_schedule_options();
create trigger routine_schedule_versions_options before insert or update of timezone
 on public.routine_schedule_versions for each row execute function private.guard_routine_schedule_options();
comment on column public.routine_schedule_versions.occurrence_limit is
 'Maximum configured schedule dates from this version effective_from, not completed outcomes; missing monthly days are skipped. Pauses do not rewrite the end-count rule.';

-- Forward-only: self-created organisational routines use the existing typed-work RPC,
-- recurring_operations and dated occurrence engine. No new browser RPC or grant.
-- Assigned work retains its existing authority path; historical migrations stay frozen.

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
      work_item_id,starts_on,ends_on,paused_at,schedule_kind,weekdays,day_of_month,interval_count,timezone,due_time,occurrence_limit
    )
    values(
      app_org_id(),p_unit_id,p_sub_team_id,p_responsibility_id,btrim(p_title),v_schedule,
      v_records_value,v_value_label,true,v_item,v_starts,v_ends,null,v_schedule,v_weekdays,v_day,
      coalesce((p_details->>'interval_count')::integer,1),coalesce(nullif(p_details->>'timezone',''),'Africa/Accra'),
      nullif(p_details->>'due_time','')::time,nullif(p_details->>'occurrence_limit','')::integer
    )
    returning id into v_operation;

    insert into routine_schedule_versions(
      operation_id,version,effective_from,schedule_kind,weekdays,day_of_month,created_by,interval_count,timezone,due_time,occurrence_limit
    )
    values(v_operation,1,v_starts,v_schedule,v_weekdays,v_day,auth.uid(),
      coalesce((p_details->>'interval_count')::integer,1),coalesce(nullif(p_details->>'timezone',''),'Africa/Accra'),
      nullif(p_details->>'due_time','')::time,nullif(p_details->>'occurrence_limit','')::integer);

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
    operation_id,version,effective_from,schedule_kind,weekdays,day_of_month,created_by,interval_count,timezone,due_time,occurrence_limit
  ) values(ro.id,v_version,p_effective_from,p_schedule_kind,p_weekdays,p_day_of_month,auth.uid(),ro.interval_count,ro.timezone,ro.due_time,ro.occurrence_limit);

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



-- Reviewed NEW trusted implementation. The existing schedule RPC still makes
-- the creator/manager/Administration authority decision and locks the routine.
create function private.change_routine_schedule_options(p_work_item_id uuid,p_effective_from date,p_options jsonb)
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
  occurrence_limit=nullif(p_options->>'occurrence_limit','')::integer
 where operation_id=v_operation and version=v_version;
 update public.recurring_operations set
  interval_count=coalesce((p_options->>'interval_count')::integer,1),
  timezone=coalesce(nullif(p_options->>'timezone',''),'Africa/Accra'),
  due_time=nullif(p_options->>'due_time','')::time,
  occurrence_limit=nullif(p_options->>'occurrence_limit','')::integer
 where id=v_operation;
 insert into public.activity_events(org_id,actor_id,verb,object_type,object_id,meta)
 values(public.app_org_id(),auth.uid(),'routine_schedule_options_changed','work_item',p_work_item_id,
  jsonb_build_object('version',v_version,'effective_from',p_effective_from,'options',p_options));
 return v_version;
end;
$options$;
revoke all on function private.change_routine_schedule_options(uuid,date,jsonb) from public,anon,authenticated;
grant execute on function private.change_routine_schedule_options(uuid,date,jsonb) to authenticated,service_role;
create function public.change_routine_schedule_options(p_work_item_id uuid,p_effective_from date,p_options jsonb)
returns integer language sql security invoker set search_path='' as $api$
 select private.change_routine_schedule_options(p_work_item_id,p_effective_from,p_options);
$api$;
revoke all on function public.change_routine_schedule_options(uuid,date,jsonb) from public,anon,authenticated;
grant execute on function public.change_routine_schedule_options(uuid,date,jsonb) to authenticated,service_role;

-- Reviewed NEW read-only API. RLS remains in force on every source relation.
-- Conversion is server-side with IANA rules; no client/local-machine TZ maths.
create function public.routine_schedule_preview(p_work_item_ids uuid[],p_from_date date,p_through_date date)
returns table(operation_id uuid,scheduled_on date,schedule_version integer,due_at timestamptz,timezone text,due_time time,state text)
language plpgsql stable security invoker set search_path='' as $preview$
begin
 if auth.uid() is null or public.app_org_id() is null or not public.app_stage2_universal_aal_allowed() then
  raise exception 'Sign in with an active verified account.' using errcode='42501';
 end if;
 if p_work_item_ids is null or cardinality(p_work_item_ids)>200
  or p_from_date is null or p_through_date is null or p_through_date<p_from_date
  or p_through_date-p_from_date>370 or p_through_date>current_date+370 then
  raise exception 'Use at most 200 responsibilities and a bounded one-year date window.' using errcode='22023';
 end if;
 if exists(select 1 from public.recurring_operations r join public.routine_schedule_versions v on v.operation_id=r.id
  where r.work_item_id=any(p_work_item_ids) and r.org_id=public.app_org_id()
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
  where r.work_item_id=any(p_work_item_ids) and r.org_id=public.app_org_id()
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
revoke all on function public.routine_schedule_preview(uuid[],date,date) from public,anon,authenticated;
grant execute on function public.routine_schedule_preview(uuid[],date,date) to authenticated,service_role;
comment on function public.routine_schedule_preview(uuid[],date,date) is
 'RLS-enforced bounded dated routine preview: actual IANA due instants, versioned interval/count, pause exclusions and immutable recorded proof. No writes or completion inference.';

create or replace function public.record_routine_occurrence(
  p_work_item_id uuid,
  p_occurred_on date,
  p_value numeric default null,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  ro record;
  sv record;
  v_id uuid;
  v_dow integer;
begin
  if auth.uid() is null or public.app_org_id() is null or not public.app_stage2_universal_aal_allowed() then
    raise exception 'Sign in with the required account verification.' using errcode='42501';
  end if;
  select r.* into ro
  from recurring_operations r
  where r.work_item_id=p_work_item_id
  for update;

  if ro is null then raise exception 'That routine does not exist.'; end if;
  if ro.org_id is distinct from app_org_id() then raise exception 'That routine belongs to another organisation.' using errcode='42501'; end if;
  if p_occurred_on is null or p_occurred_on>(now() at time zone coalesce((select s.timezone from public.routine_schedule_versions s
      where s.operation_id=ro.id and s.effective_from<=p_occurred_on
        and (s.effective_to is null or s.effective_to>=p_occurred_on) order by s.version desc limit 1),ro.timezone))::date then
    raise exception 'Record an occurrence for today or an earlier date.';
  end if;
  if ro.starts_on is not null and p_occurred_on<ro.starts_on then
    raise exception 'That date is before the routine started.';
  end if;
  if ro.ends_on is not null and p_occurred_on>ro.ends_on then
    raise exception 'That date is after the routine ended.';
  end if;
  if not (
    ro.unit_id in (select app_my_units())
    or ro.unit_id in (select app_managed_units())
    or app_is_admin()
  ) then
    raise exception 'You cannot record this routine.' using errcode='42501';
  end if;

  if not ro.active or ro.paused_at is not null then
    raise exception 'Resume this routine before recording another occurrence.' using errcode='22023';
  end if;
  if exists (select 1 from public.work_items w where w.id=p_work_item_id
      and w.assignee_id is not null and w.assignee_id<>auth.uid())
    and not (ro.unit_id in (select app_managed_units()) or app_is_admin()) then
    raise exception 'Only the responsible person or authorised department reviewer can record this occurrence.' using errcode='42501';
  end if;

  select * into sv
  from routine_schedule_versions
  where operation_id=ro.id
    and effective_from<=p_occurred_on
    and (effective_to is null or effective_to>=p_occurred_on)
  order by version desc
  limit 1;

  if sv is null then raise exception 'No schedule version covers that date.'; end if;

  v_dow := extract(isodow from p_occurred_on)::int;
  if sv.schedule_kind in ('weekly','weekdays') and not (v_dow=any(sv.weekdays)) then
    raise exception 'That date is not scheduled for this routine.';
  end if;
  if sv.schedule_kind='monthly' and extract(day from p_occurred_on)::int<>sv.day_of_month then
    raise exception 'That date is not the scheduled monthly day.';
  end if;

  if not exists(select 1 from public.routine_schedule_preview(array[p_work_item_id],p_occurred_on,p_occurred_on) p
      where p.scheduled_on=p_occurred_on) then
    raise exception 'That date is outside the configured interval, count or pause window.' using errcode='22023';
  end if;
  if ro.records_value and p_value is null then
    raise exception 'Record the % for this occurrence.',coalesce(ro.value_label,'value');
  end if;
  if not ro.records_value and p_value is not null then
    raise exception 'This routine is not configured to record a number.';
  end if;

  insert into operation_occurrences(org_id,operation_id,occurred_on,value,note,recorded_by)
  values(ro.org_id,ro.id,p_occurred_on,p_value,nullif(btrim(p_note),''),auth.uid())
  returning id into v_id;

  insert into activity_events(org_id,actor_id,verb,object_type,object_id,meta)
  values(ro.org_id,auth.uid(),'routine_recorded','work_item',p_work_item_id,
         jsonb_build_object('occurrence_id',v_id,'occurred_on',p_occurred_on,'value',p_value));

  return v_id;
end;
$$;


-- Existing unique (operation_id,occurred_on) and row lock preserve retry/concurrency safety.
