-- Owner 25 October: Executive can assign any active person/department in
-- the same organisation. Keep private planning, HR, tenant and role boundaries.
create or replace function public.executive_assign_project_department(p_project_id uuid,p_unit_id uuid,p_reason text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_org uuid:=public.app_org_id(); v_added integer;
begin
  if auth.uid() is null or v_org is null or not public.app_is_exec() or not public.app_stage2_universal_aal_allowed() then
    raise exception 'Only the active Executive can assign project departments.' using errcode='42501';
  end if;
  if nullif(btrim(p_reason),'') is null then raise exception 'Record why this department is joining.' using errcode='22023'; end if;
  perform 1 from public.projects p where p.id=p_project_id and p.org_id=v_org and p.status in ('planned','active')
    and not public.operational_record_is_archived('projects',p.id,p.org_id) for key share;
  if not found then raise exception 'Choose an active project in your organisation.' using errcode='42501'; end if;
  perform 1 from public.units u where u.id=p_unit_id and u.org_id=v_org and u.active for key share;
  if not found then raise exception 'Choose an active department in your organisation.' using errcode='42501'; end if;
  insert into public.project_units(project_id,unit_id,role) values(p_project_id,p_unit_id,'participating') on conflict(project_id,unit_id) do nothing;
  get diagnostics v_added=row_count;
  if v_added=1 then
    insert into public.activity_events(org_id,actor_id,verb,object_type,object_id,meta)
    values(v_org,auth.uid(),'project_department_assigned','project',p_project_id,jsonb_build_object('unit_id',p_unit_id,'reason',btrim(p_reason)));
  end if;
  return jsonb_build_object('project_id',p_project_id,'unit_id',p_unit_id,'added',v_added=1);
end $$;
revoke all on function public.executive_assign_project_department(uuid,uuid,text) from public,anon;
grant execute on function public.executive_assign_project_department(uuid,uuid,text) to authenticated,service_role;

create or replace function public.create_task_with_checklist(
  p_unit_id uuid,
  p_assignee_id uuid,
  p_title text,
  p_expected_outcome text,
  p_sub_team_id uuid default null,
  p_project_id uuid default null,
  p_objective_id uuid default null,
  p_phase_id uuid default null,
  p_purpose text default null,
  p_instructions text default null,
  p_due_at timestamptz default null,
  p_origin text default 'assigned',
  p_visibility text default 'unit',
  p_steps text[] default '{}'::text[]
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid:=public.app_org_id();
  v_ref text;
  v_id uuid:=gen_random_uuid();
  v_step text;
  v_pos int:=0;
begin
  if auth.uid() is null then raise exception 'Sign in to create work.' using errcode='42501'; end if;
  if v_org is null then raise exception 'Your organisation could not be identified.' using errcode='42501'; end if;
  if nullif(btrim(coalesce(p_title,'')),'') is null then raise exception 'Enter what needs to happen.'; end if;
  if p_origin not in ('assigned','self_created','assigned_by_exec') then raise exception 'Unsupported Task origin.'; end if;
  if p_visibility not in ('unit','private') then raise exception 'Unsupported visibility.'; end if;

  if p_origin='assigned_by_exec' and not public.app_is_exec() then raise exception 'Only Executive work may carry that origin.' using errcode='42501'; end if;
  if p_origin in ('assigned','assigned_by_exec') then
    if p_assignee_id is null then raise exception 'Choose who is responsible.'; end if;
    if nullif(btrim(coalesce(p_purpose,'')),'') is null then raise exception 'Explain why this work matters.'; end if;
    if p_due_at is null then raise exception 'Choose when this work is due.'; end if;
  end if;

  if not exists(select 1 from public.units u where u.id=p_unit_id and u.org_id=v_org and u.active) then
    raise exception 'That unit is not active in your organisation.' using errcode='42501';
  end if;

  if p_origin='self_created' then
    if p_assignee_id is distinct from auth.uid() then raise exception 'Self-created work must belong to you.' using errcode='42501'; end if;
    if not public.app_is_exec() and not exists(select 1 from public.unit_memberships um where um.unit_id=p_unit_id and um.profile_id=auth.uid() and um.org_id=v_org) then
      raise exception 'You are not a member of that unit.' using errcode='42501';
    end if;
  else
    if not (p_unit_id in(select public.app_managed_units()) or public.app_is_admin() or public.app_is_exec()) then
      raise exception 'Only the Unit Head can assign this Task.' using errcode='42501';
    end if;
    if not exists(
      select 1 from public.unit_memberships um join public.profiles p on p.id=um.profile_id
      where um.unit_id=p_unit_id and um.profile_id=p_assignee_id and um.org_id=v_org and p.active
    ) then raise exception 'The assignee is not an active member of this unit.' using errcode='42501'; end if;
    if p_visibility='private' then raise exception 'Assigned work cannot be private.' using errcode='42501'; end if;
  end if;

  if p_sub_team_id is not null and not exists(
    select 1 from public.sub_teams s where s.id=p_sub_team_id and s.unit_id=p_unit_id and s.org_id=v_org and s.active
  ) then raise exception 'That team part does not belong to this unit.'; end if;

  if public.app_is_exec() and p_project_id is not null then
    perform public.executive_assign_project_department(p_project_id,p_unit_id,'Executive work assignment');
  end if;

  if p_project_id is not null then
    if not exists(
      select 1 from public.projects p
      where p.id=p_project_id and p.org_id=v_org and p.status in ('planned','active')
        and (p.lead_unit_id=p_unit_id or exists(select 1 from public.project_units pu where pu.project_id=p.id and pu.unit_id=p_unit_id))
    ) then raise exception 'That project is not active for this unit.'; end if;
  elsif p_objective_id is not null or p_phase_id is not null then
    raise exception 'Objective or phase requires a project.';
  end if;

  if p_objective_id is not null and not exists(
    select 1 from public.objectives o where o.id=p_objective_id and o.project_id=p_project_id and o.unit_id=p_unit_id
  ) then raise exception 'That objective does not belong to this unit and project.'; end if;

  if p_phase_id is not null and not exists(
    select 1 from public.project_phases ph where ph.id=p_phase_id and ph.project_id=p_project_id
  ) then raise exception 'That phase does not belong to this project.'; end if;

  v_ref:=public.next_work_ref(p_unit_id,p_sub_team_id);

  insert into public.work_items(
    id,org_id,ref,kind,unit_id,sub_team_id,project_id,objective_id,phase_id,
    assignee_id,assigned_by,title,purpose,instructions,expected_outcome,
    original_due_at,due_at,origin,visibility,status
  ) values(
    v_id,v_org,v_ref,'task',p_unit_id,p_sub_team_id,p_project_id,p_objective_id,p_phase_id,
    p_assignee_id,auth.uid(),btrim(p_title),nullif(btrim(coalesce(p_purpose,'')),''),
    nullif(btrim(coalesce(p_instructions,'')),''),nullif(btrim(coalesce(p_expected_outcome,'')),''),
    p_due_at,p_due_at,case when p_origin<>'self_created' and public.app_is_exec() then 'assigned_by_exec' else p_origin end,p_visibility,'not_started'
  );

  foreach v_step in array coalesce(p_steps,'{}'::text[]) loop
    if nullif(btrim(v_step),'') is not null then
      v_pos:=v_pos+1;
      insert into public.checklist_items(work_item_id,label,position)
      values(v_id,btrim(v_step),v_pos);
    end if;
  end loop;

  insert into public.activity_events(org_id,actor_id,verb,object_type,object_id,meta)
  values(v_org,auth.uid(),'work_created','work_item',v_id,
    jsonb_build_object('kind','task','origin',p_origin,'assignee_id',p_assignee_id,'checklist_count',v_pos));

  return jsonb_build_object('id',v_id,'ref',v_ref);
end;
$$;


create or replace function public.create_typed_work_base(
  p_kind text,
  p_unit_id uuid,
  p_title text,
  p_assignee_id uuid,
  p_sub_team_id uuid,
  p_project_id uuid,
  p_phase_id uuid,
  p_objective_id uuid,
  p_responsibility_id uuid,
  p_purpose text,
  p_expected_outcome text,
  p_due_at timestamptz,
  p_visibility text,
  p_confidential boolean,
  p_initial_status text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_ref text;
begin
  if auth.uid() is null or public.app_org_id() is null or not public.app_stage2_universal_aal_allowed() then raise exception 'Sign in with verified CEAC authority.' using errcode='42501'; end if;
  if not exists(select 1 from public.units u where u.id=p_unit_id and u.org_id=public.app_org_id() and u.active) then raise exception 'Choose an active department in your organisation.' using errcode='42501'; end if;
  if p_kind not in ('routine','case','request','decision','meeting_outcome','deliverable') then
    raise exception 'Use the typed-work contract only for a non-Task work type.';
  end if;
  if p_title is null or length(btrim(p_title))=0 then
    raise exception 'Give the work a short name.';
  end if;
  if p_visibility not in ('unit','private') then
    raise exception 'Visibility must be unit or private.';
  end if;

  if not (
    p_unit_id in (select app_managed_units())
    or (p_sub_team_id is not null and p_sub_team_id in (select app_led_sub_teams()))
    or app_is_admin()
    or app_is_exec()
  ) then
    raise exception 'You cannot create work in that unit.';
  end if;

  if p_sub_team_id is not null and not exists (
    select 1 from sub_teams st
    where st.id=p_sub_team_id and st.unit_id=p_unit_id and st.org_id=app_org_id()
  ) then
    raise exception 'That work lane does not belong to this unit.';
  end if;

  if p_kind <> 'request'
     and p_assignee_id is not null
     and not exists (
       select 1
       from unit_memberships m
       join profiles p on p.id=m.profile_id
       where m.profile_id=p_assignee_id
         and m.unit_id=p_unit_id
         and m.org_id=app_org_id()
         and p.active
     ) then
    raise exception 'The assignee is not an active member of this unit.';
  end if;

  if public.app_is_exec() and p_project_id is not null then
    perform public.executive_assign_project_department(p_project_id,p_unit_id,'Executive work assignment');
  end if;

  if p_project_id is not null then
    if not exists (
      select 1 from projects p
      where p.id=p_project_id and p.org_id=app_org_id()
        and (
          p.lead_unit_id=p_unit_id
          or exists (select 1 from project_units pu where pu.project_id=p.id and pu.unit_id=p_unit_id)
        )
    ) then
      raise exception 'That project is not attached to this unit.';
    end if;
  end if;

  if p_phase_id is not null and not exists (
    select 1 from project_phases ph
    where ph.id=p_phase_id and ph.project_id=p_project_id
  ) then
    raise exception 'That phase does not belong to the selected project.';
  end if;

  if p_objective_id is not null and not exists (
    select 1 from objectives o
    where o.id=p_objective_id
      and o.project_id=p_project_id
      and o.unit_id=p_unit_id
  ) then
    raise exception 'That objective does not belong to this unit and project.';
  end if;

  if p_responsibility_id is not null and not exists (
    select 1 from responsibilities r
    where r.id=p_responsibility_id and r.unit_id=p_unit_id and r.org_id=app_org_id()
  ) then
    raise exception 'That responsibility does not belong to this unit.';
  end if;

  v_ref := next_work_ref(p_unit_id,p_sub_team_id);
  v_id := gen_random_uuid();

  perform set_config('ceac.typed_create','on',true);

  insert into work_items(
    id,org_id,ref,kind,unit_id,sub_team_id,project_id,phase_id,objective_id,
    responsibility_id,assignee_id,assigned_by,title,purpose,expected_outcome,
    original_due_at,due_at,origin,visibility,confidential,status
  )
  values(
    v_id,app_org_id(),v_ref,p_kind,p_unit_id,p_sub_team_id,p_project_id,p_phase_id,p_objective_id,
    p_responsibility_id,p_assignee_id,auth.uid(),btrim(p_title),nullif(btrim(p_purpose),''),
    nullif(btrim(p_expected_outcome),''),p_due_at,p_due_at,case when public.app_is_exec() then 'assigned_by_exec' else 'assigned' end,p_visibility,
    coalesce(p_confidential,false),p_initial_status
  );

  return v_id;
end;
$$;

revoke all on function public.create_typed_work_base(text,uuid,text,uuid,uuid,uuid,uuid,uuid,uuid,text,text,timestamptz,text,boolean,text)
  from public, anon, authenticated;


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
      work_item_id,starts_on,ends_on,paused_at,schedule_kind,weekdays,day_of_month
    )
    values(
      app_org_id(),p_unit_id,p_sub_team_id,p_responsibility_id,btrim(p_title),v_schedule,
      v_records_value,v_value_label,true,v_item,v_starts,v_ends,null,v_schedule,v_weekdays,v_day
    )
    returning id into v_operation;

    insert into routine_schedule_versions(
      operation_id,version,effective_from,schedule_kind,weekdays,day_of_month,created_by
    )
    values(v_operation,1,v_starts,v_schedule,v_weekdays,v_day,auth.uid());

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


-- Keep the prior public RPC grants, internal base denial and assurance model.
revoke all on function public.create_task_with_checklist(uuid,uuid,text,text,uuid,uuid,uuid,uuid,text,text,timestamptz,text,text,text[]) from public,anon;
grant execute on function public.create_task_with_checklist(uuid,uuid,text,text,uuid,uuid,uuid,uuid,text,text,timestamptz,text,text,text[]) to authenticated,service_role;
revoke all on function public.create_typed_work_base(text,uuid,text,uuid,uuid,uuid,uuid,uuid,uuid,text,text,timestamptz,text,boolean,text) from public,anon,authenticated;
revoke all on function public.create_typed_work(text,uuid,text,uuid,uuid,uuid,uuid,uuid,uuid,text,text,timestamptz,text,boolean,jsonb) from public,anon;
grant execute on function public.create_typed_work(text,uuid,text,uuid,uuid,uuid,uuid,uuid,uuid,text,text,timestamptz,text,boolean,jsonb) to authenticated,service_role;
