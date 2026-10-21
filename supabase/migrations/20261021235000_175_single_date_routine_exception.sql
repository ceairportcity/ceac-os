-- Stage 2 canonical routine: dated one-off skip/restoration, not a recurring-series edit.
-- Historical 168/169/171 migrations are frozen; their security and schedule logic are preserved.
-- Actor-controlled, immutable version history; no assignment, delegation, attendance or performance inference.
CREATE TABLE public.routine_date_exceptions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE RESTRICT,
 operation_id uuid NOT NULL REFERENCES public.recurring_operations(id) ON DELETE RESTRICT,
 scheduled_on date NOT NULL,
 version integer NOT NULL CHECK(version>0),
 action text NOT NULL CHECK(action IN ('skip','restore')),
 reason text NOT NULL CHECK(length(btrim(reason))>=8 AND length(reason)<=2000),
 actor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(operation_id,scheduled_on,version)
);
CREATE INDEX routine_date_exceptions_read_idx
 ON public.routine_date_exceptions(org_id,operation_id,scheduled_on,version DESC);
ALTER TABLE public.routine_date_exceptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.routine_date_exceptions FROM public,anon,authenticated;
GRANT SELECT ON public.routine_date_exceptions TO authenticated;
CREATE POLICY routine_date_exceptions_read ON public.routine_date_exceptions
 FOR SELECT TO authenticated USING (
 org_id=public.app_org_id() AND public.app_stage2_universal_aal_allowed()
 AND EXISTS(
  SELECT 1 FROM public.recurring_operations r JOIN public.work_items w
   ON w.id=r.work_item_id AND w.org_id=r.org_id
  WHERE r.id=operation_id AND r.org_id=routine_date_exceptions.org_id
   AND public.app_can_see_item(w.id)
 )
);
COMMENT ON TABLE public.routine_date_exceptions IS
 'Append-only per-day exception history. A skip or restoration never rewrites the recurring schedule, existing outcomes, progress, or approvals.';

-- Preserve the precise, reviewed 169 calendar/reminder reader, with one additive
-- status from the most recent immutable exception for this single date.
create or replace function private.routine_schedule_dates(p_work_item_ids uuid[],p_from_date date,p_through_date date,p_org_id uuid)
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
  select c.*,o.id proof_id,(c.day_value+coalesce(c.due_time,time '23:59:59.999999')) at time zone c.tz due_value, e.action as exception_action
  from candidates c left join public.operation_occurrences o on o.operation_id=c.op_id and o.occurred_on=c.day_value
  left join lateral (select x.action from public.routine_date_exceptions x
    where x.operation_id=c.op_id and x.org_id=p_org_id and x.scheduled_on=c.day_value
    order by x.version desc limit 1) e on true
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
  case when c.exception_action='skip' then 'skipped' when c.proof_id is not null then 'recorded' when c.due_value<now() then 'unrecorded_past' else 'scheduled' end
 from visible_dates c order by c.day_value,c.op_id;
