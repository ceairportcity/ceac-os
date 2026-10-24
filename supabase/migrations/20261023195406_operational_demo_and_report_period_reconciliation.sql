-- Reversible operational demonstration archive and unfiled-period reconciliation.
-- No production record is classified, deleted, closed or rewritten by this DDL.
CREATE TABLE public.operational_archive_events (
 event_no bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 org_id uuid NOT NULL REFERENCES public.organisations(id),
 record_table text NOT NULL CHECK(record_table IN ('projects','work_items','report_periods')),
 record_id uuid NOT NULL,
 archived boolean NOT NULL,
 canonical_period_id uuid REFERENCES public.report_periods(id),
 reason text NOT NULL CHECK(length(btrim(reason)) BETWEEN 10 AND 1000),
 recorded_by uuid NOT NULL REFERENCES public.profiles(id),
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK(canonical_period_id IS NULL OR (record_table='report_periods' AND canonical_period_id<>record_id))
);
CREATE INDEX operational_archive_record_history ON public.operational_archive_events(org_id,record_table,record_id,event_no DESC);
CREATE INDEX operational_archive_actor ON public.operational_archive_events(recorded_by);
CREATE INDEX operational_archive_canonical ON public.operational_archive_events(canonical_period_id);
ALTER TABLE public.operational_archive_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.operational_archive_events FROM public,anon,authenticated,service_role;
GRANT SELECT(event_no,org_id,record_table,record_id,archived) ON public.operational_archive_events TO authenticated;
CREATE POLICY operational_archive_read ON public.operational_archive_events FOR SELECT TO authenticated
 USING(org_id=(SELECT public.app_org_id()));

