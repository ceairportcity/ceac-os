CREATE TABLE public.compliance_report_filings (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 org_id uuid NOT NULL REFERENCES public.organisations(id),
 memo_id uuid NOT NULL REFERENCES public.memos(id),
 memo_version_id uuid NOT NULL UNIQUE REFERENCES public.memo_versions(id),
 period_start date NOT NULL,
 period_end date NOT NULL,
 issued_by uuid NOT NULL REFERENCES public.profiles(id),
 issued_at timestamptz NOT NULL,
 people_verified integer NOT NULL CHECK (people_verified>=0),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CONSTRAINT compliance_filing_month CHECK (
  period_start=date_trunc('month',period_start::timestamp)::date
  AND period_end=((period_start+interval '1 month')::date-1)
 )
);
CREATE INDEX compliance_filing_period_idx ON public.compliance_report_filings(org_id,period_start DESC,issued_at DESC);
ALTER TABLE public.compliance_report_filings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.compliance_report_filings FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.compliance_report_filings TO authenticated;
CREATE POLICY compliance_filing_participant_read ON public.compliance_report_filings
 FOR SELECT TO authenticated USING (
  org_id=public.app_org_id() AND public.app_stage2_universal_aal_allowed()
  AND public.app_can_access_memo(memo_id)
 );
CREATE FUNCTION private.guard_compliance_filing_immutable()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $guard$
BEGIN
 RAISE EXCEPTION 'Issued Compliance filings are permanent. Issue a new Memo version to correct.' USING ERRCODE='42501';
END $guard$;
REVOKE ALL ON FUNCTION private.guard_compliance_filing_immutable() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER guard_compliance_filing_immutable BEFORE UPDATE OR DELETE ON public.compliance_report_filings
 FOR EACH ROW EXECUTE FUNCTION private.guard_compliance_filing_immutable();

CREATE FUNCTION private.archive_compliance_memo()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $archive$
DECLARE v public.memo_versions; v_start date; v_end date; v_verified integer;
BEGIN
 IF NEW.status NOT IN ('sent','pending_decision')
 OR OLD.status IS NOT DISTINCT FROM NEW.status
 OR auth.uid() IS DISTINCT FROM NEW.sender_id THEN RETURN NEW; END IF;
 IF NOT EXISTS(
  SELECT 1 FROM public.profiles p
  JOIN public.capability_grants g ON g.org_id=p.org_id AND g.profile_id=p.id
  WHERE p.id=NEW.sender_id AND p.org_id=NEW.org_id AND p.active
   AND g.capability='compliance.manage' AND g.scope_unit_id IS NULL
   AND (g.expires_at IS NULL OR g.expires_at>clock_timestamp())
 ) THEN RETURN NEW; END IF;
 SELECT * INTO v FROM public.memo_versions
 WHERE id=NEW.current_version_id AND memo_id=NEW.id AND sent_at IS NOT NULL;
 IF NOT FOUND OR v.subject !~
 '^Monthly Compliance Summary[[:space:]]*[—-][[:space:]]*[0-9]{4}-(0[1-9]|1[0-2])$'
 THEN RETURN NEW; END IF;
 v_start:=(right(v.subject,7)||'-01')::date;
 v_end:=(v_start+interval '1 month')::date-1;
 IF v_end >= (clock_timestamp() AT TIME ZONE 'Africa/Accra')::date
 THEN RAISE EXCEPTION 'The reporting month must finish before issuing its Compliance report.' USING ERRCODE='22023'; END IF;
 IF NOT starts_with(v.body,'CEAC OS — MONTHLY COMPLIANCE SUMMARY')
 OR position('Reporting period: '||v_start||' to '||v_end IN v.body)=0
 THEN RAISE EXCEPTION 'The report does not identify its reporting period.' USING ERRCODE='22023'; END IF;
 v_verified:=(public.compliance_period_facts(v_start,v_end,1,0)->>'total_people')::integer;
 IF v_verified IS NULL OR position('People covered: '||v_verified IN v.body)=0
 THEN RAISE EXCEPTION 'The report count changed. Prepare a new verified summary before sending.' USING ERRCODE='22023'; END IF;
 INSERT INTO public.compliance_report_filings
 (org_id,memo_id,memo_version_id,period_start,period_end,issued_by,issued_at,people_verified)
 VALUES (NEW.org_id,NEW.id,v.id,v_start,v_end,NEW.sender_id,v.sent_at,v_verified)
 ON CONFLICT(memo_version_id) DO NOTHING;
 RETURN NEW;
END $archive$;
REVOKE ALL ON FUNCTION private.archive_compliance_memo() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER archive_compliance_memo AFTER UPDATE OF status ON public.memos
 FOR EACH ROW EXECUTE FUNCTION private.archive_compliance_memo();