end;
$preview$;
-- Preserve the 168 recording RPC, now denying a skipped date while leaving
-- original contributor/department/tenant/assurance checks unchanged.
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
      where p.scheduled_on=p_occurred_on and p.state<>'skipped') then
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
-- Preserve the 171 invoker progress trigger, additionally rejecting skipped
-- dates rather than accepting a visible-but-skipped schedule row.
CREATE OR REPLACE FUNCTION public.stage2_stamp_routine_date_progress()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $progress$
DECLARE v_work uuid; v_zone text; v_previous integer; v_total integer;
BEGIN
 IF auth.uid() IS NULL OR NEW.org_id IS DISTINCT FROM public.app_org_id()
  OR NOT public.app_stage2_universal_aal_allowed() THEN
  RAISE EXCEPTION 'Sign in before recording routine progress.' USING ERRCODE='42501';
 END IF;
 SELECT r.work_item_id INTO v_work FROM public.recurring_operations r
  JOIN public.work_items w ON w.id=r.work_item_id AND w.org_id=r.org_id
  WHERE r.id=NEW.operation_id AND r.org_id=NEW.org_id AND public.app_can_see_item(w.id);
 IF v_work IS NULL THEN
  RAISE EXCEPTION 'That routine is not available to your account.' USING ERRCODE='42501';
 END IF;
 IF NEW.scheduled_on IS NULL OR NEW.scheduled_on<current_date-370 OR NEW.scheduled_on>current_date+1 THEN
  RAISE EXCEPTION 'Choose a routine date within the past year.' USING ERRCODE='22023';
 END IF;
 SELECT p.timezone INTO v_zone FROM public.routine_schedule_preview(ARRAY[v_work],NEW.scheduled_on,NEW.scheduled_on) p WHERE p.state<>'skipped';
 IF v_zone IS NULL OR NEW.scheduled_on>(clock_timestamp() AT TIME ZONE v_zone)::date THEN
  RAISE EXCEPTION 'Choose today or an earlier scheduled date.' USING ERRCODE='22023';
 END IF;
 -- Serialize updates for a date, and refuse stale forms instead of losing work.
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(NEW.operation_id::text||':'||NEW.scheduled_on::text,0));
 SELECT coalesce(max(p.entry_number),0) INTO v_previous FROM public.routine_date_progress p
  WHERE p.operation_id=NEW.operation_id AND p.scheduled_on=NEW.scheduled_on;
 IF NEW.entry_number IS DISTINCT FROM v_previous+1 THEN
  RAISE EXCEPTION 'This date has newer progress. Refresh it before saving.' USING ERRCODE='40001';
 END IF;
 IF NEW.completed_step_ids IS NULL OR cardinality(NEW.completed_step_ids)>100
  OR cardinality(NEW.completed_step_ids)<>(SELECT count(DISTINCT x) FROM unnest(NEW.completed_step_ids) x)
  OR EXISTS(SELECT 1 FROM unnest(NEW.completed_step_ids) x WHERE NOT EXISTS(
    SELECT 1 FROM public.checklist_items c WHERE c.id=x AND c.work_item_id=v_work)) THEN
  RAISE EXCEPTION 'Choose steps from this responsibility.' USING ERRCODE='22023';
 END IF;
 IF NEW.evidence_links IS NULL OR cardinality(NEW.evidence_links)>5 OR EXISTS(
  SELECT 1 FROM unnest(NEW.evidence_links) link WHERE link IS NULL OR length(link)>2000 OR link !~ '^https?://[^[:space:]]+$') THEN
  RAISE EXCEPTION 'Use at most five complete web evidence links.' USING ERRCODE='22023';
 END IF;
 SELECT count(*),coalesce(jsonb_agg(jsonb_build_object('id',c.id,'label',c.label,
  'done',c.id=ANY(NEW.completed_step_ids)) ORDER BY c.position,c.id),'[]'::jsonb)
 INTO v_total,NEW.checklist_snapshot FROM public.checklist_items c WHERE c.work_item_id=v_work;
 IF v_total>100 THEN RAISE EXCEPTION 'This routine has too many steps to verify.' USING ERRCODE='22023'; END IF;
 IF NEW.status='ready_for_review' AND cardinality(NEW.completed_step_ids)<>v_total THEN
  RAISE EXCEPTION 'Record every step before marking this date ready for review.' USING ERRCODE='22023';
 END IF;
 IF NEW.status='waiting_on' AND length(btrim(coalesce(NEW.note,'')))<3 THEN
  RAISE EXCEPTION 'Explain what this date is waiting on.' USING ERRCODE='22023';
 END IF;
 NEW.actor_id:=auth.uid(); NEW.recorded_at:=clock_timestamp();
 NEW.note:=nullif(btrim(coalesce(NEW.note,'')),'');
 RETURN NEW;