CREATE FUNCTION public.operational_record_is_archived(p_table text,p_id uuid,p_org uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT coalesce((SELECT e.archived FROM public.operational_archive_events e
  WHERE e.org_id=p_org AND e.record_table=p_table AND e.record_id=p_id
  ORDER BY e.event_no DESC LIMIT 1),false);
$$;
REVOKE ALL ON FUNCTION public.operational_record_is_archived(text,uuid,uuid) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.operational_record_is_archived(text,uuid,uuid) TO authenticated;

CREATE POLICY projects_operational_live ON public.projects AS RESTRICTIVE FOR SELECT TO authenticated
 USING(NOT public.operational_record_is_archived('projects',id,org_id));
CREATE POLICY work_operational_live ON public.work_items AS RESTRICTIVE FOR SELECT TO authenticated
 USING(NOT public.operational_record_is_archived('work_items',id,org_id)
  AND NOT public.operational_record_is_archived('projects',project_id,org_id));
CREATE POLICY periods_operational_live ON public.report_periods AS RESTRICTIVE FOR SELECT TO authenticated
 USING(NOT public.operational_record_is_archived('report_periods',id,org_id));

-- Private read projections give existing definer aggregators the same boundary.
-- They are not browser interfaces, and do not replace existing authority checks.
CREATE VIEW private.operational_live_projects WITH(security_invoker=true) AS
 SELECT p.* FROM public.projects p WHERE NOT public.operational_record_is_archived('projects',p.id,p.org_id);
CREATE VIEW private.operational_live_work_items WITH(security_invoker=true) AS
 SELECT w.* FROM public.work_items w WHERE NOT public.operational_record_is_archived('work_items',w.id,w.org_id)
 AND NOT public.operational_record_is_archived('projects',w.project_id,w.org_id);
CREATE VIEW private.operational_live_report_periods WITH(security_invoker=true) AS
 SELECT p.* FROM public.report_periods p WHERE NOT public.operational_record_is_archived('report_periods',p.id,p.org_id);
CREATE VIEW private.operational_live_reports WITH(security_invoker=true) AS
 SELECT r.* FROM public.reports r WHERE NOT public.operational_record_is_archived('report_periods',r.period_id,r.org_id)
 AND NOT public.operational_record_is_archived('projects',r.project_id,r.org_id);
CREATE VIEW private.operational_live_objectives WITH(security_invoker=true) AS
 SELECT o.* FROM public.objectives o WHERE NOT public.operational_record_is_archived('projects',o.project_id,o.org_id);
CREATE VIEW private.operational_live_feedback_notes WITH(security_invoker=true) AS
 SELECT f.* FROM public.feedback_notes f WHERE NOT public.operational_record_is_archived('projects',f.project_id,f.org_id)
 AND NOT public.operational_record_is_archived('work_items',f.work_item_id,f.org_id);
CREATE VIEW private.operational_live_work_sessions WITH(security_invoker=true) AS
 SELECT s.* FROM public.work_sessions s WHERE NOT public.operational_record_is_archived('work_items',s.work_item_id,s.org_id);
REVOKE ALL ON private.operational_live_projects,private.operational_live_work_items,
 private.operational_live_report_periods,private.operational_live_reports,private.operational_live_objectives,
 private.operational_live_feedback_notes,private.operational_live_work_sessions FROM public,anon,authenticated,service_role;

CREATE FUNCTION public.admin_operational_archive_records()
RETURNS TABLE(record_table text,record_id uuid,label text,status text,archived boolean,
 event_no bigint,fingerprint text,reason text,canonical_period_id uuid,retained_reports jsonb)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR public.app_org_id() IS NULL OR NOT public.app_is_admin() THEN
  RAISE EXCEPTION 'Only Administration can review operational archives.' USING ERRCODE='42501';
 END IF;
 RETURN QUERY WITH records AS (
  SELECT 'projects'::text kind,p.id,p.org_id,p.name label,p.status,md5(to_jsonb(p)::text) fingerprint FROM public.projects p
  UNION ALL SELECT 'work_items',w.id,w.org_id,w.title,w.status,md5(to_jsonb(w)::text) FROM public.work_items w
   -- Retain the original private-work boundary, including when already archived.
   WHERE w.assignee_id=auth.uid() OR w.visibility<>'private'
  UNION ALL SELECT 'report_periods',p.id,p.org_id,p.label,p.status,md5(to_jsonb(p)::text) FROM public.report_periods p
 ) SELECT r.kind,r.id,r.label,r.status,coalesce(e.archived,false),coalesce(e.event_no,0),r.fingerprint,
   e.reason,e.canonical_period_id,
   CASE WHEN r.kind='report_periods' THEN coalesce((SELECT jsonb_agg(to_jsonb(rpt) ORDER BY rpt.prepared_at,rpt.id)
    FROM public.reports rpt WHERE rpt.period_id=r.id AND rpt.org_id=r.org_id),'[]'::jsonb) ELSE '[]'::jsonb END
 FROM records r LEFT JOIN LATERAL (
  SELECT h.archived,h.event_no,h.reason,h.canonical_period_id FROM public.operational_archive_events h
  WHERE h.org_id=r.org_id AND h.record_table=r.kind AND h.record_id=r.id ORDER BY h.event_no DESC LIMIT 1
 ) e ON true WHERE r.org_id=public.app_org_id() ORDER BY r.kind,r.label,r.id;
END; $$;
REVOKE ALL ON FUNCTION public.admin_operational_archive_records() FROM public,anon;
GRANT EXECUTE ON FUNCTION public.admin_operational_archive_records() TO authenticated;

CREATE FUNCTION public.admin_apply_operational_archive(p_changes jsonb,p_reason text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_org uuid:=public.app_org_id(); j jsonb; v_row jsonb; v_previous record;
 v_table text; v_id uuid; v_archive boolean; v_canonical uuid; v_target public.report_periods; v_count integer:=0;
BEGIN
 IF auth.uid() IS NULL OR v_org IS NULL OR NOT public.app_is_admin() THEN
  RAISE EXCEPTION 'Only Administration can classify operational records.' USING ERRCODE='42501';
 END IF;
 IF p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 10 AND 1000 THEN
  RAISE EXCEPTION 'Record a reason of 10 to 1000 characters.';
 END IF;
 IF p_changes IS NULL OR jsonb_typeof(p_changes)<>'array' OR jsonb_array_length(p_changes) NOT BETWEEN 1 AND 100 THEN
  RAISE EXCEPTION 'Choose between one and 100 records.';
 END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_changes) x GROUP BY x->>'record_table',x->>'record_id' HAVING count(*)>1) THEN
  RAISE EXCEPTION 'Choose each record only once.';
 END IF;
 -- Lock and validate EVERY source before writing; a stale member rolls back the batch.
 FOR j IN SELECT value FROM jsonb_array_elements(p_changes) ORDER BY value->>'record_table',value->>'record_id' LOOP
  v_table:=j->>'record_table'; v_id:=(j->>'record_id')::uuid;
  IF v_table IS NULL OR v_table NOT IN ('projects','work_items','report_periods') OR v_id IS NULL
   OR j->>'fingerprint' IS NULL OR j->>'event_no' IS NULL OR jsonb_typeof(j->'archived') IS DISTINCT FROM 'boolean' THEN
   RAISE EXCEPTION 'Refresh the selected record details.';
  END IF;
  EXECUTE format('SELECT to_jsonb(t) FROM public.%I t WHERE t.id=$1 AND t.org_id=$2 FOR UPDATE',v_table)
   INTO v_row USING v_id,v_org;
  IF v_row IS NULL OR (v_table='work_items' AND v_row->>'visibility'='private' AND (v_row->>'assignee_id')::uuid IS DISTINCT FROM auth.uid()) THEN
   RAISE EXCEPTION 'That operational record is unavailable.' USING ERRCODE='42501';
  END IF;
  SELECT e.event_no,e.archived INTO v_previous FROM public.operational_archive_events e
   WHERE e.org_id=v_org AND e.record_table=v_table AND e.record_id=v_id ORDER BY e.event_no DESC LIMIT 1;
  IF md5(v_row::text)<>j->>'fingerprint' OR coalesce(v_previous.event_no,0)<>(j->>'event_no')::bigint THEN
   RAISE EXCEPTION 'A selected record changed. Refresh before recording the classification.' USING ERRCODE='40001';
  END IF;
  IF coalesce(v_previous.archived,false)=(j->>'archived')::boolean THEN RAISE EXCEPTION 'That classification is already recorded.'; END IF;
 END LOOP;
 -- Archive children first; restore parents first. No original work state is changed.
 FOR j IN SELECT value FROM jsonb_array_elements(p_changes) ORDER BY
  CASE WHEN (value->>'archived')::boolean THEN CASE value->>'record_table' WHEN 'work_items' THEN 0 WHEN 'projects' THEN 1 ELSE 2 END
   ELSE CASE value->>'record_table' WHEN 'projects' THEN 0 WHEN 'work_items' THEN 1 ELSE 2 END END,value->>'record_id' LOOP
  v_table:=j->>'record_table'; v_id:=(j->>'record_id')::uuid; v_archive:=(j->>'archived')::boolean;
  v_canonical:=nullif(j->>'canonical_period_id','')::uuid;
  EXECUTE format('SELECT to_jsonb(t) FROM public.%I t WHERE t.id=$1 AND t.org_id=$2',v_table) INTO v_row USING v_id,v_org;
  IF v_canonical IS NOT NULL AND (v_table<>'report_periods' OR NOT v_archive OR v_canonical=v_id) THEN
   RAISE EXCEPTION 'Only a duplicate reporting period can name a canonical period.';
  END IF;
  IF v_table='work_items' THEN
   IF v_archive AND EXISTS(SELECT 1 FROM public.work_sessions s WHERE s.work_item_id=v_id AND s.ended_at IS NULL) THEN
    RAISE EXCEPTION 'End the existing work session before archiving this task.';
   END IF;
   IF v_archive AND (EXISTS(SELECT 1 FROM public.personal_day_tasks p WHERE p.linked_work_item_id=v_id)
    OR EXISTS(SELECT 1 FROM public.work_dependencies d WHERE d.depends_on_work_item_id=v_id AND NOT public.operational_record_is_archived('work_items',d.work_item_id,v_org))) THEN
    RAISE EXCEPTION 'Review the linked live personal work and dependencies before archiving this task.';
   END IF;
   IF NOT v_archive AND public.operational_record_is_archived('projects',(v_row->>'project_id')::uuid,v_org) THEN
    RAISE EXCEPTION 'Restore the project before restoring its task.';
   END IF;
  ELSIF v_table='projects' AND v_archive THEN
   IF EXISTS(SELECT 1 FROM public.work_items w WHERE w.project_id=v_id AND NOT public.operational_record_is_archived('work_items',w.id,v_org)) THEN
    RAISE EXCEPTION 'Classify every linked task before archiving the project.';
   END IF;
   IF EXISTS(SELECT 1 FROM public.personal_day_tasks p WHERE p.linked_project_id=v_id)
    OR EXISTS(SELECT 1 FROM public.reports r WHERE r.project_id=v_id)
    OR EXISTS(SELECT 1 FROM public.project_dependencies d WHERE d.depends_on_project_id=v_id AND NOT public.operational_record_is_archived('projects',d.project_id,v_org))
    OR EXISTS(SELECT 1 FROM public.budgets b WHERE b.project_id=v_id AND NOT public.finance_record_is_demo('budgets',b.id,v_org))
    OR EXISTS(SELECT 1 FROM public.spend_lines s WHERE s.project_id=v_id AND NOT public.finance_record_is_demo('spend_lines',s.id,v_org))
    OR EXISTS(SELECT 1 FROM public.finance_requests r WHERE r.project_id=v_id AND NOT public.finance_record_is_demo('finance_requests',r.id,v_org))
    OR EXISTS(SELECT 1 FROM public.internal_transfers t WHERE t.project_id=v_id) THEN
    RAISE EXCEPTION 'Review linked live reports, finance, personal work and project dependencies before archiving.';
   END IF;
  ELSIF v_table='report_periods' THEN
   PERFORM pg_advisory_xact_lock(hashtextextended(v_org::text||':'||(v_row->>'kind')||':'||(v_row->>'starts_on')||':'||(v_row->>'ends_on'),0));
   IF v_canonical IS NOT NULL THEN
    SELECT * INTO v_target FROM public.report_periods p WHERE p.id=v_canonical AND p.org_id=v_org FOR UPDATE;
    IF v_target.id IS NULL OR public.operational_record_is_archived('report_periods',v_target.id,v_org)
     OR v_target.kind IS DISTINCT FROM v_row->>'kind' OR v_target.starts_on::text IS DISTINCT FROM v_row->>'starts_on'
     OR v_target.ends_on::text IS DISTINCT FROM v_row->>'ends_on' THEN
     RAISE EXCEPTION 'Choose a live canonical period with the same kind and dates.';
    END IF;
    -- Report-bearing duplicates need a separately reviewed report merge; never
    -- move versions or silently discard a filing to satisfy a uniqueness rule.
    IF EXISTS(SELECT 1 FROM public.reports r WHERE r.period_id=v_id) THEN
     RAISE EXCEPTION 'This duplicate contains reports. Retain it for a reviewed report reconciliation.';
    END IF;
   END IF;
   IF v_archive AND EXISTS(SELECT 1 FROM public.operational_archive_events e WHERE e.canonical_period_id=v_id AND e.archived
     AND e.event_no=(SELECT max(h.event_no) FROM public.operational_archive_events h WHERE h.org_id=e.org_id AND h.record_table=e.record_table AND h.record_id=e.record_id)) THEN
    RAISE EXCEPTION 'Restore or reconcile the linked duplicate before archiving its canonical period.';
   END IF;
   IF NOT v_archive AND v_row->>'status'='open' AND EXISTS(SELECT 1 FROM public.report_periods p WHERE p.org_id=v_org AND p.id<>v_id
    AND p.kind=v_row->>'kind' AND p.starts_on=(v_row->>'starts_on')::date AND p.ends_on=(v_row->>'ends_on')::date AND p.status='open'
    AND NOT public.operational_record_is_archived('report_periods',p.id,p.org_id)) THEN
    RAISE EXCEPTION 'Close the other open period before restoring this period.';
   END IF;
  END IF;
  INSERT INTO public.operational_archive_events(org_id,record_table,record_id,archived,canonical_period_id,reason,recorded_by)
   VALUES(v_org,v_table,v_id,v_archive,v_canonical,btrim(p_reason),auth.uid());
  v_count:=v_count+1;
 END LOOP;
 RETURN v_count;
