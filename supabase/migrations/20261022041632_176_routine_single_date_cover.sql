-- Official-CLI forward migration176. One-date cover within the existing routine engine.
-- The series owner, original evidence, reviews and other dates remain unchanged.
CREATE TABLE public.routine_date_covers (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE RESTRICT,
 operation_id uuid NOT NULL REFERENCES public.recurring_operations(id) ON DELETE RESTRICT,
 work_item_id uuid NOT NULL REFERENCES public.work_items(id) ON DELETE RESTRICT,
 unit_id uuid NOT NULL REFERENCES public.units(id) ON DELETE RESTRICT,
 scheduled_on date NOT NULL,
 version integer NOT NULL CHECK(version>0),
 action text NOT NULL CHECK(action IN ('assign','restore')),
 assignee_id uuid REFERENCES public.profiles(id) ON DELETE RESTRICT,
 reason text NOT NULL CHECK(length(btrim(reason)) BETWEEN 8 AND 2000),
 actor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK((action='assign' AND assignee_id IS NOT NULL) OR (action='restore' AND assignee_id IS NULL)),
 UNIQUE(operation_id,scheduled_on,version)
);
CREATE INDEX routine_date_covers_window_idx ON public.routine_date_covers(org_id,scheduled_on,operation_id,version DESC);
ALTER TABLE public.routine_date_covers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.routine_date_covers FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.routine_date_covers TO authenticated;
CREATE POLICY routine_date_covers_read ON public.routine_date_covers FOR SELECT TO authenticated USING (
 org_id=public.app_org_id() AND public.app_stage2_universal_aal_allowed()
 AND public.app_can_see_item(work_item_id)
);
CREATE TRIGGER routine_date_covers_immutable BEFORE UPDATE OR DELETE ON public.routine_date_covers
 FOR EACH ROW EXECUTE FUNCTION public.platform_audit_immutable();

-- Invoker helpers do not bypass the caller's tenant, Work or cover-history RLS.
CREATE FUNCTION private.routine_date_assignee(p_operation_id uuid,p_date date)
RETURNS uuid LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $assignee$
 SELECT CASE WHEN c.action='assign' THEN c.assignee_id ELSE w.assignee_id END
 FROM public.recurring_operations r JOIN public.work_items w ON w.id=r.work_item_id AND w.org_id=r.org_id
 LEFT JOIN LATERAL(SELECT h.action,h.assignee_id FROM public.routine_date_covers h
  WHERE h.operation_id=r.id AND h.org_id=r.org_id AND h.scheduled_on=p_date ORDER BY h.version DESC LIMIT 1) c ON true
 WHERE r.id=p_operation_id;
$assignee$;
REVOKE ALL ON FUNCTION private.routine_date_assignee(uuid,date) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.routine_date_assignee(uuid,date) TO authenticated,service_role;
CREATE FUNCTION private.routine_date_can_record(p_operation_id uuid,p_date date)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $authority$
 SELECT auth.uid() IS NOT NULL AND public.app_stage2_universal_aal_allowed() AND EXISTS(
  SELECT 1 FROM public.recurring_operations r JOIN public.work_items w ON w.id=r.work_item_id AND w.org_id=r.org_id
  JOIN public.units u ON u.id=r.unit_id AND u.org_id=r.org_id AND u.active
  JOIN public.profiles actor ON actor.id=auth.uid() AND actor.org_id=r.org_id AND actor.active
  WHERE r.id=p_operation_id AND r.org_id=public.app_org_id() AND r.active AND r.paused_at IS NULL
   AND w.kind='routine' AND w.visibility='unit' AND NOT w.confidential AND public.app_can_see_item(w.id)
   AND (public.app_is_admin() OR r.unit_id IN(SELECT public.app_managed_units())
    OR (r.unit_id IN(SELECT public.app_my_units())
      AND (private.routine_date_assignee(r.id,p_date)=auth.uid() OR private.routine_date_assignee(r.id,p_date) IS NULL)))
 );
$authority$;
REVOKE ALL ON FUNCTION private.routine_date_can_record(uuid,date) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.routine_date_can_record(uuid,date) TO authenticated,service_role;

