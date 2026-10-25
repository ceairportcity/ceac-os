-- Forward correction: retain the latest released routine schedule and reminder fields.
-- Keeps the reviewed Executive no-membership/project authority; no records or grants change.
BEGIN;

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
      if not (public.app_is_exec() and exists(select 1 from public.units u where u.id=p_unit_id and u.org_id=v_org and u.active)) and not exists (
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
      if public.app_is_exec() and p_project_id is not null then perform public.executive_assign_project_department(p_project_id,p_unit_id,'Executive personal responsibility'); end if;
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

COMMIT;