END; $$;
REVOKE ALL ON FUNCTION public.admin_apply_operational_archive(jsonb,text) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.admin_apply_operational_archive(jsonb,text) TO authenticated;

-- Archive cannot be bypassed by an older SECURITY DEFINER mutation. Locks use
-- the same parent rows as classification; old and new links are both guarded.
CREATE FUNCTION private.guard_operational_archive()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE item text; bits text[]; v_id uuid; v_org uuid; r jsonb; rows jsonb[];
BEGIN
 rows:=CASE WHEN TG_OP='INSERT' THEN ARRAY[to_jsonb(NEW)] WHEN TG_OP='DELETE' THEN ARRAY[to_jsonb(OLD)] ELSE ARRAY[to_jsonb(OLD),to_jsonb(NEW)] END;
 FOREACH r IN ARRAY rows LOOP
  FOREACH item IN ARRAY TG_ARGV LOOP
   bits:=string_to_array(item,':'); v_id:=nullif(r->>bits[1],'')::uuid;
   IF v_id IS NOT NULL THEN
    EXECUTE format('SELECT org_id FROM public.%I WHERE id=$1 FOR SHARE',bits[2]) INTO v_org USING v_id;
    IF public.operational_record_is_archived(bits[2],v_id,v_org) THEN
     RAISE EXCEPTION 'Archived operational records are read-only. Review their classification first.' USING ERRCODE='42501';
    END IF;
   END IF;
  END LOOP;
 END LOOP;
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END; $$;
REVOKE ALL ON FUNCTION private.guard_operational_archive() FROM public,anon,authenticated,service_role;
CREATE TRIGGER operational_project_guard BEFORE UPDATE OR DELETE ON public.projects FOR EACH ROW EXECUTE FUNCTION private.guard_operational_archive('id:projects');
CREATE TRIGGER operational_work_guard BEFORE UPDATE OR DELETE ON public.work_items FOR EACH ROW EXECUTE FUNCTION private.guard_operational_archive('id:work_items');
CREATE TRIGGER operational_period_guard BEFORE UPDATE OR DELETE ON public.report_periods FOR EACH ROW EXECUTE FUNCTION private.guard_operational_archive('id:report_periods');

-- Existing and future direct FK links inherit the root archive boundary. This
-- preserves original rows and history, while preventing new operational use.
DO $links$
DECLARE t record; conditions text; arguments text;
BEGIN
 FOR t IN SELECT c.conrelid AS rel,array_agg(a.attname||':'||parent.relname ORDER BY a.attname) links
  FROM pg_constraint c JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=c.conkey[1]
  JOIN pg_class parent ON parent.oid=c.confrelid
  WHERE c.contype='f' AND c.confrelid IN ('public.projects'::regclass,'public.work_items'::regclass,'public.report_periods'::regclass)
  AND cardinality(c.conkey)=1 GROUP BY c.conrelid LOOP
  SELECT string_agg(format('%L',x),',') INTO arguments FROM unnest(t.links) x;
  EXECUTE format('CREATE TRIGGER operational_parent_guard BEFORE INSERT OR UPDATE OR DELETE ON %s FOR EACH ROW EXECUTE FUNCTION private.guard_operational_archive(%s)',t.rel::regclass,arguments);
  -- Clock history and private plans stay accessible as history; their new links
  -- are still guarded. Finance uses its independently reviewed archive boundary.
  IF t.rel NOT IN ('public.operational_archive_events'::regclass,'public.work_sessions'::regclass,'public.personal_day_tasks'::regclass,'public.budgets'::regclass,
    'public.spend_lines'::regclass,'public.income_lines'::regclass,'public.finance_requests'::regclass,'public.internal_transfers'::regclass) THEN
   SELECT string_agg(format('NOT public.operational_record_is_archived(%L,%I,(SELECT public.app_org_id()))',split_part(x,':',2),split_part(x,':',1)),' AND ')
    INTO conditions FROM unnest(t.links) x;
   EXECUTE format('CREATE POLICY operational_parent_live ON %s AS RESTRICTIVE FOR SELECT TO authenticated USING(%s)',t.rel::regclass,conditions);
  END IF;
 END LOOP;
END; $links$;

CREATE POLICY alerts_operational_live ON public.alerts AS RESTRICTIVE FOR SELECT TO authenticated USING(
 (subject_type<>'work_item' OR NOT public.operational_record_is_archived('work_items',subject_id,org_id))
 AND (subject_type<>'project' OR NOT public.operational_record_is_archived('projects',subject_id,org_id)));