CREATE FUNCTION public.routine_set_date_cover(p_work_item_id uuid,p_scheduled_on date,p_assignee_id uuid,p_reason text,p_expected_version integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $cover$
DECLARE v_org uuid:=public.app_org_id(); r record; prior record; v_revision integer; v_zone text;
BEGIN
 IF auth.uid() IS NULL OR v_org IS NULL OR NOT public.app_stage2_universal_aal_allowed() THEN
  RAISE EXCEPTION 'An active verified CEAC login is required.' USING ERRCODE='42501'; END IF;
 SELECT op.id,op.unit_id,op.active,op.paused_at,w.assignee_id,w.kind,w.visibility,w.confidential INTO r
  FROM public.recurring_operations op JOIN public.work_items w ON w.id=op.work_item_id AND w.org_id=op.org_id
  JOIN public.units u ON u.id=op.unit_id AND u.org_id=op.org_id AND u.active
  WHERE op.work_item_id=p_work_item_id AND op.org_id=v_org FOR UPDATE OF op;
 IF NOT FOUND OR r.kind<>'routine' OR r.visibility<>'unit' OR r.confidential
  OR NOT (public.app_is_admin() OR r.unit_id IN(SELECT public.app_managed_units())) THEN
  RAISE EXCEPTION 'Only this department manager or Administration may assign date cover.' USING ERRCODE='42501'; END IF;
 IF NOT r.active OR r.paused_at IS NOT NULL OR p_scheduled_on IS NULL OR p_expected_version IS NULL
  OR length(btrim(coalesce(p_reason,''))) NOT BETWEEN 8 AND 2000 THEN
  RAISE EXCEPTION 'Choose an active scheduled date, a reason and its current revision.' USING ERRCODE='22023'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(r.id::text||':'||p_scheduled_on::text,0));
 SELECT d.timezone INTO v_zone FROM private.routine_schedule_dates(ARRAY[p_work_item_id],p_scheduled_on,p_scheduled_on,v_org) d
  WHERE d.operation_id=r.id AND d.state<>'skipped';
 IF v_zone IS NULL OR p_scheduled_on<(clock_timestamp() AT TIME ZONE v_zone)::date
  OR p_scheduled_on>(clock_timestamp() AT TIME ZONE v_zone)::date+370 THEN
  RAISE EXCEPTION 'Cover requires one current or future scheduled date that is not skipped.' USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT 1 FROM public.operation_occurrences o WHERE o.operation_id=r.id AND o.occurred_on=p_scheduled_on)
  OR EXISTS(SELECT 1 FROM public.routine_date_progress d WHERE d.operation_id=r.id AND d.scheduled_on=p_scheduled_on) THEN
  RAISE EXCEPTION 'A date with recorded work cannot be reassigned. Its actual contributor is preserved.' USING ERRCODE='22023'; END IF;
 SELECT version,action,assignee_id INTO prior FROM public.routine_date_covers
  WHERE operation_id=r.id AND org_id=v_org AND scheduled_on=p_scheduled_on ORDER BY version DESC LIMIT 1;
 v_revision:=coalesce(prior.version,0);
 IF p_expected_version IS DISTINCT FROM v_revision THEN
  RAISE EXCEPTION 'This date assignment has changed. Refresh before saving.' USING ERRCODE='40001'; END IF;
 IF p_assignee_id IS NULL THEN
  IF prior.action IS DISTINCT FROM 'assign' THEN
   RAISE EXCEPTION 'This date already uses its series assignment.' USING ERRCODE='22023'; END IF;
 ELSE
  IF p_assignee_id IS NOT DISTINCT FROM r.assignee_id OR (prior.action='assign' AND prior.assignee_id=p_assignee_id) THEN
   RAISE EXCEPTION 'Choose a different cover person or restore the series assignment.' USING ERRCODE='22023'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.profiles p
   JOIN public.unit_memberships m ON m.profile_id=p.id AND m.org_id=p.org_id AND m.unit_id=r.unit_id
   JOIN public.employment_records e ON e.profile_id=p.id AND e.org_id=p.org_id AND e.employment_status='active'
   WHERE p.id=p_assignee_id AND p.org_id=v_org AND p.active) THEN
   RAISE EXCEPTION 'Choose an active employee account belonging to this department.' USING ERRCODE='42501'; END IF;
 END IF;
 INSERT INTO public.routine_date_covers(org_id,operation_id,work_item_id,unit_id,scheduled_on,version,action,assignee_id,reason,actor_id)
 VALUES(v_org,r.id,p_work_item_id,r.unit_id,p_scheduled_on,v_revision+1,CASE WHEN p_assignee_id IS NULL THEN 'restore' ELSE 'assign' END,p_assignee_id,btrim(p_reason),auth.uid());
 INSERT INTO public.activity_events(org_id,actor_id,verb,object_type,object_id,meta)
 VALUES(v_org,auth.uid(),'routine_date_cover_changed','work_item',p_work_item_id,
  jsonb_build_object('scheduled_on',p_scheduled_on,'assignee_id',p_assignee_id,'version',v_revision+1,'reason',btrim(p_reason)));
 RETURN jsonb_build_object('work_item_id',p_work_item_id,'scheduled_on',p_scheduled_on,'assignee_id',p_assignee_id,'version',v_revision+1,'recorded_by',auth.uid());
