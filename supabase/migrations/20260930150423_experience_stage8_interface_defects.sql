-- Experience Stage 8: make a rejected Check stop the workflow instead of advancing it.
-- Reuses the existing reviewed complete_workflow_step RPC; no new privileged surface.

create or replace function public.complete_workflow_step(
  p_run_step_id uuid,
  p_outcome text,
  p_note text default null
)
returns public.workflow_runs
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_actor uuid:=auth.uid();
  v_org uuid:=public.app_org_id();
  v_step public.workflow_run_steps;
  v_run public.workflow_runs;
  v_next_id uuid;
  v_definition public.workflow_definitions;
  v_source public.platform_events;
  v_outcome text:=lower(btrim(coalesce(p_outcome,'')));
begin
  if v_actor is null then
    raise exception 'Sign in to complete a workflow step.' using errcode='42501';
  end if;

  if v_outcome='' then
    raise exception 'Outcome is required.';
  end if;

  select * into v_step
  from public.workflow_run_steps
  where id=p_run_step_id and org_id=v_org
  for update;

  if v_step.id is null then
    raise exception 'That workflow step was not found.' using errcode='42501';
  end if;

  if v_step.state<>'ready' then
    raise exception 'Only a ready workflow step can be completed.';
  end if;

  if v_step.required_capability is not null
     and not public.app_has_capability(v_step.required_capability,null) then
    raise exception 'You do not have the capability required for this workflow step.'
      using errcode='42501';
  end if;

  select * into v_run
  from public.workflow_runs
  where id=v_step.workflow_run_id and org_id=v_org
  for update;

  if v_run.id is null or v_run.state<>'active' then
    raise exception 'That workflow run is not active.';
  end if;

  update public.workflow_run_steps
  set state='completed',
      completed_by=v_actor,
      completed_at=now(),
      outcome=btrim(p_outcome),
      note=nullif(btrim(coalesce(p_note,'')),'')
  where id=v_step.id;

  if v_outcome='not_approved' then
    update public.workflow_run_steps
    set state='skipped'
    where workflow_run_id=v_run.id
      and id<>v_step.id
      and state in ('pending','ready');

    update public.workflow_runs
    set state='cancelled',completed_at=now()
    where id=v_run.id
    returning * into v_run;

    select * into v_definition
    from public.workflow_definitions
    where id=v_run.workflow_definition_id;

    select * into v_source
    from public.platform_events
    where id=v_run.source_event_id;

    perform public.platform_emit_event(
      v_run.org_id,
      'workflow.cancelled',
      v_actor,
      v_run.subject_profile_id,
      'workflow_run',
      v_run.id,
      jsonb_build_object(
        'workflow_key',v_definition.workflow_key,
        'source_event_type',v_source.event_type,
        'outcome','not_approved'
      ),
      'workflow-cancelled:'||v_run.id::text,
      v_source.correlation_id,
      v_source.id,
      now()
    );

    return v_run;
  end if;

  select id into v_next_id
  from public.workflow_run_steps
  where workflow_run_id=v_run.id
    and state='pending'
  order by position
  limit 1
  for update;

  if v_next_id is not null then
    update public.workflow_run_steps
    set state='ready'
    where id=v_next_id;
  else
    update public.workflow_runs
    set state='completed',completed_at=now()
    where id=v_run.id
    returning * into v_run;

    select * into v_definition
    from public.workflow_definitions
    where id=v_run.workflow_definition_id;

    select * into v_source
    from public.platform_events
    where id=v_run.source_event_id;

    perform public.platform_emit_event(
      v_run.org_id,
      'workflow.completed',
      v_actor,
      v_run.subject_profile_id,
      'workflow_run',
      v_run.id,
      jsonb_build_object(
        'workflow_key',v_definition.workflow_key,
        'source_event_type',v_source.event_type
      ),
      'workflow-complete:'||v_run.id::text,
      v_source.correlation_id,
      v_source.id,
      now()
    );
  end if;

  if v_run.state<>'completed' then
    select * into v_run from public.workflow_runs where id=v_run.id;
  end if;

  return v_run;
end;
$function$;

revoke execute on function public.complete_workflow_step(uuid,text,text) from anon, public;
grant execute on function public.complete_workflow_step(uuid,text,text) to authenticated;