CREATE FUNCTION private.guard_report_period_identity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF TG_OP='UPDATE' AND (NEW.org_id,NEW.kind,NEW.starts_on,NEW.ends_on) IS NOT DISTINCT FROM (OLD.org_id,OLD.kind,OLD.starts_on,OLD.ends_on) THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' AND EXISTS(SELECT 1 FROM public.operational_archive_events e WHERE e.canonical_period_id=OLD.id AND e.archived
  AND e.event_no=(SELECT max(h.event_no) FROM public.operational_archive_events h WHERE h.org_id=e.org_id AND h.record_table=e.record_table AND h.record_id=e.record_id)) THEN
  RAISE EXCEPTION 'A canonical period with retained duplicate links cannot change its identity.';
 END IF;
 IF NEW.kind='project' THEN RETURN NEW; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(NEW.org_id::text||':'||NEW.kind||':'||NEW.starts_on::text||':'||NEW.ends_on::text,0));
 IF EXISTS(SELECT 1 FROM public.report_periods p WHERE p.org_id=NEW.org_id AND p.kind=NEW.kind AND p.starts_on=NEW.starts_on
  AND p.ends_on=NEW.ends_on AND p.id<>NEW.id AND NOT public.operational_record_is_archived('report_periods',p.id,p.org_id)) THEN
  RAISE EXCEPTION 'A reporting period already exists for these dates. Use its existing record.' USING ERRCODE='23505';
 END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION private.guard_report_period_identity() FROM public,anon,authenticated,service_role;
CREATE TRIGGER report_period_identity_guard BEFORE INSERT OR UPDATE ON public.report_periods FOR EACH ROW EXECUTE FUNCTION private.guard_report_period_identity();

-- Existing authority checks are preserved verbatim; read sources alone exclude archives.

CREATE OR REPLACE FUNCTION public.admin_people_summary()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_org uuid:=public.app_org_id();
  v_today date:=current_date;
  v_month_start date:=date_trunc('month',current_date)::date;
  v_year int:=extract(year from current_date)::int;
