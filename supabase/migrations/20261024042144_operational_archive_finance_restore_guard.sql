-- Close the verified archive/finance restoration gap without changing source rows.
CREATE FUNCTION private.guard_operational_finance_restore()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_row jsonb; v_project uuid; v_period uuid; v_org uuid;
BEGIN
 IF TG_TABLE_NAME='finance_demo_events' THEN
  IF NEW.is_demo THEN RETURN NEW; END IF;
  IF NEW.record_table NOT IN ('budgets','spend_lines','finance_requests') THEN
   RAISE EXCEPTION 'Choose a finance record.' USING ERRCODE='42501';
  END IF;
  EXECUTE format('SELECT to_jsonb(t) FROM public.%I t WHERE id=$1 AND org_id=$2 FOR SHARE',NEW.record_table)
   INTO v_row USING NEW.record_id,NEW.org_id;
  IF v_row IS NULL THEN RAISE EXCEPTION 'The finance source is unavailable.' USING ERRCODE='42501'; END IF;
  v_project:=nullif(v_row->>'project_id','')::uuid;
  v_period:=nullif(v_row->>'period_id','')::uuid;
  IF v_project IS NOT NULL THEN
   SELECT p.org_id INTO v_org FROM public.projects p WHERE p.id=v_project FOR SHARE;
   IF public.operational_record_is_archived('projects',v_project,v_org) THEN
    RAISE EXCEPTION 'Restore the project before restoring its finance record.' USING ERRCODE='42501';
   END IF;
  END IF;
  IF v_period IS NOT NULL THEN
   SELECT p.org_id INTO v_org FROM public.report_periods p WHERE p.id=v_period FOR SHARE;
   IF public.operational_record_is_archived('report_periods',v_period,v_org) THEN
    RAISE EXCEPTION 'Restore the reporting period before restoring its finance record.' USING ERRCODE='42501';
   END IF;
  END IF;
 ELSIF NEW.record_table='report_periods' AND NEW.archived THEN
  -- The Administration writer already holds the same period row lock.
  PERFORM 1 FROM public.report_periods p WHERE p.id=NEW.record_id AND p.org_id=NEW.org_id FOR SHARE;
  IF EXISTS(SELECT 1 FROM public.spend_lines s WHERE s.period_id=NEW.record_id AND s.org_id=NEW.org_id
    AND NOT public.finance_record_is_demo('spend_lines',s.id,s.org_id))
   OR EXISTS(SELECT 1 FROM public.income_lines i WHERE i.period_id=NEW.record_id AND i.org_id=NEW.org_id) THEN
   RAISE EXCEPTION 'Review the linked live finance before archiving this reporting period.' USING ERRCODE='42501';
  END IF;
 END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION private.guard_operational_finance_restore() FROM public,anon,authenticated,service_role;
CREATE TRIGGER operational_finance_restore_guard BEFORE INSERT ON public.finance_demo_events
 FOR EACH ROW EXECUTE FUNCTION private.guard_operational_finance_restore();
CREATE TRIGGER operational_period_finance_guard BEFORE INSERT ON public.operational_archive_events
 FOR EACH ROW EXECUTE FUNCTION private.guard_operational_finance_restore();