END;
$cover$;
REVOKE ALL ON FUNCTION public.routine_set_date_cover(uuid,date,uuid,text,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.routine_set_date_cover(uuid,date,uuid,text,integer) TO authenticated;
COMMENT ON TABLE public.routine_date_covers IS 'Immutable Manager/HR-authorised date assignment history; no series ownership, performance credit or independent approval is inferred.';

DROP POLICY routine_date_progress_write ON public.routine_date_progress;
CREATE POLICY routine_date_progress_write ON public.routine_date_progress FOR INSERT TO authenticated WITH CHECK (
 org_id=public.app_org_id() AND actor_id=auth.uid() AND private.routine_date_can_record(operation_id,scheduled_on)
);
-- Defend direct API occurrence insertion too; unchanged legacy dates retain their existing policy.
CREATE POLICY routine_date_cover_occurrence_guard ON public.operation_occurrences AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (
 NOT EXISTS(SELECT 1 FROM public.routine_date_covers c WHERE c.operation_id=operation_occurrences.operation_id AND c.scheduled_on=operation_occurrences.occurred_on)
 OR (recorded_by=auth.uid() AND private.routine_date_can_record(operation_id,occurred_on))
);

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
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(ro.id::text||':'||p_occurred_on::text,0));
  if not private.routine_date_can_record(ro.id,p_occurred_on) then
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
 -- Lock the date BEFORE validating the schedule. This shares the same
 -- transaction-level lock as routine_change_single_date: a concurrent skip
 -- cannot race with a progress insert that read an earlier status.
 PERFORM pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(NEW.operation_id::text||':'||NEW.scheduled_on::text,0));
 SELECT p.timezone INTO v_zone FROM public.routine_schedule_preview(ARRAY[v_work],NEW.scheduled_on,NEW.scheduled_on) p WHERE p.state<>'skipped';
 IF v_zone IS NULL OR NEW.scheduled_on>(clock_timestamp() AT TIME ZONE v_zone)::date THEN
  RAISE EXCEPTION 'Choose today or an earlier scheduled date.' USING ERRCODE='22023';
 END IF;
 IF NOT private.routine_date_can_record(NEW.operation_id,NEW.scheduled_on) THEN
  RAISE EXCEPTION 'Only the current date assignee or an authorised department reviewer may record progress.' USING ERRCODE='42501';
 END IF;
 -- The date lock above also serialises progress versions and stale saves.
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