END;
$progress$;
REVOKE ALL ON FUNCTION public.stage2_stamp_routine_date_progress() FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.routine_change_single_date(
 p_work_item_id uuid,
 p_scheduled_on date,
 p_action text,
 p_reason text,
 p_expected_version integer
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $single$
DECLARE
 v_org uuid:=public.app_org_id();
 v_operation record;
 v_previous record;
 v_version integer:=0;
 v_is_self boolean:=false;
 v_current_date date:=(clock_timestamp() AT TIME ZONE 'Africa/Accra')::date;
BEGIN
 IF auth.uid() IS NULL OR v_org IS NULL OR NOT public.app_stage2_universal_aal_allowed() THEN
  RAISE EXCEPTION 'An active verified CEAC login is required.' USING ERRCODE='42501';
 END IF;
 SELECT r.id, r.org_id, r.unit_id,r.work_item_id,r.active,r.paused_at,
        w.assignee_id,w.assigned_by,w.origin,w.kind,w.visibility,w.confidential
 INTO v_operation FROM public.recurring_operations r
 JOIN public.work_items w ON w.id=r.work_item_id AND w.org_id=r.org_id
 WHERE r.work_item_id=p_work_item_id AND r.org_id=v_org FOR UPDATE OF r;
 IF NOT FOUND OR v_operation.kind IS DISTINCT FROM 'routine'
  OR v_operation.visibility IS DISTINCT FROM 'unit' OR v_operation.confidential THEN
  RAISE EXCEPTION 'That organisational recurring responsibility is unavailable.' USING ERRCODE='42501';
 END IF;
 v_is_self:=v_operation.origin='self_created'
   AND v_operation.assignee_id=auth.uid() AND v_operation.assigned_by=auth.uid();
 IF NOT (public.app_is_admin() OR v_operation.unit_id IN (SELECT public.app_managed_units()) OR v_is_self) THEN
  RAISE EXCEPTION 'Only the creator, a managing department head or Administration may make a single-date exception.' USING ERRCODE='42501';
 END IF;
 IF p_action IS NULL OR p_action NOT IN ('skip','restore')
  OR p_scheduled_on IS NULL OR p_scheduled_on<v_current_date OR p_scheduled_on>v_current_date+370
  OR length(btrim(coalesce(p_reason,''))) NOT BETWEEN 8 AND 2000 OR p_expected_version IS NULL THEN
  RAISE EXCEPTION 'Choose one current or future scheduled date, a reason and its verified revision.' USING ERRCODE='22023';
 END IF;
 IF EXISTS(SELECT 1 FROM public.operation_occurrences o
   WHERE o.operation_id=v_operation.id AND o.occurred_on=p_scheduled_on)
  OR EXISTS(SELECT 1 FROM public.routine_date_progress d
    WHERE d.operation_id=v_operation.id AND d.scheduled_on=p_scheduled_on) THEN
  RAISE EXCEPTION 'A date with recorded outcome or progress cannot be skipped or restored.' USING ERRCODE='22023';
 END IF;
 SELECT version,action INTO v_previous FROM public.routine_date_exceptions
 WHERE operation_id=v_operation.id AND org_id=v_org AND scheduled_on=p_scheduled_on
 ORDER BY version DESC LIMIT 1;
 v_version:=COALESCE(v_previous.version,0);
 IF p_expected_version IS DISTINCT FROM v_version THEN
  RAISE EXCEPTION 'This date has changed. Refresh before saving.' USING ERRCODE='40001';
 END IF;
 IF (p_action='skip' AND v_previous.action='skip')
    OR (p_action='restore' AND COALESCE(v_previous.action,'restore')='restore') THEN
  RAISE EXCEPTION 'That date already has the requested status.' USING ERRCODE='22023';
 END IF;
 IF NOT EXISTS(
  SELECT 1 FROM private.routine_schedule_dates(ARRAY[p_work_item_id],p_scheduled_on,p_scheduled_on,v_org) d
  WHERE d.scheduled_on=p_scheduled_on AND d.operation_id=v_operation.id
   AND (p_action='restore' OR d.state<>'skipped')
 ) THEN
  RAISE EXCEPTION 'This date is not a valid scheduled occurrence.' USING ERRCODE='22023';
 END IF;
 INSERT INTO public.routine_date_exceptions(org_id,operation_id,scheduled_on,version,action,reason,actor_id)
 VALUES(v_org,v_operation.id,p_scheduled_on,v_version+1,p_action,btrim(p_reason),auth.uid());
 INSERT INTO public.activity_events(org_id,actor_id,verb,object_type,object_id,meta)
 VALUES(v_org,auth.uid(),CASE WHEN p_action='skip' THEN 'routine_date_skipped' ELSE 'routine_date_restored' END,
        'work_item',p_work_item_id,
        jsonb_build_object('scheduled_on',p_scheduled_on,'version',v_version+1,'reason',btrim(p_reason)));
 RETURN jsonb_build_object('work_item_id',p_work_item_id,'scheduled_on',p_scheduled_on,
                           'action',p_action,'version',v_version+1,'recorded_by',auth.uid());
END;
$single$;
REVOKE ALL ON FUNCTION public.routine_change_single_date(uuid,date,text,text,integer)
 FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.routine_change_single_date(uuid,date,text,text,integer)
 TO authenticated;
COMMENT ON FUNCTION public.routine_change_single_date(uuid,date,text,text,integer) IS
 'Manager/Admin or self-created-owner only. Immutable, optimistic-locking skip/restoration of a single current/future date without modifying any other date or existing evidence.';