begin
  if auth.uid() is null or not public.app_has_capability('people.manage',null) then
    raise exception 'Only Administration & HR can view organisation People summaries.'
      using errcode='42501';
  end if;

  return coalesce((
    select jsonb_agg(to_jsonb(x) order by x.full_name)
    from (
      select
        p.id,p.full_name,p.email,p.job_title,p.phone,p.started_on,p.contract_type,
        p.active,p.birthday,p.is_admin,p.is_exec,
        um.unit_id,u.name as unit_name,um.role,
        coalesce(w.done_count,0) as done_count,
        coalesce(w.assigned_done_count,0) as assigned_done_count,
        coalesce(w.self_done_count,0) as self_done_count,
        coalesce(w.on_time_count,0) as on_time_count,
        coalesce(w.first_time_count,0) as first_time_count,
        coalesce(w.open_count,0) as open_count,
        coalesce(s.days_this_month,0) as days_this_month,
        s.avg_start_minutes,
        coalesce(l.on_leave_now,false) as on_leave_now,
        coalesce(l.leave_count,0) as leave_count,
        lb.annual_taken,lb.sick_taken,lb.carryover_from_last_year,
        sub.last_submission,
        (sub.last_submission is null or sub.last_submission < now()-interval '14 days') as quiet
      from public.profiles p
      left join lateral (
        select um1.unit_id,um1.role
        from public.unit_memberships um1
        where um1.profile_id=p.id and um1.org_id=v_org
        order by case when um1.role='manager' then 0 else 1 end,um1.created_at
        limit 1
      ) um on true
      left join public.units u on u.id=um.unit_id
      left join lateral (
        select
          count(*) filter(where wi.status in ('completed','self_certified') and wi.kind in ('task','deliverable'))::int done_count,
          count(*) filter(where wi.status in ('completed','self_certified') and wi.kind in ('task','deliverable') and wi.origin='assigned')::int assigned_done_count,
          count(*) filter(where wi.status in ('completed','self_certified') and wi.kind in ('task','deliverable') and wi.origin='self_created')::int self_done_count,
          count(*) filter(where wi.status in ('completed','self_certified') and wi.kind in ('task','deliverable') and wi.due_at is not null and wi.completed_at<=wi.due_at)::int on_time_count,
          count(*) filter(where wi.status in ('completed','self_certified') and wi.kind in ('task','deliverable') and wi.first_time_approved is true)::int first_time_count,
          count(*) filter(where wi.status not in ('completed','self_certified','cancelled'))::int open_count
        from private.operational_live_work_items wi
        where wi.assignee_id=p.id and wi.visibility<>'private'
      ) w on true
      left join lateral (
        select
          count(distinct ws.started_at::date) filter(where ws.started_at>=v_month_start)::int days_this_month,
          round(avg(extract(hour from ws.started_at)*60+extract(minute from ws.started_at)))::int avg_start_minutes
        from private.operational_live_work_sessions ws
        where ws.profile_id=p.id
      ) s on true
      left join lateral (
        select
          bool_or(lr.status='approved' and lr.start_date<=v_today and lr.end_date>=v_today) as on_leave_now,
          count(*)::int leave_count
        from public.leave_requests lr
        where lr.profile_id=p.id
      ) l on true
      left join public.leave_balances lb on lb.profile_id=p.id and lb.year=v_year
      left join lateral (
        select max(sb.submitted_at) last_submission
        from public.submissions sb
        where sb.profile_id=p.id
      ) sub on true
      where p.org_id=v_org
    ) x
  ),'[]'::jsonb);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_person_detail(p_profile_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_org uuid:=public.app_org_id();
begin
  if auth.uid() is null or not public.app_has_capability('people.manage',null) then
    raise exception 'Only Administration & HR can view this employee detail.'
      using errcode='42501';
  end if;
  if not exists(select 1 from public.profiles p where p.id=p_profile_id and p.org_id=v_org) then
    raise exception 'That employee does not belong to your organisation.' using errcode='42501';
  end if;

  return jsonb_build_object(
    'work',coalesce((
      select jsonb_agg(to_jsonb(x) order by x.created_at desc)
      from (
        select wi.id,wi.ref,wi.title,wi.status,wi.origin,wi.due_at,wi.completed_at,
               wi.first_time_approved,wi.visibility,wi.project_id,pr.name as project_name,wi.created_at
        from private.operational_live_work_items wi
        left join private.operational_live_projects pr on pr.id=wi.project_id
        where wi.assignee_id=p_profile_id and wi.visibility<>'private'
      ) x
    ),'[]'::jsonb),
    'sessions',coalesce((
      select jsonb_agg(to_jsonb(x) order by x.started_at desc)
      from (
        select ws.id,ws.started_at,ws.ended_at,ws.place
        from private.operational_live_work_sessions ws
        where ws.profile_id=p_profile_id
        order by ws.started_at desc
        limit 120
      ) x
    ),'[]'::jsonb),
    'leave',coalesce((
      select jsonb_agg(to_jsonb(x) order by x.start_date desc)
      from (
        select lr.id,lr.kind,lr.start_date,lr.end_date,lr.days,lr.status
        from public.leave_requests lr
        where lr.profile_id=p_profile_id
        order by lr.start_date desc
        limit 120
      ) x
    ),'[]'::jsonb)
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.app_can_review_item(item_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from private.operational_live_work_items w
    where w.id=item_id
      and w.org_id=public.app_org_id()
      and w.kind in ('task','deliverable','meeting_outcome')
      and w.visibility<>'private'
      and w.assignee_id is distinct from auth.uid()
      and (
        public.app_is_admin()
        or (
          public.app_privileged_aal_allowed()
          and public.app_responsible_reviewer_id(w.id)=auth.uid()
        )
      )
  );
$function$
;

CREATE OR REPLACE FUNCTION public.app_can_see_item(item_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from private.operational_live_work_items w
    where w.id=item_id
      and w.org_id=app_org_id()
      and (
        w.assignee_id=auth.uid()
        or (
          w.visibility<>'private'
          and (
            (w.confidential=false and (
              w.unit_id in (select app_my_units())
              or app_is_admin()
              or app_is_exec()
            ))
            or (w.confidential=true and (app_is_admin() or app_is_exec()))
          )
        )
        or (
          w.visibility<>'private'
          and w.confidential=false
          and w.project_id is not null
          and exists (
            select 1 from private.operational_live_projects p
            where p.id=w.project_id
              and (
                p.lead_unit_id in (select app_managed_units())
                or exists (
                  select 1 from project_units pu
                  where pu.project_id=p.id and pu.unit_id in (select app_managed_units())
                )
              )
          )
        )
        or (
          w.kind='request'
          and w.visibility<>'private'
          and w.confidential=false
          and exists (
            select 1 from work_requests wr
            where wr.work_item_id=w.id
              and (
                wr.responsible_profile_id=auth.uid()
                or wr.responsible_unit_id in (select app_managed_units())
              )
          )
        )
      )
  );
$function$
;

CREATE OR REPLACE FUNCTION public.app_check_blockers()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare affected int:=0;
begin
  update public.alerts a
  set resolved_at=now(),
      resolved_reason=case
        when b.state='resolved' then 'blocker_resolved'
        when b.state='disputed' then 'blocker_disputed'
        when b.state='claimed' then 'waiting_for_reply'
        else 'no_longer_applicable'
      end
  from public.blockers b
  where a.kind='blocker_aged'
    and a.subject_type='blocker'
    and a.subject_id=b.id
    and a.resolved_at is null
    and (
      b.state<>'acknowledged'
      or public.app_working_days_between(coalesce(b.responded_at,b.created_at),now())
         < public.app_threshold(b.org_id,'blocker_unanswered',5)
    );

  insert into public.alerts(org_id,kind,subject_type,subject_id,for_unit_id,message,resolved_at,resolved_reason)
  select b.org_id,'blocker_aged','blocker',b.id,w.unit_id,
    'Acknowledged dependency on '||coalesce(u.name,b.party_text)
      ||' has remained unresolved for '
      ||public.app_working_days_between(coalesce(b.responded_at,b.created_at),now())::text
      ||' working days',
    null,null
  from public.blockers b
  join private.operational_live_work_items w on w.id=b.work_item_id
  left join public.units u on u.id=b.party_unit_id
  where b.state='acknowledged'
    and public.app_working_days_between(coalesce(b.responded_at,b.created_at),now())
        >= public.app_threshold(b.org_id,'blocker_unanswered',5)
  on conflict(kind,subject_type,subject_id) do update
  set message=excluded.message,for_unit_id=excluded.for_unit_id,
      last_seen_at=now(),resolved_at=null,resolved_reason=null;

  get diagnostics affected=row_count;
  return affected;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.app_check_falling_targets()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare affected int:=0; affected2 int:=0;
begin
  update public.alerts a
  set resolved_at=now(),resolved_reason='falling_pattern_cleared'
  where a.kind in ('target_falling_periods','target_below_last_year')
    and a.subject_type='report_target'
    and a.resolved_at is null;

  with comparable as (
    select
      rt.id as target_id,r.org_id,r.unit_id,r.profile_id,r.project_id,r.scope,
      lower(btrim(rt.name)) as target_name,coalesce(rt.target_unit,'') as target_unit,
      rt.name as display_name,rt.achieved_value,rp.starts_on,
      row_number() over(
        partition by r.org_id,r.scope,coalesce(r.unit_id,'00000000-0000-0000-0000-000000000000'::uuid),
          coalesce(r.profile_id,'00000000-0000-0000-0000-000000000000'::uuid),
          coalesce(r.project_id,'00000000-0000-0000-0000-000000000000'::uuid),
          lower(btrim(rt.name)),coalesce(rt.target_unit,'')
        order by rp.starts_on desc,r.version desc
      ) rn
    from public.report_targets rt
    join private.operational_live_reports r on r.id=rt.report_id and r.status in ('submitted','confirmed')
    join private.operational_live_report_periods rp on rp.id=r.period_id
    where rt.achieved_value is not null
  ),
  latest as (
    select c.* from comparable c where c.rn=1
  ),
  qualifying as (
    select l.*,public.app_threshold(l.org_id,'falling_periods',3)::int as needed
    from latest l
    where public.app_threshold(l.org_id,'falling_periods',3)>=2
      and (
        select count(*) from comparable c2
        where c2.org_id=l.org_id
          and c2.scope=l.scope
          and c2.unit_id is not distinct from l.unit_id
          and c2.profile_id is not distinct from l.profile_id
          and c2.project_id is not distinct from l.project_id
          and c2.target_name=l.target_name
          and c2.target_unit=l.target_unit
          and c2.rn<=public.app_threshold(l.org_id,'falling_periods',3)
      ) >= public.app_threshold(l.org_id,'falling_periods',3)
      and not exists (
        select 1
        from comparable newer
        join comparable older
          on older.org_id=newer.org_id
         and older.scope=newer.scope
         and older.unit_id is not distinct from newer.unit_id
         and older.profile_id is not distinct from newer.profile_id
         and older.project_id is not distinct from newer.project_id
         and older.target_name=newer.target_name
         and older.target_unit=newer.target_unit
         and older.rn=newer.rn+1
        where newer.org_id=l.org_id
          and newer.scope=l.scope
          and newer.unit_id is not distinct from l.unit_id
          and newer.profile_id is not distinct from l.profile_id
          and newer.project_id is not distinct from l.project_id
          and newer.target_name=l.target_name
          and newer.target_unit=l.target_unit
          and newer.rn<public.app_threshold(l.org_id,'falling_periods',3)
          and newer.achieved_value>=older.achieved_value
      )
  )
  insert into public.alerts(org_id,kind,subject_type,subject_id,for_unit_id,message,resolved_at,resolved_reason)
  select q.org_id,'target_falling_periods','report_target',q.target_id,q.unit_id,
    q.display_name||' has fallen across the latest '||q.needed::text||' reported periods',
    null,null
  from qualifying q
  on conflict(kind,subject_type,subject_id) do update
  set message=excluded.message,for_unit_id=excluded.for_unit_id,last_seen_at=now(),
      resolved_at=null,resolved_reason=null;

  get diagnostics affected=row_count;

  with current_targets as (
    select rt.id as target_id,r.org_id,r.unit_id,r.profile_id,r.project_id,r.scope,
           lower(btrim(rt.name)) target_name,coalesce(rt.target_unit,'') target_unit,
           rt.name display_name,rt.achieved_value,rp.starts_on
    from public.report_targets rt
    join private.operational_live_reports r on r.id=rt.report_id and r.status in ('submitted','confirmed')
    join private.operational_live_report_periods rp on rp.id=r.period_id
    where rt.achieved_value is not null
  ),
  latest as (
    select distinct on(org_id,scope,unit_id,profile_id,project_id,target_name,target_unit) *
    from current_targets
    order by org_id,scope,unit_id,profile_id,project_id,target_name,target_unit,starts_on desc
  ),
  year_pairs as (
    select l.*,prior.achieved_value prior_value
    from latest l
    join current_targets prior
      on prior.org_id=l.org_id
     and prior.scope=l.scope
     and prior.unit_id is not distinct from l.unit_id
     and prior.profile_id is not distinct from l.profile_id
     and prior.project_id is not distinct from l.project_id
     and prior.target_name=l.target_name
     and prior.target_unit=l.target_unit
     and prior.starts_on=(l.starts_on-interval '1 year')::date
    where prior.achieved_value<>0
      and ((prior.achieved_value-l.achieved_value)/abs(prior.achieved_value))*100
          >= public.app_threshold(l.org_id,'falling_vs_last_year',20)
  )
  insert into public.alerts(org_id,kind,subject_type,subject_id,for_unit_id,message,resolved_at,resolved_reason)
  select y.org_id,'target_below_last_year','report_target',y.target_id,y.unit_id,
    y.display_name||' is '
      ||round(((y.prior_value-y.achieved_value)/abs(y.prior_value))*100,1)::text
      ||'% below the same reported period last year',
    null,null
  from year_pairs y
  on conflict(kind,subject_type,subject_id) do update
  set message=excluded.message,for_unit_id=excluded.for_unit_id,last_seen_at=now(),
      resolved_at=null,resolved_reason=null;

  get diagnostics affected2=row_count;
  return affected+affected2;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.app_check_gone_quiet()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare affected int:=0;
begin
  update public.alerts a
  set resolved_at=now(),
      resolved_reason='no_longer_applicable'
  from private.operational_live_work_items w
  where a.kind='gone_quiet'
    and a.subject_type='work_item'
    and a.subject_id=w.id
    and a.resolved_at is null
    and (
      w.status in ('completed','self_certified','cancelled','in_review','waiting_on')
      or w.last_movement_at is null
      or public.app_working_days_between(w.last_movement_at,now())
         < public.app_threshold(w.org_id,'work_gone_quiet',3)
    );

  insert into public.alerts(org_id,kind,subject_type,subject_id,for_profile_id,for_unit_id,message,resolved_at,resolved_reason)
  select w.org_id,'gone_quiet','work_item',w.id,w.assignee_id,w.unit_id,
    'Nothing has moved on '||w.title||' for '
      ||public.app_working_days_between(w.last_movement_at,now())::text||' working days',
    null,null
  from private.operational_live_work_items w
  where w.status not in ('completed','self_certified','cancelled','waiting_on','in_review')
    and w.last_movement_at is not null
    and public.app_working_days_between(w.last_movement_at,now())
        >= public.app_threshold(w.org_id,'work_gone_quiet',3)
  on conflict(kind,subject_type,subject_id) do update
  set message=excluded.message,for_profile_id=excluded.for_profile_id,
      for_unit_id=excluded.for_unit_id,last_seen_at=now(),
      resolved_at=null,resolved_reason=null;

  get diagnostics affected=row_count;
  return affected;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.app_check_objective_silence()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare affected int:=0;
begin
  update public.alerts a
  set resolved_at=now(),resolved_reason='objective_activity_restored'
  from private.operational_live_objectives o
  where a.kind='objective_no_activity'
    and a.subject_type='objective'
    and a.subject_id=o.id
    and a.resolved_at is null
    and (
      o.status in ('met','partly_met','not_met')
      or exists (
        select 1 from private.operational_live_work_items w
        where w.objective_id=o.id
          and w.status not in ('completed','self_certified','cancelled')
          and public.app_working_days_between(w.last_movement_at,now())
             < public.app_threshold(o.org_id,'objective_no_activity',10)
      )
    );

  insert into public.alerts(org_id,kind,subject_type,subject_id,for_unit_id,message,resolved_at,resolved_reason)
  select o.org_id,'objective_no_activity','objective',o.id,o.unit_id,
    o.name||' has no active supporting work or recent work movement within '
      ||public.app_threshold(o.org_id,'objective_no_activity',10)::int::text||' working days',
    null,null
  from private.operational_live_objectives o
  join private.operational_live_projects p on p.id=o.project_id
  where p.status='active'
    and o.status in ('on_track','at_risk')
    and not exists (
      select 1 from private.operational_live_work_items w
      where w.objective_id=o.id
        and w.status not in ('completed','self_certified','cancelled')
        and public.app_working_days_between(w.last_movement_at,now())
           < public.app_threshold(o.org_id,'objective_no_activity',10)
    )
    and public.app_working_days_between(o.created_at,now())
        >= public.app_threshold(o.org_id,'objective_no_activity',10)
  on conflict(kind,subject_type,subject_id) do update
  set message=excluded.message,for_unit_id=excluded.for_unit_id,
      last_seen_at=now(),resolved_at=null,resolved_reason=null;

  get diagnostics affected=row_count;
  return affected;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.app_check_overdue()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare a1 int:=0; a2 int:=0;
begin
  update alerts a
  set resolved_at=now(),
      resolved_reason=case
        when w.status in ('completed','self_certified','cancelled') then 'work_finished'
        when w.status in ('in_review','waiting_on') then 'waiting_elsewhere'
        when w.due_at is null or w.due_at >= now()-interval '1 day' then 'not_overdue'
        else 'no_longer_applicable'
      end
  from private.operational_live_work_items w
  where a.kind in ('overdue_first','overdue_second')
    and a.subject_type='work_item'
    and a.subject_id=w.id
    and a.resolved_at is null
    and (
      w.status in ('completed','self_certified','cancelled','in_review','waiting_on')
      or w.due_at is null
      or w.due_at >= now()-interval '1 day'
    );

  insert into alerts(org_id,kind,subject_type,subject_id,for_profile_id,message,resolved_at,resolved_reason)
  select w.org_id,'overdue_first','work_item',w.id,w.assignee_id,
    w.title||' — due date passed on '||to_char(w.due_at,'DD Mon'),null,null
  from private.operational_live_work_items w
  where w.status not in ('completed','self_certified','cancelled','waiting_on','in_review')
    and w.due_at is not null
    and w.due_at < now()-interval '1 day'
  on conflict(kind,subject_type,subject_id) do update
    set message=excluded.message,
        for_profile_id=excluded.for_profile_id,
        last_seen_at=now(),
        resolved_at=null,
        resolved_reason=null;
  get diagnostics a1=row_count;

  insert into alerts(org_id,kind,subject_type,subject_id,for_unit_id,message,resolved_at,resolved_reason)
  select w.org_id,'overdue_second','work_item',w.id,w.unit_id,
    coalesce((select full_name from profiles where id=w.assignee_id),'Someone')
      ||': '||w.title||' — '||extract(day from now()-w.due_at)::text||' days late',
    null,null
  from private.operational_live_work_items w
  where w.status not in ('completed','self_certified','cancelled','waiting_on','in_review')
    and w.due_at is not null
    and w.due_at < now()-interval '3 days'
  on conflict(kind,subject_type,subject_id) do update
    set message=excluded.message,
        for_unit_id=excluded.for_unit_id,
        last_seen_at=now(),
        resolved_at=null,
        resolved_reason=null;
  get diagnostics a2=row_count;

  return a1+a2;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.app_check_project_attention()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare affected int:=0;
begin
  update public.alerts a
  set resolved_at=now(),resolved_reason='project_attention_cleared'
  from private.operational_live_projects p
  where a.kind='project_open_deliverables_near_end'
    and a.subject_type='project'
    and a.subject_id=p.id
    and a.resolved_at is null
    and (
      p.status<>'active'
      or p.ends_on is null
      or p.ends_on-current_date > public.app_threshold(p.org_id,'project_end_window',7)
      or not exists (
        select 1 from private.operational_live_work_items w
        where w.project_id=p.id and w.kind='deliverable'
          and w.status not in ('completed','self_certified','cancelled')
      )
    );

  insert into public.alerts(org_id,kind,subject_type,subject_id,for_unit_id,message,resolved_at,resolved_reason)
  select p.org_id,'project_open_deliverables_near_end','project',p.id,p.lead_unit_id,
    p.name||' ends in '||greatest(p.ends_on-current_date,0)::text
      ||' days with '
      ||(select count(*) from private.operational_live_work_items w where w.project_id=p.id and w.kind='deliverable'
          and w.status not in ('completed','self_certified','cancelled'))::text
      ||' open deliverable(s)',
    null,null
  from private.operational_live_projects p
  where p.status='active'
    and p.ends_on is not null
    and p.ends_on>=current_date
    and p.ends_on-current_date <= public.app_threshold(p.org_id,'project_end_window',7)
    and exists (
      select 1 from private.operational_live_work_items w
      where w.project_id=p.id and w.kind='deliverable'
        and w.status not in ('completed','self_certified','cancelled')
    )
  on conflict(kind,subject_type,subject_id) do update
  set message=excluded.message,for_unit_id=excluded.for_unit_id,
      last_seen_at=now(),resolved_at=null,resolved_reason=null;

  get diagnostics affected=row_count;
  return affected;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.app_check_project_silence()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare affected int:=0;
begin
  update public.alerts a
  set resolved_at=now(),resolved_reason='project_activity_restored'
  from private.operational_live_projects p
  where a.kind='project_no_movement'
    and a.subject_type='project'
    and a.subject_id=p.id
    and a.resolved_at is null
    and (
      p.status<>'active'
      or extract(epoch from (now()-coalesce(
          (select max(w.last_movement_at) from private.operational_live_work_items w where w.project_id=p.id),
          p.created_at
        )))/604800 < public.app_threshold(p.org_id,'project_no_movement',6)
    );

  insert into public.alerts(org_id,kind,subject_type,subject_id,for_unit_id,message,resolved_at,resolved_reason)
  select p.org_id,'project_no_movement','project',p.id,p.lead_unit_id,
    p.name||' has recorded no work movement for '
      ||floor(extract(epoch from (now()-coalesce(
          (select max(w.last_movement_at) from private.operational_live_work_items w where w.project_id=p.id),
          p.created_at
        )))/604800)::int::text||' weeks',
    null,null
  from private.operational_live_projects p
  where p.status='active'
    and extract(epoch from (now()-coalesce(
          (select max(w.last_movement_at) from private.operational_live_work_items w where w.project_id=p.id),
          p.created_at
        )))/604800 >= public.app_threshold(p.org_id,'project_no_movement',6)
  on conflict(kind,subject_type,subject_id) do update
  set message=excluded.message,for_unit_id=excluded.for_unit_id,last_seen_at=now(),
      resolved_at=null,resolved_reason=null;

  get diagnostics affected=row_count;
  return affected;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.app_check_reporting_silence()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare affected int:=0;
begin
  update public.alerts a
  set resolved_at=now(),resolved_reason='report_filed_or_period_closed'
  where a.kind='unit_report_missing'
    and a.resolved_at is null
    and not exists (
      select 1
      from private.operational_live_report_periods rp
      cross join public.units u
      where md5(rp.id::text||':'||u.id::text)::uuid=a.subject_id
        and rp.org_id=a.org_id and u.org_id=a.org_id
        and rp.status='open'
        and current_date>=rp.starts_on
        and current_date-rp.starts_on >= public.app_threshold(rp.org_id,'unit_not_reported',14)
        and not exists (
          select 1 from private.operational_live_reports r
          where r.period_id=rp.id and r.unit_id=u.id
            and r.scope='unit' and r.status in ('submitted','confirmed')
        )
    );

  insert into public.alerts(org_id,kind,subject_type,subject_id,for_unit_id,message,resolved_at,resolved_reason)
  select rp.org_id,'unit_report_missing','unit_report_period',
    md5(rp.id::text||':'||u.id::text)::uuid,u.id,
    u.name||' has not filed the '||rp.label||' unit report after '
      ||(current_date-rp.starts_on)::text||' days',
    null,null
  from private.operational_live_report_periods rp
  join public.units u on u.org_id=rp.org_id and u.active
  where rp.status='open'
    and current_date>=rp.starts_on
    and current_date-rp.starts_on >= public.app_threshold(rp.org_id,'unit_not_reported',14)
    and not exists (
      select 1 from private.operational_live_reports r
      where r.period_id=rp.id and r.unit_id=u.id
        and r.scope='unit' and r.status in ('submitted','confirmed')
    )
  on conflict(kind,subject_type,subject_id) do update
  set message=excluded.message,for_unit_id=excluded.for_unit_id,
      last_seen_at=now(),resolved_at=null,resolved_reason=null;

  get diagnostics affected=row_count;
  return affected;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.app_check_review_waiting()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare affected int:=0;
begin
  update public.alerts a
  set resolved_at=now(),resolved_reason='no_longer_in_review'
  from private.operational_live_work_items w
  where a.kind='review_waiting'
    and a.subject_type='work_item'
    and a.subject_id=w.id
    and a.resolved_at is null
    and w.status<>'in_review';

  insert into public.alerts(org_id,kind,subject_type,subject_id,for_unit_id,message,resolved_at,resolved_reason)
  select w.org_id,'review_waiting','work_item',w.id,w.unit_id,
    w.title||' has waited for review for '
      ||public.app_working_days_between(s.submitted_at,now())::text||' working days',
    null,null
  from private.operational_live_work_items w
  join lateral (
    select max(s1.submitted_at) submitted_at
    from public.submissions s1
    where s1.work_item_id=w.id
  ) s on s.submitted_at is not null
  where w.status='in_review'
    and public.app_working_days_between(s.submitted_at,now())
        >= public.app_threshold(w.org_id,'review_waiting',5)
  on conflict(kind,subject_type,subject_id) do update
  set message=excluded.message,for_unit_id=excluded.for_unit_id,
      last_seen_at=now(),resolved_at=null,resolved_reason=null;

  get diagnostics affected=row_count;
  return affected;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.app_visible_projects()
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select p.id
  from private.operational_live_projects p
  where p.org_id=public.app_org_id()
    and (
      public.app_is_admin()
      or public.app_is_exec()
      or public.app_has_capability('delivery.manage',null)
      or p.lead_unit_id in (
        select m.unit_id
        from public.unit_memberships m
        where m.profile_id=auth.uid()
      )
      or exists (
        select 1
        from public.project_units pu
        where pu.project_id=p.id
          and pu.unit_id in (
            select m.unit_id
            from public.unit_memberships m
            where m.profile_id=auth.uid()
          )
      )
    );
$function$
;

CREATE OR REPLACE FUNCTION public.performance_generate_evidence_internal(p_appraisal_id uuid, p_actor_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_appraisal public.appraisals;
  v_cycle public.appraisal_cycles;
  v_inserted integer:=0;
  v_count integer:=0;
begin
  select * into v_appraisal
  from public.appraisals
  where id=p_appraisal_id;

  if v_appraisal.id is null then
    raise exception 'Review case not found.';
  end if;

  select * into v_cycle
  from public.appraisal_cycles
  where id=v_appraisal.cycle_id and org_id=v_appraisal.org_id;

  if v_cycle.id is null then
    raise exception 'Review period not found.';
  end if;

  insert into public.appraisal_evidence_items(
    org_id,appraisal_id,profile_id,category,source_type,source_id,
    occurred_on,label,detail,generated_by
  )
  select
    v_appraisal.org_id,v_appraisal.id,v_appraisal.profile_id,
    'work','work_item',w.id,
    w.completed_at::date,w.title,
    jsonb_strip_nulls(jsonb_build_object(
      'ref',w.ref,
      'kind',w.kind,
      'origin',w.origin,
      'status',w.status,
      'due_at',w.due_at,
      'completed_at',w.completed_at,
      'first_time_approved',w.first_time_approved,
      'project_id',w.project_id,
      'objective_id',w.objective_id
    )),
    p_actor_id
  from private.operational_live_work_items w
  where w.org_id=v_appraisal.org_id
    and w.assignee_id=v_appraisal.profile_id
    and w.kind in ('task','deliverable')
    and w.status in ('completed','self_certified')
    and w.completed_at is not null
    and w.completed_at::date between v_cycle.starts_on and v_cycle.ends_on
  on conflict(appraisal_id,source_type,source_id) do nothing;
  get diagnostics v_count=row_count;
  v_inserted:=v_inserted+v_count;

  insert into public.appraisal_evidence_items(
    org_id,appraisal_id,profile_id,category,source_type,source_id,
    occurred_on,label,detail,generated_by
  )
  select
    v_appraisal.org_id,v_appraisal.id,v_appraisal.profile_id,
    'objective','strategy_node',s.id,
    coalesce(s.target_on,s.starts_on,s.created_at::date),s.name,
    jsonb_strip_nulls(jsonb_build_object(
      'node_type',s.node_type,
      'statement',s.statement,
      'measurement_kind',s.measurement_kind,
      'measure_label',s.measure_label,
      'target_value',s.target_value,
      'target_unit',s.target_unit,
      'current_value',s.current_value,
      'status',s.status,
      'starts_on',s.starts_on,
      'target_on',s.target_on
    )),
    p_actor_id
  from public.strategy_nodes s
  where s.org_id=v_appraisal.org_id
    and s.owner_profile_id=v_appraisal.profile_id
    and s.status<>'draft'
    and coalesce(s.starts_on,s.created_at::date)<=v_cycle.ends_on
    and coalesce(s.target_on,v_cycle.ends_on)>=v_cycle.starts_on
  on conflict(appraisal_id,source_type,source_id) do nothing;
  get diagnostics v_count=row_count;
  v_inserted:=v_inserted+v_count;

  insert into public.appraisal_evidence_items(
    org_id,appraisal_id,profile_id,category,source_type,source_id,
    occurred_on,label,detail,generated_by
  )
  select
    v_appraisal.org_id,v_appraisal.id,v_appraisal.profile_id,
    'feedback','feedback_note',f.id,
    coalesce(f.occurred_on,f.created_at::date),
    initcap(replace(f.kind,'_',' '))||' feedback',
    jsonb_strip_nulls(jsonb_build_object(
      'kind',f.kind,
      'note',f.note,
      'occurred_on',f.occurred_on,
      'work_item_id',f.work_item_id,
      'project_id',f.project_id,
      'strategy_node_id',f.strategy_node_id,
      'author_id',f.author_id
    )),
    p_actor_id
  from private.operational_live_feedback_notes f
  where f.org_id=v_appraisal.org_id
    and f.profile_id=v_appraisal.profile_id
    and coalesce(f.occurred_on,f.created_at::date) between v_cycle.starts_on and v_cycle.ends_on
  on conflict(appraisal_id,source_type,source_id) do nothing;
  get diagnostics v_count=row_count;
  v_inserted:=v_inserted+v_count;

  insert into public.appraisal_evidence_items(
    org_id,appraisal_id,profile_id,category,source_type,source_id,
    occurred_on,label,detail,generated_by
  )
  select
    v_appraisal.org_id,v_appraisal.id,v_appraisal.profile_id,
    'activity_context','work_session',ws.id,
    ws.started_at::date,
    'Recorded work session · '||to_char(ws.started_at::date,'DD Mon YYYY'),
    jsonb_strip_nulls(jsonb_build_object(
      'started_at',ws.started_at,
      'ended_at',ws.ended_at,
      'place',ws.place,
      'end_reason',ws.end_reason
    )),
    p_actor_id
  from private.operational_live_work_sessions ws
  where ws.org_id=v_appraisal.org_id
    and ws.profile_id=v_appraisal.profile_id
    and ws.started_at::date between v_cycle.starts_on and v_cycle.ends_on
  on conflict(appraisal_id,source_type,source_id) do nothing;
  get diagnostics v_count=row_count;
  v_inserted:=v_inserted+v_count;

  insert into public.appraisal_evidence_items(
    org_id,appraisal_id,profile_id,category,source_type,source_id,
    occurred_on,label,detail,generated_by
  )
  select
    v_appraisal.org_id,v_appraisal.id,v_appraisal.profile_id,
    'learning_history','training_record',tr.id,
    tr.completed_on,tr.name,
    jsonb_strip_nulls(jsonb_build_object(
      'completed_on',tr.completed_on,
      'note',tr.note
    )),
    p_actor_id
  from public.training_records tr
  where tr.org_id=v_appraisal.org_id
    and tr.profile_id=v_appraisal.profile_id
    and tr.completed_on is not null
    and tr.completed_on between v_cycle.starts_on and v_cycle.ends_on
  on conflict(appraisal_id,source_type,source_id) do nothing;
  get diagnostics v_count=row_count;
  v_inserted:=v_inserted+v_count;

  return v_inserted;
end;
$function$
;