create or replace function public.app_can_write_operational_context(
  p_context_type text,
  p_context_id uuid
)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select auth.uid() is not null and case p_context_type
    when 'work_item' then exists(
      select 1 from public.work_items w
      where w.id=p_context_id
        and w.org_id=public.app_org_id()
        and (
          w.assigned_by=auth.uid()
          or public.app_can_review_item(w.id)
          or public.app_is_admin()
          or public.app_is_exec()
        )
    )
    when 'project' then (
      public.app_is_admin()
      or public.app_is_exec()
      or public.app_can_manage_delivery_project(p_context_id)
    )
    when 'room_message' then exists(
      select 1 from public.room_messages rm
      where rm.id=p_context_id
        and rm.org_id=public.app_org_id()
        and rm.author_id=auth.uid()
        and public.app_can_access_room(rm.room_id)
    )
    when 'announcement' then exists(
      select 1 from public.announcements a
      where a.id=p_context_id
        and a.org_id=public.app_org_id()
        and public.app_can_publish_announcements()
    )
    when 'employee_photo' then (
      public.app_is_admin()
      and exists(
        select 1 from public.employee_roster e
        where e.id=p_context_id and e.org_id=public.app_org_id()
      )
    )
    when 'employee_document' then (
      public.app_is_admin()
      and exists(
        select 1 from public.employee_roster e
        where e.id=p_context_id and e.org_id=public.app_org_id()
      )
    )
    when 'routine_date_progress' then (
      public.app_stage2_universal_aal_allowed()
      and exists(select 1 from public.profiles actor where actor.id=auth.uid() and actor.org_id=public.app_org_id() and actor.active)
      and exists(select 1 from public.routine_date_progress p
        join public.recurring_operations r on r.id=p.operation_id and r.org_id=p.org_id
        join public.work_items w on w.id=r.work_item_id and w.org_id=r.org_id
        join public.units u on u.id=r.unit_id and u.org_id=r.org_id and u.active
        where p.id=p_context_id and p.org_id=public.app_org_id() and p.actor_id=auth.uid()
          and r.active and r.paused_at is null and w.kind='routine'
          and w.visibility='unit' and not w.confidential and public.app_can_see_item(w.id)
          and private.routine_date_can_record(r.id,p.scheduled_on))
    )
    when 'support_case' then public.app_can_write_support_case(p_context_id)
    else false
  end;
$$;


create or replace function private.deliver_routine_reminders()
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
  select r.org_id,r.id,w.id,p.id,d.scheduled_on,d.due_at
  from private.routine_schedule_dates(v_group.work_ids,v_day-2,v_day+2,v_group.org_id) d
  join public.recurring_operations r on r.id=d.operation_id and r.org_id=v_group.org_id
  join public.routine_schedule_versions v on v.operation_id=r.id and v.version=d.schedule_version
  join public.work_items w on w.id=r.work_item_id and w.org_id=r.org_id
  join public.profiles p on p.id=private.routine_date_assignee(r.id,d.scheduled_on) and p.org_id=w.org_id and p.active
  join public.units u on u.id=w.unit_id and u.org_id=w.org_id and u.active
  -- Follow recorded effective workforce days/hours; never infer a person's
  -- attendance, hard-code Sundays/church days or invent a missing pattern.
  join lateral(
   select s.* from public.workforce_schedule_versions s
   where s.org_id=w.org_id and s.profile_id=p.id
    and (s.unit_id is null or s.unit_id=w.unit_id)
    and s.effective_from<=v_day and (s.effective_to is null or s.effective_to>=v_day)
    and not exists(select 1 from public.workforce_schedule_versions n
     where n.supersedes_id=s.id and n.effective_from<=v_day and (n.effective_to is null or n.effective_to>=v_day))
   order by s.created_at desc,s.id desc limit 1
  ) pattern on true
  join public.workforce_day_types dt on dt.id=nullif(pattern.day_map->>v_key,'')::uuid and dt.org_id=w.org_id and dt.active
  where d.state IN ('scheduled','unrecorded_past') and v.reminder_minutes_before is not null
   and d.due_at-make_interval(mins=>v.reminder_minutes_before)<=now()
   and d.due_at>=now()-interval '24 hours'
   and w.visibility<>'private' and w.status not in ('completed','cancelled','self_certified')
   and exists(select 1 from public.unit_memberships m where m.org_id=w.org_id and m.unit_id=w.unit_id and m.profile_id=p.id)
   and dt.session_expected
   and v_clock>=(case when pattern.clock_map ? v_key then nullif(pattern.clock_map->v_key->>'start','')::time else pattern.expected_start end)
   and v_clock<(case when pattern.clock_map ? v_key then nullif(pattern.clock_map->v_key->>'end','')::time else pattern.expected_end end)
   and not exists(select 1 from public.leave_requests l where l.org_id=w.org_id and l.profile_id=p.id
    and l.status='approved' and v_day between l.start_date and l.end_date)
  on conflict(operation_id,scheduled_on,for_profile_id) do nothing;
  get diagnostics v_added=row_count;v_count:=v_count+v_added;
 end loop;
 update private.routine_reminder_sweep set last_operation_id=v_ids[cardinality(v_ids)] where singleton;
 return v_count;
end;
$worker$;

