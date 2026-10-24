-- Extend the reviewed reversible archive to confirmed demonstration content.
-- No source row, human decision, private note or classification is changed by DDL.

ALTER TABLE public.operational_archive_events DROP CONSTRAINT operational_archive_events_record_table_check;
ALTER TABLE public.operational_archive_events ADD CONSTRAINT operational_archive_events_record_table_check CHECK(record_table IN ('projects','work_items','report_periods','announcements','learning_courses','asset_items','appraisal_cycles','meeting_sessions','compliance_policy_versions','strategy_nodes'));

CREATE FUNCTION private.content_record_is_live(p_table text,p_row jsonb) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $live$
DECLARE live boolean; BEGIN IF auth.uid() IS NULL OR public.app_org_id() IS NULL THEN RETURN false; END IF; IF p_row ? 'org_id' AND nullif(p_row->>'org_id','')::uuid IS DISTINCT FROM public.app_org_id() THEN RETURN false; END IF; CASE p_table
 WHEN 'announcement_audiences' THEN SELECT NOT EXISTS(SELECT 1 FROM public.announcements p0 WHERE nullif(p_row->>'announcement_id','')::uuid=p0.id AND public.operational_record_is_archived('announcements',p0.id,p0.org_id)) INTO live;
 WHEN 'announcement_receipts' THEN SELECT NOT EXISTS(SELECT 1 FROM public.announcements p0 WHERE nullif(p_row->>'announcement_id','')::uuid=p0.id AND public.operational_record_is_archived('announcements',p0.id,p0.org_id)) INTO live;
 WHEN 'announcements' THEN SELECT NOT public.operational_record_is_archived('announcements',nullif(p_row->>'id','')::uuid,nullif(p_row->>'org_id','')::uuid) INTO live;
 WHEN 'appraisal_cycles' THEN SELECT NOT public.operational_record_is_archived('appraisal_cycles',nullif(p_row->>'id','')::uuid,nullif(p_row->>'org_id','')::uuid) INTO live;
 WHEN 'appraisal_entries' THEN SELECT NOT EXISTS(SELECT 1 FROM public.appraisal_cycles p0 JOIN public.appraisals p1 ON p1.cycle_id=p0.id WHERE nullif(p_row->>'appraisal_id','')::uuid=p1.id AND public.operational_record_is_archived('appraisal_cycles',p0.id,p0.org_id)) INTO live;
 WHEN 'appraisal_evidence_items' THEN SELECT NOT EXISTS(SELECT 1 FROM public.appraisal_cycles p0 JOIN public.appraisals p1 ON p1.cycle_id=p0.id WHERE nullif(p_row->>'appraisal_id','')::uuid=p1.id AND public.operational_record_is_archived('appraisal_cycles',p0.id,p0.org_id)) INTO live;
 WHEN 'appraisal_human_rating_versions' THEN SELECT NOT EXISTS(SELECT 1 FROM public.appraisal_cycles p0 JOIN public.appraisals p1 ON p1.cycle_id=p0.id WHERE nullif(p_row->>'appraisal_id','')::uuid=p1.id AND public.operational_record_is_archived('appraisal_cycles',p0.id,p0.org_id)) AND NOT EXISTS(SELECT 1 FROM public.appraisal_cycles p0 JOIN public.appraisals p1 ON p1.cycle_id=p0.id JOIN public.appraisal_entries p2 ON p2.appraisal_id=p1.id WHERE nullif(p_row->>'assessment_entry_id','')::uuid=p2.id AND public.operational_record_is_archived('appraisal_cycles',p0.id,p0.org_id)) INTO live;
 WHEN 'appraisal_review_exceptions' THEN SELECT NOT EXISTS(SELECT 1 FROM public.appraisal_cycles p0 JOIN public.appraisals p1 ON p1.cycle_id=p0.id WHERE nullif(p_row->>'appraisal_id','')::uuid=p1.id AND public.operational_record_is_archived('appraisal_cycles',p0.id,p0.org_id)) INTO live;
 WHEN 'appraisals' THEN SELECT NOT EXISTS(SELECT 1 FROM public.appraisal_cycles p0 WHERE nullif(p_row->>'cycle_id','')::uuid=p0.id AND public.operational_record_is_archived('appraisal_cycles',p0.id,p0.org_id)) INTO live;
 WHEN 'asset_assignment_events' THEN SELECT NOT EXISTS(SELECT 1 FROM public.asset_items p0 WHERE nullif(p_row->>'asset_id','')::uuid=p0.id AND public.operational_record_is_archived('asset_items',p0.id,p0.org_id)) INTO live;
 WHEN 'asset_items' THEN SELECT NOT public.operational_record_is_archived('asset_items',nullif(p_row->>'id','')::uuid,nullif(p_row->>'org_id','')::uuid) INTO live;
 WHEN 'asset_lifecycle_events' THEN SELECT NOT EXISTS(SELECT 1 FROM public.asset_items p0 WHERE nullif(p_row->>'asset_id','')::uuid=p0.id AND public.operational_record_is_archived('asset_items',p0.id,p0.org_id)) INTO live;
 WHEN 'compliance_acknowledgements' THEN SELECT NOT EXISTS(SELECT 1 FROM public.compliance_policy_versions p0 WHERE nullif(p_row->>'policy_version_id','')::uuid=p0.id AND public.operational_record_is_archived('compliance_policy_versions',p0.id,p0.org_id)) INTO live;
 WHEN 'compliance_evidence_versions' THEN SELECT NOT EXISTS(SELECT 1 FROM public.compliance_policy_versions p0 JOIN public.compliance_requirements p1 ON p1.policy_version_id=p0.id WHERE nullif(p_row->>'requirement_id','')::uuid=p1.id AND public.operational_record_is_archived('compliance_policy_versions',p0.id,p0.org_id)) INTO live;
 WHEN 'compliance_exception_versions' THEN SELECT NOT EXISTS(SELECT 1 FROM public.compliance_policy_versions p0 JOIN public.compliance_requirements p1 ON p1.policy_version_id=p0.id WHERE nullif(p_row->>'requirement_id','')::uuid=p1.id AND public.operational_record_is_archived('compliance_policy_versions',p0.id,p0.org_id)) INTO live;
 WHEN 'compliance_policy_applicability' THEN SELECT NOT EXISTS(SELECT 1 FROM public.compliance_policy_versions p0 WHERE nullif(p_row->>'policy_version_id','')::uuid=p0.id AND public.operational_record_is_archived('compliance_policy_versions',p0.id,p0.org_id)) INTO live;
 WHEN 'compliance_policy_versions' THEN SELECT NOT public.operational_record_is_archived('compliance_policy_versions',nullif(p_row->>'id','')::uuid,nullif(p_row->>'org_id','')::uuid) INTO live;
 WHEN 'compliance_requirements' THEN SELECT NOT EXISTS(SELECT 1 FROM public.compliance_policy_versions p0 WHERE nullif(p_row->>'policy_version_id','')::uuid=p0.id AND public.operational_record_is_archived('compliance_policy_versions',p0.id,p0.org_id)) INTO live;
 WHEN 'delivery_group_projects' THEN SELECT NOT EXISTS(SELECT 1 FROM public.strategy_nodes p0 JOIN public.delivery_groups p1 ON p1.strategy_node_id=p0.id WHERE nullif(p_row->>'delivery_group_id','')::uuid=p1.id AND public.operational_record_is_archived('strategy_nodes',p0.id,p0.org_id)) INTO live;
 WHEN 'delivery_groups' THEN SELECT NOT EXISTS(SELECT 1 FROM public.strategy_nodes p0 WHERE nullif(p_row->>'strategy_node_id','')::uuid=p0.id AND public.operational_record_is_archived('strategy_nodes',p0.id,p0.org_id)) INTO live;
 WHEN 'development_plan_versions' THEN SELECT NOT EXISTS(SELECT 1 FROM public.appraisal_cycles p0 JOIN public.appraisals p1 ON p1.cycle_id=p0.id WHERE nullif(p_row->>'appraisal_id','')::uuid=p1.id AND public.operational_record_is_archived('appraisal_cycles',p0.id,p0.org_id)) INTO live;
 WHEN 'feedback_notes' THEN SELECT NOT EXISTS(SELECT 1 FROM public.strategy_nodes p0 WHERE nullif(p_row->>'strategy_node_id','')::uuid=p0.id AND public.operational_record_is_archived('strategy_nodes',p0.id,p0.org_id)) INTO live;
 WHEN 'feedback_responses' THEN SELECT NOT EXISTS(SELECT 1 FROM public.strategy_nodes p0 JOIN public.feedback_notes p1 ON p1.strategy_node_id=p0.id WHERE nullif(p_row->>'feedback_note_id','')::uuid=p1.id AND public.operational_record_is_archived('strategy_nodes',p0.id,p0.org_id)) INTO live;
 WHEN 'learning_assignment_rules' THEN SELECT NOT EXISTS(SELECT 1 FROM public.learning_courses p0 WHERE nullif(p_row->>'course_id','')::uuid=p0.id AND public.operational_record_is_archived('learning_courses',p0.id,p0.org_id)) INTO live;
 WHEN 'learning_assignments' THEN SELECT NOT EXISTS(SELECT 1 FROM public.learning_courses p0 WHERE nullif(p_row->>'course_id','')::uuid=p0.id AND public.operational_record_is_archived('learning_courses',p0.id,p0.org_id)) AND NOT EXISTS(SELECT 1 FROM public.learning_courses p0 JOIN public.learning_assignment_rules p1 ON p1.course_id=p0.id WHERE nullif(p_row->>'source_rule_id','')::uuid=p1.id AND public.operational_record_is_archived('learning_courses',p0.id,p0.org_id)) INTO live;
 WHEN 'learning_courses' THEN SELECT NOT public.operational_record_is_archived('learning_courses',nullif(p_row->>'id','')::uuid,nullif(p_row->>'org_id','')::uuid) INTO live;
 WHEN 'learning_module_progress' THEN SELECT NOT EXISTS(SELECT 1 FROM public.learning_courses p0 JOIN public.learning_assignments p1 ON p1.course_id=p0.id WHERE nullif(p_row->>'assignment_id','')::uuid=p1.id AND public.operational_record_is_archived('learning_courses',p0.id,p0.org_id)) AND NOT EXISTS(SELECT 1 FROM public.learning_courses p0 JOIN public.learning_modules p1 ON p1.course_id=p0.id WHERE nullif(p_row->>'module_id','')::uuid=p1.id AND public.operational_record_is_archived('learning_courses',p0.id,p0.org_id)) AND NOT EXISTS(SELECT 1 FROM public.learning_courses p0 JOIN public.learning_assignment_rules p1 ON p1.course_id=p0.id JOIN public.learning_assignments p2 ON p2.source_rule_id=p1.id WHERE nullif(p_row->>'assignment_id','')::uuid=p2.id AND public.operational_record_is_archived('learning_courses',p0.id,p0.org_id)) INTO live;
 WHEN 'learning_modules' THEN SELECT NOT EXISTS(SELECT 1 FROM public.learning_courses p0 WHERE nullif(p_row->>'course_id','')::uuid=p0.id AND public.operational_record_is_archived('learning_courses',p0.id,p0.org_id)) INTO live;
 WHEN 'learning_progress_history' THEN SELECT NOT EXISTS(SELECT 1 FROM public.learning_courses p0 JOIN public.learning_assignments p1 ON p1.course_id=p0.id WHERE nullif(p_row->>'assignment_id','')::uuid=p1.id AND public.operational_record_is_archived('learning_courses',p0.id,p0.org_id)) AND NOT EXISTS(SELECT 1 FROM public.learning_courses p0 JOIN public.learning_modules p1 ON p1.course_id=p0.id WHERE nullif(p_row->>'module_id','')::uuid=p1.id AND public.operational_record_is_archived('learning_courses',p0.id,p0.org_id)) AND NOT EXISTS(SELECT 1 FROM public.learning_courses p0 JOIN public.learning_assignment_rules p1 ON p1.course_id=p0.id JOIN public.learning_assignments p2 ON p2.source_rule_id=p1.id WHERE nullif(p_row->>'assignment_id','')::uuid=p2.id AND public.operational_record_is_archived('learning_courses',p0.id,p0.org_id)) INTO live;
 WHEN 'learning_resources' THEN SELECT NOT EXISTS(SELECT 1 FROM public.learning_courses p0 JOIN public.learning_modules p1 ON p1.course_id=p0.id WHERE nullif(p_row->>'module_id','')::uuid=p1.id AND public.operational_record_is_archived('learning_courses',p0.id,p0.org_id)) INTO live;
 WHEN 'meeting_participants' THEN SELECT NOT EXISTS(SELECT 1 FROM public.meeting_sessions p0 WHERE nullif(p_row->>'meeting_id','')::uuid=p0.id AND public.operational_record_is_archived('meeting_sessions',p0.id,p0.org_id)) INTO live;
 WHEN 'meeting_private_notes' THEN SELECT NOT EXISTS(SELECT 1 FROM public.meeting_sessions p0 WHERE nullif(p_row->>'meeting_id','')::uuid=p0.id AND public.operational_record_is_archived('meeting_sessions',p0.id,p0.org_id)) INTO live;
 WHEN 'meeting_records' THEN SELECT NOT EXISTS(SELECT 1 FROM public.meeting_sessions p0 WHERE nullif(p_row->>'meeting_id','')::uuid=p0.id AND public.operational_record_is_archived('meeting_sessions',p0.id,p0.org_id)) INTO live;
 WHEN 'meeting_sessions' THEN SELECT NOT public.operational_record_is_archived('meeting_sessions',nullif(p_row->>'id','')::uuid,nullif(p_row->>'org_id','')::uuid) INTO live;
 WHEN 'meeting_work_links' THEN SELECT NOT EXISTS(SELECT 1 FROM public.meeting_sessions p0 WHERE nullif(p_row->>'meeting_id','')::uuid=p0.id AND public.operational_record_is_archived('meeting_sessions',p0.id,p0.org_id)) INTO live;
 WHEN 'performance_review_release_requests' THEN SELECT NOT EXISTS(SELECT 1 FROM public.appraisal_cycles p0 JOIN public.appraisals p1 ON p1.cycle_id=p0.id WHERE nullif(p_row->>'appraisal_id','')::uuid=p1.id AND public.operational_record_is_archived('appraisal_cycles',p0.id,p0.org_id)) AND NOT EXISTS(SELECT 1 FROM public.appraisal_cycles p0 JOIN public.appraisals p1 ON p1.cycle_id=p0.id JOIN public.appraisal_entries p2 ON p2.appraisal_id=p1.id WHERE nullif(p_row->>'requested_assessment_id','')::uuid=p2.id AND public.operational_record_is_archived('appraisal_cycles',p0.id,p0.org_id)) INTO live;
 WHEN 'strategy_delivery_links' THEN SELECT NOT EXISTS(SELECT 1 FROM public.strategy_nodes p0 WHERE nullif(p_row->>'strategy_node_id','')::uuid=p0.id AND public.operational_record_is_archived('strategy_nodes',p0.id,p0.org_id)) INTO live;
 WHEN 'strategy_node_revisions' THEN SELECT NOT EXISTS(SELECT 1 FROM public.strategy_nodes p0 WHERE nullif(p_row->>'strategy_node_id','')::uuid=p0.id AND public.operational_record_is_archived('strategy_nodes',p0.id,p0.org_id)) INTO live;
 WHEN 'strategy_nodes' THEN SELECT NOT public.operational_record_is_archived('strategy_nodes',nullif(p_row->>'id','')::uuid,nullif(p_row->>'org_id','')::uuid) INTO live;
 WHEN 'training_records' THEN SELECT NOT EXISTS(SELECT 1 FROM public.learning_courses p0 JOIN public.learning_assignments p1 ON p1.course_id=p0.id WHERE nullif(p_row->>'learning_assignment_id','')::uuid=p1.id AND public.operational_record_is_archived('learning_courses',p0.id,p0.org_id)) AND NOT EXISTS(SELECT 1 FROM public.learning_courses p0 JOIN public.learning_assignment_rules p1 ON p1.course_id=p0.id JOIN public.learning_assignments p2 ON p2.source_rule_id=p1.id WHERE nullif(p_row->>'learning_assignment_id','')::uuid=p2.id AND public.operational_record_is_archived('learning_courses',p0.id,p0.org_id)) INTO live;
 ELSE RETURN false; END CASE; RETURN coalesce(live,false); END;
$live$;
REVOKE ALL ON FUNCTION private.content_record_is_live(text,jsonb) FROM public,anon,service_role;
GRANT EXECUTE ON FUNCTION private.content_record_is_live(text,jsonb) TO authenticated;

CREATE POLICY content_archive_live ON public.announcement_audiences AS RESTRICTIVE FOR SELECT TO authenticated USING(private.content_record_is_live('announcement_audiences',to_jsonb(announcement_audiences)));
CREATE VIEW private.content_live_announcement_audiences WITH(security_invoker=true) AS SELECT t.* FROM public.announcement_audiences t WHERE NOT EXISTS(SELECT 1 FROM public.announcements p0 WHERE t.announcement_id=p0.id AND public.operational_record_is_archived('announcements',p0.id,p0.org_id));
REVOKE ALL ON private.content_live_announcement_audiences FROM public,anon,authenticated,service_role;

CREATE POLICY content_archive_live ON public.announcement_receipts AS RESTRICTIVE FOR SELECT TO authenticated USING(private.content_record_is_live('announcement_receipts',to_jsonb(announcement_receipts)));
CREATE VIEW private.content_live_announcement_receipts WITH(security_invoker=true) AS SELECT t.* FROM public.announcement_receipts t WHERE NOT EXISTS(SELECT 1 FROM public.announcements p0 WHERE t.announcement_id=p0.id AND public.operational_record_is_archived('announcements',p0.id,p0.org_id));
REVOKE ALL ON private.content_live_announcement_receipts FROM public,anon,authenticated,service_role;

CREATE POLICY content_archive_live ON public.announcements AS RESTRICTIVE FOR SELECT TO authenticated USING(private.content_record_is_live('announcements',to_jsonb(announcements)));
CREATE VIEW private.content_live_announcements WITH(security_invoker=true) AS SELECT t.* FROM public.announcements t WHERE NOT public.operational_record_is_archived('announcements',t.id,t.org_id);
REVOKE ALL ON private.content_live_announcements FROM public,anon,authenticated,service_role;

CREATE POLICY content_archive_live ON public.appraisal_cycles AS RESTRICTIVE FOR SELECT TO authenticated USING(private.content_record_is_live('appraisal_cycles',to_jsonb(appraisal_cycles)));
CREATE VIEW private.content_live_appraisal_cycles WITH(security_invoker=true) AS SELECT t.* FROM public.appraisal_cycles t WHERE NOT public.operational_record_is_archived('appraisal_cycles',t.id,t.org_id);
REVOKE ALL ON private.content_live_appraisal_cycles FROM public,anon,authenticated,service_role;

CREATE POLICY content_archive_live ON public.appraisal_entries AS RESTRICTIVE FOR SELECT TO authenticated USING(private.content_record_is_live('appraisal_entries',to_jsonb(appraisal_entries)));
CREATE VIEW private.content_live_appraisal_entries WITH(security_invoker=true) AS SELECT t.* FROM public.appraisal_entries t WHERE NOT EXISTS(SELECT 1 FROM public.appraisal_cycles p0 JOIN public.appraisals p1 ON p1.cycle_id=p0.id WHERE t.appraisal_id=p1.id AND public.operational_record_is_archived('appraisal_cycles',p0.id,p0.org_id));
REVOKE ALL ON private.content_live_appraisal_entries FROM public,anon,authenticated,service_role;

CREATE POLICY content_archive_live ON public.appraisal_evidence_items AS RESTRICTIVE FOR SELECT TO authenticated USING(private.content_record_is_live('appraisal_evidence_items',to_jsonb(appraisal_evidence_items)));
CREATE VIEW private.content_live_appraisal_evidence_items WITH(security_invoker=true) AS SELECT t.* FROM public.appraisal_evidence_items t WHERE NOT EXISTS(SELECT 1 FROM public.appraisal_cycles p0 JOIN public.appraisals p1 ON p1.cycle_id=p0.id WHERE t.appraisal_id=p1.id AND public.operational_record_is_archived('appraisal_cycles',p0.id,p0.org_id));
REVOKE ALL ON private.content_live_appraisal_evidence_items FROM public,anon,authenticated,service_role;

CREATE POLICY content_archive_live ON public.appraisal_human_rating_versions AS RESTRICTIVE FOR SELECT TO authenticated USING(private.content_record_is_live('appraisal_human_rating_versions',to_jsonb(appraisal_human_rating_versions)));
CREATE VIEW private.content_live_appraisal_human_rating_versions WITH(security_invoker=true) AS SELECT t.* FROM public.appraisal_human_rating_versions t WHERE NOT EXISTS(SELECT 1 FROM public.appraisal_cycles p0 JOIN public.appraisals p1 ON p1.cycle_id=p0.id WHERE t.appraisal_id=p1.id AND public.operational_record_is_archived('appraisal_cycles',p0.id,p0.org_id)) AND NOT EXISTS(SELECT 1 FROM public.appraisal_cycles p0 JOIN public.appraisals p1 ON p1.cycle_id=p0.id JOIN public.appraisal_entries p2 ON p2.appraisal_id=p1.id WHERE t.assessment_entry_id=p2.id AND public.operational_record_is_archived('appraisal_cycles',p0.id,p0.org_id));
REVOKE ALL ON private.content_live_appraisal_human_rating_versions FROM public,anon,authenticated,service_role;

CREATE POLICY content_archive_live ON public.appraisal_review_exceptions AS RESTRICTIVE FOR SELECT TO authenticated USING(private.content_record_is_live('appraisal_review_exceptions',to_jsonb(appraisal_review_exceptions)));
CREATE VIEW private.content_live_appraisal_review_exceptions WITH(security_invoker=true) AS SELECT t.* FROM public.appraisal_review_exceptions t WHERE NOT EXISTS(SELECT 1 FROM public.appraisal_cycles p0 JOIN public.appraisals p1 ON p1.cycle_id=p0.id WHERE t.appraisal_id=p1.id AND public.operational_record_is_archived('appraisal_cycles',p0.id,p0.org_id));
REVOKE ALL ON private.content_live_appraisal_review_exceptions FROM public,anon,authenticated,service_role;

CREATE POLICY content_archive_live ON public.appraisals AS RESTRICTIVE FOR SELECT TO authenticated USING(private.content_record_is_live('appraisals',to_jsonb(appraisals)));
CREATE VIEW private.content_live_appraisals WITH(security_invoker=true) AS SELECT t.* FROM public.appraisals t WHERE NOT EXISTS(SELECT 1 FROM public.appraisal_cycles p0 WHERE t.cycle_id=p0.id AND public.operational_record_is_archived('appraisal_cycles',p0.id,p0.org_id));
REVOKE ALL ON private.content_live_appraisals FROM public,anon,authenticated,service_role;

CREATE POLICY content_archive_live ON public.asset_assignment_events AS RESTRICTIVE FOR SELECT TO authenticated USING(private.content_record_is_live('asset_assignment_events',to_jsonb(asset_assignment_events)));
CREATE VIEW private.content_live_asset_assignment_events WITH(security_invoker=true) AS SELECT t.* FROM public.asset_assignment_events t WHERE NOT EXISTS(SELECT 1 FROM public.asset_items p0 WHERE t.asset_id=p0.id AND public.operational_record_is_archived('asset_items',p0.id,p0.org_id));
REVOKE ALL ON private.content_live_asset_assignment_events FROM public,anon,authenticated,service_role;

CREATE POLICY content_archive_live ON public.asset_items AS RESTRICTIVE FOR SELECT TO authenticated USING(private.content_record_is_live('asset_items',to_jsonb(asset_items)));
CREATE VIEW private.content_live_asset_items WITH(security_invoker=true) AS SELECT t.* FROM public.asset_items t WHERE NOT public.operational_record_is_archived('asset_items',t.id,t.org_id);
REVOKE ALL ON private.content_live_asset_items FROM public,anon,authenticated,service_role;

CREATE POLICY content_archive_live ON public.asset_lifecycle_events AS RESTRICTIVE FOR SELECT TO authenticated USING(private.content_record_is_live('asset_lifecycle_events',to_jsonb(asset_lifecycle_events)));
CREATE VIEW private.content_live_asset_lifecycle_events WITH(security_invoker=true) AS SELECT t.* FROM public.asset_lifecycle_events t WHERE NOT EXISTS(SELECT 1 FROM public.asset_items p0 WHERE t.asset_id=p0.id AND public.operational_record_is_archived('asset_items',p0.id,p0.org_id));
REVOKE ALL ON private.content_live_asset_lifecycle_events FROM public,anon,authenticated,service_role;

CREATE POLICY content_archive_live ON public.compliance_acknowledgements AS RESTRICTIVE FOR SELECT TO authenticated USING(private.content_record_is_live('compliance_acknowledgements',to_jsonb(compliance_acknowledgements)));
CREATE VIEW private.content_live_compliance_acknowledgements WITH(security_invoker=true) AS SELECT t.* FROM public.compliance_acknowledgements t WHERE NOT EXISTS(SELECT 1 FROM public.compliance_policy_versions p0 WHERE t.policy_version_id=p0.id AND public.operational_record_is_archived('compliance_policy_versions',p0.id,p0.org_id));
REVOKE ALL ON private.content_live_compliance_acknowledgements FROM public,anon,authenticated,service_role;

CREATE POLICY content_archive_live ON public.compliance_evidence_versions AS RESTRICTIVE FOR SELECT TO authenticated USING(private.content_record_is_live('compliance_evidence_versions',to_jsonb(compliance_evidence_versions)));
CREATE VIEW private.content_live_compliance_evidence_versions WITH(security_invoker=true) AS SELECT t.* FROM public.compliance_evidence_versions t WHERE NOT EXISTS(SELECT 1 FROM public.compliance_policy_versions p0 JOIN public.compliance_requirements p1 ON p1.policy_version_id=p0.id WHERE t.requirement_id=p1.id AND public.operational_record_is_archived('compliance_policy_versions',p0.id,p0.org_id));
REVOKE ALL ON private.content_live_compliance_evidence_versions FROM public,anon,authenticated,service_role;

CREATE POLICY content_archive_live ON public.compliance_exception_versions AS RESTRICTIVE FOR SELECT TO authenticated USING(private.content_record_is_live('compliance_exception_versions',to_jsonb(compliance_exception_versions)));
CREATE VIEW private.content_live_compliance_exception_versions WITH(security_invoker=true) AS SELECT t.* FROM public.compliance_exception_versions t WHERE NOT EXISTS(SELECT 1 FROM public.compliance_policy_versions p0 JOIN public.compliance_requirements p1 ON p1.policy_version_id=p0.id WHERE t.requirement_id=p1.id AND public.operational_record_is_archived('compliance_policy_versions',p0.id,p0.org_id));
REVOKE ALL ON private.content_live_compliance_exception_versions FROM public,anon,authenticated,service_role;

CREATE POLICY content_archive_live ON public.compliance_policy_applicability AS RESTRICTIVE FOR SELECT TO authenticated USING(private.content_record_is_live('compliance_policy_applicability',to_jsonb(compliance_policy_applicability)));
CREATE VIEW private.content_live_compliance_policy_applicability WITH(security_invoker=true) AS SELECT t.* FROM public.compliance_policy_applicability t WHERE NOT EXISTS(SELECT 1 FROM public.compliance_policy_versions p0 WHERE t.policy_version_id=p0.id AND public.operational_record_is_archived('compliance_policy_versions',p0.id,p0.org_id));
REVOKE ALL ON private.content_live_compliance_policy_applicability FROM public,anon,authenticated,service_role;

CREATE POLICY content_archive_live ON public.compliance_policy_versions AS RESTRICTIVE FOR SELECT TO authenticated USING(private.content_record_is_live('compliance_policy_versions',to_jsonb(compliance_policy_versions)));
CREATE VIEW private.content_live_compliance_policy_versions WITH(security_invoker=true) AS SELECT t.* FROM public.compliance_policy_versions t WHERE NOT public.operational_record_is_archived('compliance_policy_versions',t.id,t.org_id);
REVOKE ALL ON private.content_live_compliance_policy_versions FROM public,anon,authenticated,service_role;

CREATE POLICY content_archive_live ON public.compliance_requirements AS RESTRICTIVE FOR SELECT TO authenticated USING(private.content_record_is_live('compliance_requirements',to_jsonb(compliance_requirements)));
CREATE VIEW private.content_live_compliance_requirements WITH(security_invoker=true) AS SELECT t.* FROM public.compliance_requirements t WHERE NOT EXISTS(SELECT 1 FROM public.compliance_policy_versions p0 WHERE t.policy_version_id=p0.id AND public.operational_record_is_archived('compliance_policy_versions',p0.id,p0.org_id));
REVOKE ALL ON private.content_live_compliance_requirements FROM public,anon,authenticated,service_role;

CREATE POLICY content_archive_live ON public.delivery_group_projects AS RESTRICTIVE FOR SELECT TO authenticated USING(private.content_record_is_live('delivery_group_projects',to_jsonb(delivery_group_projects)));
CREATE VIEW private.content_live_delivery_group_projects WITH(security_invoker=true) AS SELECT t.* FROM public.delivery_group_projects t WHERE NOT EXISTS(SELECT 1 FROM public.strategy_nodes p0 JOIN public.delivery_groups p1 ON p1.strategy_node_id=p0.id WHERE t.delivery_group_id=p1.id AND public.operational_record_is_archived('strategy_nodes',p0.id,p0.org_id));
REVOKE ALL ON private.content_live_delivery_group_projects FROM public,anon,authenticated,service_role;

CREATE POLICY content_archive_live ON public.delivery_groups AS RESTRICTIVE FOR SELECT TO authenticated USING(private.content_record_is_live('delivery_groups',to_jsonb(delivery_groups)));
CREATE VIEW private.content_live_delivery_groups WITH(security_invoker=true) AS SELECT t.* FROM public.delivery_groups t WHERE NOT EXISTS(SELECT 1 FROM public.strategy_nodes p0 WHERE t.strategy_node_id=p0.id AND public.operational_record_is_archived('strategy_nodes',p0.id,p0.org_id));
REVOKE ALL ON private.content_live_delivery_groups FROM public,anon,authenticated,service_role;

CREATE POLICY content_archive_live ON public.development_plan_versions AS RESTRICTIVE FOR SELECT TO authenticated USING(private.content_record_is_live('development_plan_versions',to_jsonb(development_plan_versions)));
CREATE VIEW private.content_live_development_plan_versions WITH(security_invoker=true) AS SELECT t.* FROM public.development_plan_versions t WHERE NOT EXISTS(SELECT 1 FROM public.appraisal_cycles p0 JOIN public.appraisals p1 ON p1.cycle_id=p0.id WHERE t.appraisal_id=p1.id AND public.operational_record_is_archived('appraisal_cycles',p0.id,p0.org_id));
REVOKE ALL ON private.content_live_development_plan_versions FROM public,anon,authenticated,service_role;

CREATE POLICY content_archive_live ON public.feedback_notes AS RESTRICTIVE FOR SELECT TO authenticated USING(private.content_record_is_live('feedback_notes',to_jsonb(feedback_notes)));
CREATE VIEW private.content_live_feedback_notes WITH(security_invoker=true) AS SELECT t.* FROM public.feedback_notes t WHERE NOT EXISTS(SELECT 1 FROM public.strategy_nodes p0 WHERE t.strategy_node_id=p0.id AND public.operational_record_is_archived('strategy_nodes',p0.id,p0.org_id));
REVOKE ALL ON private.content_live_feedback_notes FROM public,anon,authenticated,service_role;

CREATE POLICY content_archive_live ON public.feedback_responses AS RESTRICTIVE FOR SELECT TO authenticated USING(private.content_record_is_live('feedback_responses',to_jsonb(feedback_responses)));
CREATE VIEW private.content_live_feedback_responses WITH(security_invoker=true) AS SELECT t.* FROM public.feedback_responses t WHERE NOT EXISTS(SELECT 1 FROM public.strategy_nodes p0 JOIN public.feedback_notes p1 ON p1.strategy_node_id=p0.id WHERE t.feedback_note_id=p1.id AND public.operational_record_is_archived('strategy_nodes',p0.id,p0.org_id));
REVOKE ALL ON private.content_live_feedback_responses FROM public,anon,authenticated,service_role;

CREATE POLICY content_archive_live ON public.learning_assignment_rules AS RESTRICTIVE FOR SELECT TO authenticated USING(private.content_record_is_live('learning_assignment_rules',to_jsonb(learning_assignment_rules)));
CREATE VIEW private.content_live_learning_assignment_rules WITH(security_invoker=true) AS SELECT t.* FROM public.learning_assignment_rules t WHERE NOT EXISTS(SELECT 1 FROM public.learning_courses p0 WHERE t.course_id=p0.id AND public.operational_record_is_archived('learning_courses',p0.id,p0.org_id));
REVOKE ALL ON private.content_live_learning_assignment_rules FROM public,anon,authenticated,service_role;

CREATE POLICY content_archive_live ON public.learning_assignments AS RESTRICTIVE FOR SELECT TO authenticated USING(private.content_record_is_live('learning_assignments',to_jsonb(learning_assignments)));
CREATE VIEW private.content_live_learning_assignments WITH(security_invoker=true) AS SELECT t.* FROM public.learning_assignments t WHERE NOT EXISTS(SELECT 1 FROM public.learning_courses p0 WHERE t.course_id=p0.id AND public.operational_record_is_archived('learning_courses',p0.id,p0.org_id)) AND NOT EXISTS(SELECT 1 FROM public.learning_courses p0 JOIN public.learning_assignment_rules p1 ON p1.course_id=p0.id WHERE t.source_rule_id=p1.id AND public.operational_record_is_archived('learning_courses',p0.id,p0.org_id));
REVOKE ALL ON private.content_live_learning_assignments FROM public,anon,authenticated,service_role;

CREATE POLICY content_archive_live ON public.learning_courses AS RESTRICTIVE FOR SELECT TO authenticated USING(private.content_record_is_live('learning_courses',to_jsonb(learning_courses)));
CREATE VIEW private.content_live_learning_courses WITH(security_invoker=true) AS SELECT t.* FROM public.learning_courses t WHERE NOT public.operational_record_is_archived('learning_courses',t.id,t.org_id);
REVOKE ALL ON private.content_live_learning_courses FROM public,anon,authenticated,service_role;

CREATE POLICY content_archive_live ON public.learning_module_progress AS RESTRICTIVE FOR SELECT TO authenticated USING(private.content_record_is_live('learning_module_progress',to_jsonb(learning_module_progress)));
CREATE VIEW private.content_live_learning_module_progress WITH(security_invoker=true) AS SELECT t.* FROM public.learning_module_progress t WHERE NOT EXISTS(SELECT 1 FROM public.learning_courses p0 JOIN public.learning_assignments p1 ON p1.course_id=p0.id WHERE t.assignment_id=p1.id AND public.operational_record_is_archived('learning_courses',p0.id,p0.org_id)) AND NOT EXISTS(SELECT 1 FROM public.learning_courses p0 JOIN public.learning_modules p1 ON p1.course_id=p0.id WHERE t.module_id=p1.id AND public.operational_record_is_archived('learning_courses',p0.id,p0.org_id)) AND NOT EXISTS(SELECT 1 FROM public.learning_courses p0 JOIN public.learning_assignment_rules p1 ON p1.course_id=p0.id JOIN public.learning_assignments p2 ON p2.source_rule_id=p1.id WHERE t.assignment_id=p2.id AND public.operational_record_is_archived('learning_courses',p0.id,p0.org_id));
REVOKE ALL ON private.content_live_learning_module_progress FROM public,anon,authenticated,service_role;

CREATE POLICY content_archive_live ON public.learning_modules AS RESTRICTIVE FOR SELECT TO authenticated USING(private.content_record_is_live('learning_modules',to_jsonb(learning_modules)));
CREATE VIEW private.content_live_learning_modules WITH(security_invoker=true) AS SELECT t.* FROM public.learning_modules t WHERE NOT EXISTS(SELECT 1 FROM public.learning_courses p0 WHERE t.course_id=p0.id AND public.operational_record_is_archived('learning_courses',p0.id,p0.org_id));
REVOKE ALL ON private.content_live_learning_modules FROM public,anon,authenticated,service_role;

CREATE POLICY content_archive_live ON public.learning_progress_history AS RESTRICTIVE FOR SELECT TO authenticated USING(private.content_record_is_live('learning_progress_history',to_jsonb(learning_progress_history)));
CREATE VIEW private.content_live_learning_progress_history WITH(security_invoker=true) AS SELECT t.* FROM public.learning_progress_history t WHERE NOT EXISTS(SELECT 1 FROM public.learning_courses p0 JOIN public.learning_assignments p1 ON p1.course_id=p0.id WHERE t.assignment_id=p1.id AND public.operational_record_is_archived('learning_courses',p0.id,p0.org_id)) AND NOT EXISTS(SELECT 1 FROM public.learning_courses p0 JOIN public.learning_modules p1 ON p1.course_id=p0.id WHERE t.module_id=p1.id AND public.operational_record_is_archived('learning_courses',p0.id,p0.org_id)) AND NOT EXISTS(SELECT 1 FROM public.learning_courses p0 JOIN public.learning_assignment_rules p1 ON p1.course_id=p0.id JOIN public.learning_assignments p2 ON p2.source_rule_id=p1.id WHERE t.assignment_id=p2.id AND public.operational_record_is_archived('learning_courses',p0.id,p0.org_id));
REVOKE ALL ON private.content_live_learning_progress_history FROM public,anon,authenticated,service_role;

CREATE POLICY content_archive_live ON public.learning_resources AS RESTRICTIVE FOR SELECT TO authenticated USING(private.content_record_is_live('learning_resources',to_jsonb(learning_resources)));
CREATE VIEW private.content_live_learning_resources WITH(security_invoker=true) AS SELECT t.* FROM public.learning_resources t WHERE NOT EXISTS(SELECT 1 FROM public.learning_courses p0 JOIN public.learning_modules p1 ON p1.course_id=p0.id WHERE t.module_id=p1.id AND public.operational_record_is_archived('learning_courses',p0.id,p0.org_id));
REVOKE ALL ON private.content_live_learning_resources FROM public,anon,authenticated,service_role;

CREATE POLICY content_archive_live ON public.meeting_participants AS RESTRICTIVE FOR SELECT TO authenticated USING(private.content_record_is_live('meeting_participants',to_jsonb(meeting_participants)));
CREATE VIEW private.content_live_meeting_participants WITH(security_invoker=true) AS SELECT t.* FROM public.meeting_participants t WHERE NOT EXISTS(SELECT 1 FROM public.meeting_sessions p0 WHERE t.meeting_id=p0.id AND public.operational_record_is_archived('meeting_sessions',p0.id,p0.org_id));
REVOKE ALL ON private.content_live_meeting_participants FROM public,anon,authenticated,service_role;

CREATE POLICY content_archive_live ON public.meeting_private_notes AS RESTRICTIVE FOR SELECT TO authenticated USING(private.content_record_is_live('meeting_private_notes',to_jsonb(meeting_private_notes)));
CREATE VIEW private.content_live_meeting_private_notes WITH(security_invoker=true) AS SELECT t.* FROM public.meeting_private_notes t WHERE NOT EXISTS(SELECT 1 FROM public.meeting_sessions p0 WHERE t.meeting_id=p0.id AND public.operational_record_is_archived('meeting_sessions',p0.id,p0.org_id));
REVOKE ALL ON private.content_live_meeting_private_notes FROM public,anon,authenticated,service_role;

CREATE POLICY content_archive_live ON public.meeting_records AS RESTRICTIVE FOR SELECT TO authenticated USING(private.content_record_is_live('meeting_records',to_jsonb(meeting_records)));
CREATE VIEW private.content_live_meeting_records WITH(security_invoker=true) AS SELECT t.* FROM public.meeting_records t WHERE NOT EXISTS(SELECT 1 FROM public.meeting_sessions p0 WHERE t.meeting_id=p0.id AND public.operational_record_is_archived('meeting_sessions',p0.id,p0.org_id));
REVOKE ALL ON private.content_live_meeting_records FROM public,anon,authenticated,service_role;

CREATE POLICY content_archive_live ON public.meeting_sessions AS RESTRICTIVE FOR SELECT TO authenticated USING(private.content_record_is_live('meeting_sessions',to_jsonb(meeting_sessions)));
CREATE VIEW private.content_live_meeting_sessions WITH(security_invoker=true) AS SELECT t.* FROM public.meeting_sessions t WHERE NOT public.operational_record_is_archived('meeting_sessions',t.id,t.org_id);
REVOKE ALL ON private.content_live_meeting_sessions FROM public,anon,authenticated,service_role;

CREATE POLICY content_archive_live ON public.meeting_work_links AS RESTRICTIVE FOR SELECT TO authenticated USING(private.content_record_is_live('meeting_work_links',to_jsonb(meeting_work_links)));
CREATE VIEW private.content_live_meeting_work_links WITH(security_invoker=true) AS SELECT t.* FROM public.meeting_work_links t WHERE NOT EXISTS(SELECT 1 FROM public.meeting_sessions p0 WHERE t.meeting_id=p0.id AND public.operational_record_is_archived('meeting_sessions',p0.id,p0.org_id));
REVOKE ALL ON private.content_live_meeting_work_links FROM public,anon,authenticated,service_role;

CREATE POLICY content_archive_live ON public.performance_review_release_requests AS RESTRICTIVE FOR SELECT TO authenticated USING(private.content_record_is_live('performance_review_release_requests',to_jsonb(performance_review_release_requests)));
CREATE VIEW private.content_live_performance_review_release_requests WITH(security_invoker=true) AS SELECT t.* FROM public.performance_review_release_requests t WHERE NOT EXISTS(SELECT 1 FROM public.appraisal_cycles p0 JOIN public.appraisals p1 ON p1.cycle_id=p0.id WHERE t.appraisal_id=p1.id AND public.operational_record_is_archived('appraisal_cycles',p0.id,p0.org_id)) AND NOT EXISTS(SELECT 1 FROM public.appraisal_cycles p0 JOIN public.appraisals p1 ON p1.cycle_id=p0.id JOIN public.appraisal_entries p2 ON p2.appraisal_id=p1.id WHERE t.requested_assessment_id=p2.id AND public.operational_record_is_archived('appraisal_cycles',p0.id,p0.org_id));
REVOKE ALL ON private.content_live_performance_review_release_requests FROM public,anon,authenticated,service_role;

CREATE POLICY content_archive_live ON public.strategy_delivery_links AS RESTRICTIVE FOR SELECT TO authenticated USING(private.content_record_is_live('strategy_delivery_links',to_jsonb(strategy_delivery_links)));
CREATE VIEW private.content_live_strategy_delivery_links WITH(security_invoker=true) AS SELECT t.* FROM public.strategy_delivery_links t WHERE NOT EXISTS(SELECT 1 FROM public.strategy_nodes p0 WHERE t.strategy_node_id=p0.id AND public.operational_record_is_archived('strategy_nodes',p0.id,p0.org_id));
REVOKE ALL ON private.content_live_strategy_delivery_links FROM public,anon,authenticated,service_role;

CREATE POLICY content_archive_live ON public.strategy_node_revisions AS RESTRICTIVE FOR SELECT TO authenticated USING(private.content_record_is_live('strategy_node_revisions',to_jsonb(strategy_node_revisions)));
CREATE VIEW private.content_live_strategy_node_revisions WITH(security_invoker=true) AS SELECT t.* FROM public.strategy_node_revisions t WHERE NOT EXISTS(SELECT 1 FROM public.strategy_nodes p0 WHERE t.strategy_node_id=p0.id AND public.operational_record_is_archived('strategy_nodes',p0.id,p0.org_id));
REVOKE ALL ON private.content_live_strategy_node_revisions FROM public,anon,authenticated,service_role;

CREATE POLICY content_archive_live ON public.strategy_nodes AS RESTRICTIVE FOR SELECT TO authenticated USING(private.content_record_is_live('strategy_nodes',to_jsonb(strategy_nodes)));
CREATE VIEW private.content_live_strategy_nodes WITH(security_invoker=true) AS SELECT t.* FROM public.strategy_nodes t WHERE NOT public.operational_record_is_archived('strategy_nodes',t.id,t.org_id);
REVOKE ALL ON private.content_live_strategy_nodes FROM public,anon,authenticated,service_role;

CREATE POLICY content_archive_live ON public.training_records AS RESTRICTIVE FOR SELECT TO authenticated USING(private.content_record_is_live('training_records',to_jsonb(training_records)));
CREATE VIEW private.content_live_training_records WITH(security_invoker=true) AS SELECT t.* FROM public.training_records t WHERE NOT EXISTS(SELECT 1 FROM public.learning_courses p0 JOIN public.learning_assignments p1 ON p1.course_id=p0.id WHERE t.learning_assignment_id=p1.id AND public.operational_record_is_archived('learning_courses',p0.id,p0.org_id)) AND NOT EXISTS(SELECT 1 FROM public.learning_courses p0 JOIN public.learning_assignment_rules p1 ON p1.course_id=p0.id JOIN public.learning_assignments p2 ON p2.source_rule_id=p1.id WHERE t.learning_assignment_id=p2.id AND public.operational_record_is_archived('learning_courses',p0.id,p0.org_id));
REVOKE ALL ON private.content_live_training_records FROM public,anon,authenticated,service_role;

CREATE OR REPLACE VIEW private.operational_live_feedback_notes WITH(security_invoker=true) AS SELECT f.* FROM public.feedback_notes f WHERE NOT public.operational_record_is_archived('projects',f.project_id,f.org_id) AND NOT public.operational_record_is_archived('work_items',f.work_item_id,f.org_id) AND NOT public.operational_record_is_archived('strategy_nodes',f.strategy_node_id,f.org_id);

CREATE FUNCTION private.content_archive_fingerprint(p_table text,p_id uuid,p_org uuid) RETURNS text LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $hash$
DECLARE result text; BEGIN CASE p_table
 WHEN 'announcements' THEN SELECT md5(coalesce(string_agg(kind||id::text||digest,'' ORDER BY kind,id),'')) INTO result FROM (SELECT 'announcement_audiences' kind,md5(to_jsonb(t)::text) id,md5(to_jsonb(t)::text) digest FROM public.announcement_audiences t WHERE EXISTS(SELECT 1 FROM public.announcements p0 WHERE t.announcement_id=p0.id AND p0.id=p_id AND p0.org_id=p_org) UNION ALL SELECT 'announcement_receipts' kind,md5(to_jsonb(t)::text) id,md5(to_jsonb(t)::text) digest FROM public.announcement_receipts t WHERE EXISTS(SELECT 1 FROM public.announcements p0 WHERE t.announcement_id=p0.id AND p0.id=p_id AND p0.org_id=p_org) UNION ALL SELECT 'announcements' kind,md5(to_jsonb(t)::text) id,md5(to_jsonb(t)::text) digest FROM public.announcements t WHERE t.id=p_id AND t.org_id=p_org) snapshot;
 WHEN 'learning_courses' THEN SELECT md5(coalesce(string_agg(kind||id::text||digest,'' ORDER BY kind,id),'')) INTO result FROM (SELECT 'learning_assignment_rules' kind,md5(to_jsonb(t)::text) id,md5(to_jsonb(t)::text) digest FROM public.learning_assignment_rules t WHERE EXISTS(SELECT 1 FROM public.learning_courses p0 WHERE t.course_id=p0.id AND p0.id=p_id AND p0.org_id=p_org) UNION ALL SELECT 'learning_assignments' kind,md5(to_jsonb(t)::text) id,md5(to_jsonb(t)::text) digest FROM public.learning_assignments t WHERE EXISTS(SELECT 1 FROM public.learning_courses p0 WHERE t.course_id=p0.id AND p0.id=p_id AND p0.org_id=p_org) OR EXISTS(SELECT 1 FROM public.learning_courses p0 JOIN public.learning_assignment_rules p1 ON p1.course_id=p0.id WHERE t.source_rule_id=p1.id AND p0.id=p_id AND p0.org_id=p_org) UNION ALL SELECT 'learning_courses' kind,md5(to_jsonb(t)::text) id,md5(to_jsonb(t)::text) digest FROM public.learning_courses t WHERE t.id=p_id AND t.org_id=p_org UNION ALL SELECT 'learning_module_progress' kind,md5(to_jsonb(t)::text) id,md5(to_jsonb(t)::text) digest FROM public.learning_module_progress t WHERE EXISTS(SELECT 1 FROM public.learning_courses p0 JOIN public.learning_assignments p1 ON p1.course_id=p0.id WHERE t.assignment_id=p1.id AND p0.id=p_id AND p0.org_id=p_org) OR EXISTS(SELECT 1 FROM public.learning_courses p0 JOIN public.learning_modules p1 ON p1.course_id=p0.id WHERE t.module_id=p1.id AND p0.id=p_id AND p0.org_id=p_org) OR EXISTS(SELECT 1 FROM public.learning_courses p0 JOIN public.learning_assignment_rules p1 ON p1.course_id=p0.id JOIN public.learning_assignments p2 ON p2.source_rule_id=p1.id WHERE t.assignment_id=p2.id AND p0.id=p_id AND p0.org_id=p_org) UNION ALL SELECT 'learning_modules' kind,md5(to_jsonb(t)::text) id,md5(to_jsonb(t)::text) digest FROM public.learning_modules t WHERE EXISTS(SELECT 1 FROM public.learning_courses p0 WHERE t.course_id=p0.id AND p0.id=p_id AND p0.org_id=p_org) UNION ALL SELECT 'learning_progress_history' kind,md5(to_jsonb(t)::text) id,md5(to_jsonb(t)::text) digest FROM public.learning_progress_history t WHERE EXISTS(SELECT 1 FROM public.learning_courses p0 JOIN public.learning_assignments p1 ON p1.course_id=p0.id WHERE t.assignment_id=p1.id AND p0.id=p_id AND p0.org_id=p_org) OR EXISTS(SELECT 1 FROM public.learning_courses p0 JOIN public.learning_modules p1 ON p1.course_id=p0.id WHERE t.module_id=p1.id AND p0.id=p_id AND p0.org_id=p_org) OR EXISTS(SELECT 1 FROM public.learning_courses p0 JOIN public.learning_assignment_rules p1 ON p1.course_id=p0.id JOIN public.learning_assignments p2 ON p2.source_rule_id=p1.id WHERE t.assignment_id=p2.id AND p0.id=p_id AND p0.org_id=p_org) UNION ALL SELECT 'learning_resources' kind,md5(to_jsonb(t)::text) id,md5(to_jsonb(t)::text) digest FROM public.learning_resources t WHERE EXISTS(SELECT 1 FROM public.learning_courses p0 JOIN public.learning_modules p1 ON p1.course_id=p0.id WHERE t.module_id=p1.id AND p0.id=p_id AND p0.org_id=p_org) UNION ALL SELECT 'training_records' kind,md5(to_jsonb(t)::text) id,md5(to_jsonb(t)::text) digest FROM public.training_records t WHERE EXISTS(SELECT 1 FROM public.learning_courses p0 JOIN public.learning_assignments p1 ON p1.course_id=p0.id WHERE t.learning_assignment_id=p1.id AND p0.id=p_id AND p0.org_id=p_org) OR EXISTS(SELECT 1 FROM public.learning_courses p0 JOIN public.learning_assignment_rules p1 ON p1.course_id=p0.id JOIN public.learning_assignments p2 ON p2.source_rule_id=p1.id WHERE t.learning_assignment_id=p2.id AND p0.id=p_id AND p0.org_id=p_org)) snapshot;
 WHEN 'asset_items' THEN SELECT md5(coalesce(string_agg(kind||id::text||digest,'' ORDER BY kind,id),'')) INTO result FROM (SELECT 'asset_assignment_events' kind,md5(to_jsonb(t)::text) id,md5(to_jsonb(t)::text) digest FROM public.asset_assignment_events t WHERE EXISTS(SELECT 1 FROM public.asset_items p0 WHERE t.asset_id=p0.id AND p0.id=p_id AND p0.org_id=p_org) UNION ALL SELECT 'asset_items' kind,md5(to_jsonb(t)::text) id,md5(to_jsonb(t)::text) digest FROM public.asset_items t WHERE t.id=p_id AND t.org_id=p_org UNION ALL SELECT 'asset_lifecycle_events' kind,md5(to_jsonb(t)::text) id,md5(to_jsonb(t)::text) digest FROM public.asset_lifecycle_events t WHERE EXISTS(SELECT 1 FROM public.asset_items p0 WHERE t.asset_id=p0.id AND p0.id=p_id AND p0.org_id=p_org)) snapshot;
 WHEN 'appraisal_cycles' THEN SELECT md5(coalesce(string_agg(kind||id::text||digest,'' ORDER BY kind,id),'')) INTO result FROM (SELECT 'appraisal_cycles' kind,md5(to_jsonb(t)::text) id,md5(to_jsonb(t)::text) digest FROM public.appraisal_cycles t WHERE t.id=p_id AND t.org_id=p_org UNION ALL SELECT 'appraisal_entries' kind,md5(to_jsonb(t)::text) id,md5(to_jsonb(t)::text) digest FROM public.appraisal_entries t WHERE EXISTS(SELECT 1 FROM public.appraisal_cycles p0 JOIN public.appraisals p1 ON p1.cycle_id=p0.id WHERE t.appraisal_id=p1.id AND p0.id=p_id AND p0.org_id=p_org) UNION ALL SELECT 'appraisal_evidence_items' kind,md5(to_jsonb(t)::text) id,md5(to_jsonb(t)::text) digest FROM public.appraisal_evidence_items t WHERE EXISTS(SELECT 1 FROM public.appraisal_cycles p0 JOIN public.appraisals p1 ON p1.cycle_id=p0.id WHERE t.appraisal_id=p1.id AND p0.id=p_id AND p0.org_id=p_org) UNION ALL SELECT 'appraisal_human_rating_versions' kind,md5(to_jsonb(t)::text) id,md5(to_jsonb(t)::text) digest FROM public.appraisal_human_rating_versions t WHERE EXISTS(SELECT 1 FROM public.appraisal_cycles p0 JOIN public.appraisals p1 ON p1.cycle_id=p0.id WHERE t.appraisal_id=p1.id AND p0.id=p_id AND p0.org_id=p_org) OR EXISTS(SELECT 1 FROM public.appraisal_cycles p0 JOIN public.appraisals p1 ON p1.cycle_id=p0.id JOIN public.appraisal_entries p2 ON p2.appraisal_id=p1.id WHERE t.assessment_entry_id=p2.id AND p0.id=p_id AND p0.org_id=p_org) UNION ALL SELECT 'appraisal_review_exceptions' kind,md5(to_jsonb(t)::text) id,md5(to_jsonb(t)::text) digest FROM public.appraisal_review_exceptions t WHERE EXISTS(SELECT 1 FROM public.appraisal_cycles p0 JOIN public.appraisals p1 ON p1.cycle_id=p0.id WHERE t.appraisal_id=p1.id AND p0.id=p_id AND p0.org_id=p_org) UNION ALL SELECT 'appraisals' kind,md5(to_jsonb(t)::text) id,md5(to_jsonb(t)::text) digest FROM public.appraisals t WHERE EXISTS(SELECT 1 FROM public.appraisal_cycles p0 WHERE t.cycle_id=p0.id AND p0.id=p_id AND p0.org_id=p_org) UNION ALL SELECT 'development_plan_versions' kind,md5(to_jsonb(t)::text) id,md5(to_jsonb(t)::text) digest FROM public.development_plan_versions t WHERE EXISTS(SELECT 1 FROM public.appraisal_cycles p0 JOIN public.appraisals p1 ON p1.cycle_id=p0.id WHERE t.appraisal_id=p1.id AND p0.id=p_id AND p0.org_id=p_org) UNION ALL SELECT 'performance_review_release_requests' kind,md5(to_jsonb(t)::text) id,md5(to_jsonb(t)::text) digest FROM public.performance_review_release_requests t WHERE EXISTS(SELECT 1 FROM public.appraisal_cycles p0 JOIN public.appraisals p1 ON p1.cycle_id=p0.id WHERE t.appraisal_id=p1.id AND p0.id=p_id AND p0.org_id=p_org) OR EXISTS(SELECT 1 FROM public.appraisal_cycles p0 JOIN public.appraisals p1 ON p1.cycle_id=p0.id JOIN public.appraisal_entries p2 ON p2.appraisal_id=p1.id WHERE t.requested_assessment_id=p2.id AND p0.id=p_id AND p0.org_id=p_org)) snapshot;
 WHEN 'meeting_sessions' THEN SELECT md5(coalesce(string_agg(kind||id::text||digest,'' ORDER BY kind,id),'')) INTO result FROM (SELECT 'meeting_participants' kind,md5(to_jsonb(t)::text) id,md5(to_jsonb(t)::text) digest FROM public.meeting_participants t WHERE EXISTS(SELECT 1 FROM public.meeting_sessions p0 WHERE t.meeting_id=p0.id AND p0.id=p_id AND p0.org_id=p_org) UNION ALL SELECT 'meeting_private_notes' kind,md5(to_jsonb(t)::text) id,md5(to_jsonb(t)::text) digest FROM public.meeting_private_notes t WHERE EXISTS(SELECT 1 FROM public.meeting_sessions p0 WHERE t.meeting_id=p0.id AND p0.id=p_id AND p0.org_id=p_org) UNION ALL SELECT 'meeting_records' kind,md5(to_jsonb(t)::text) id,md5(to_jsonb(t)::text) digest FROM public.meeting_records t WHERE EXISTS(SELECT 1 FROM public.meeting_sessions p0 WHERE t.meeting_id=p0.id AND p0.id=p_id AND p0.org_id=p_org) UNION ALL SELECT 'meeting_sessions' kind,md5(to_jsonb(t)::text) id,md5(to_jsonb(t)::text) digest FROM public.meeting_sessions t WHERE t.id=p_id AND t.org_id=p_org UNION ALL SELECT 'meeting_work_links' kind,md5(to_jsonb(t)::text) id,md5(to_jsonb(t)::text) digest FROM public.meeting_work_links t WHERE EXISTS(SELECT 1 FROM public.meeting_sessions p0 WHERE t.meeting_id=p0.id AND p0.id=p_id AND p0.org_id=p_org)) snapshot;
 WHEN 'compliance_policy_versions' THEN SELECT md5(coalesce(string_agg(kind||id::text||digest,'' ORDER BY kind,id),'')) INTO result FROM (SELECT 'compliance_acknowledgements' kind,md5(to_jsonb(t)::text) id,md5(to_jsonb(t)::text) digest FROM public.compliance_acknowledgements t WHERE EXISTS(SELECT 1 FROM public.compliance_policy_versions p0 WHERE t.policy_version_id=p0.id AND p0.id=p_id AND p0.org_id=p_org) UNION ALL SELECT 'compliance_evidence_versions' kind,md5(to_jsonb(t)::text) id,md5(to_jsonb(t)::text) digest FROM public.compliance_evidence_versions t WHERE EXISTS(SELECT 1 FROM public.compliance_policy_versions p0 JOIN public.compliance_requirements p1 ON p1.policy_version_id=p0.id WHERE t.requirement_id=p1.id AND p0.id=p_id AND p0.org_id=p_org) UNION ALL SELECT 'compliance_exception_versions' kind,md5(to_jsonb(t)::text) id,md5(to_jsonb(t)::text) digest FROM public.compliance_exception_versions t WHERE EXISTS(SELECT 1 FROM public.compliance_policy_versions p0 JOIN public.compliance_requirements p1 ON p1.policy_version_id=p0.id WHERE t.requirement_id=p1.id AND p0.id=p_id AND p0.org_id=p_org) UNION ALL SELECT 'compliance_policy_applicability' kind,md5(to_jsonb(t)::text) id,md5(to_jsonb(t)::text) digest FROM public.compliance_policy_applicability t WHERE EXISTS(SELECT 1 FROM public.compliance_policy_versions p0 WHERE t.policy_version_id=p0.id AND p0.id=p_id AND p0.org_id=p_org) UNION ALL SELECT 'compliance_policy_versions' kind,md5(to_jsonb(t)::text) id,md5(to_jsonb(t)::text) digest FROM public.compliance_policy_versions t WHERE t.id=p_id AND t.org_id=p_org UNION ALL SELECT 'compliance_requirements' kind,md5(to_jsonb(t)::text) id,md5(to_jsonb(t)::text) digest FROM public.compliance_requirements t WHERE EXISTS(SELECT 1 FROM public.compliance_policy_versions p0 WHERE t.policy_version_id=p0.id AND p0.id=p_id AND p0.org_id=p_org)) snapshot;
 WHEN 'strategy_nodes' THEN SELECT md5(coalesce(string_agg(kind||id::text||digest,'' ORDER BY kind,id),'')) INTO result FROM (SELECT 'delivery_group_projects' kind,md5(to_jsonb(t)::text) id,md5(to_jsonb(t)::text) digest FROM public.delivery_group_projects t WHERE EXISTS(SELECT 1 FROM public.strategy_nodes p0 JOIN public.delivery_groups p1 ON p1.strategy_node_id=p0.id WHERE t.delivery_group_id=p1.id AND p0.id=p_id AND p0.org_id=p_org) UNION ALL SELECT 'delivery_groups' kind,md5(to_jsonb(t)::text) id,md5(to_jsonb(t)::text) digest FROM public.delivery_groups t WHERE EXISTS(SELECT 1 FROM public.strategy_nodes p0 WHERE t.strategy_node_id=p0.id AND p0.id=p_id AND p0.org_id=p_org) UNION ALL SELECT 'feedback_notes' kind,md5(to_jsonb(t)::text) id,md5(to_jsonb(t)::text) digest FROM public.feedback_notes t WHERE EXISTS(SELECT 1 FROM public.strategy_nodes p0 WHERE t.strategy_node_id=p0.id AND p0.id=p_id AND p0.org_id=p_org) UNION ALL SELECT 'feedback_responses' kind,md5(to_jsonb(t)::text) id,md5(to_jsonb(t)::text) digest FROM public.feedback_responses t WHERE EXISTS(SELECT 1 FROM public.strategy_nodes p0 JOIN public.feedback_notes p1 ON p1.strategy_node_id=p0.id WHERE t.feedback_note_id=p1.id AND p0.id=p_id AND p0.org_id=p_org) UNION ALL SELECT 'strategy_delivery_links' kind,md5(to_jsonb(t)::text) id,md5(to_jsonb(t)::text) digest FROM public.strategy_delivery_links t WHERE EXISTS(SELECT 1 FROM public.strategy_nodes p0 WHERE t.strategy_node_id=p0.id AND p0.id=p_id AND p0.org_id=p_org) UNION ALL SELECT 'strategy_node_revisions' kind,md5(to_jsonb(t)::text) id,md5(to_jsonb(t)::text) digest FROM public.strategy_node_revisions t WHERE EXISTS(SELECT 1 FROM public.strategy_nodes p0 WHERE t.strategy_node_id=p0.id AND p0.id=p_id AND p0.org_id=p_org) UNION ALL SELECT 'strategy_nodes' kind,md5(to_jsonb(t)::text) id,md5(to_jsonb(t)::text) digest FROM public.strategy_nodes t WHERE t.id=p_id AND t.org_id=p_org) snapshot;
 ELSE RAISE EXCEPTION 'Unsupported content archive record.'; END CASE; RETURN result; END;
$hash$;
REVOKE ALL ON FUNCTION private.content_archive_fingerprint(text,uuid,uuid) FROM public,anon,authenticated,service_role;

CREATE FUNCTION private.guard_content_archive() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $guard$
DECLARE r jsonb; rows jsonb[]; v_id uuid; v_org uuid;
BEGIN
 rows:=CASE WHEN TG_OP='INSERT' THEN ARRAY[to_jsonb(NEW)] WHEN TG_OP='DELETE' THEN ARRAY[to_jsonb(OLD)] ELSE ARRAY[to_jsonb(OLD),to_jsonb(NEW)] END;
 FOREACH r IN ARRAY rows LOOP
 CASE TG_TABLE_NAME
 WHEN 'announcement_audiences' THEN
  v_id:=NULL; v_org:=NULL;
  EXECUTE 'SELECT p0.id,p0.org_id FROM public.announcements p0 WHERE p0.id=$1 FOR SHARE OF p0' INTO v_id,v_org USING nullif(r->>'announcement_id','')::uuid;
  IF v_id IS NOT NULL AND public.operational_record_is_archived('announcements',v_id,v_org) THEN
   RAISE EXCEPTION 'Archived demonstration content is read-only. Restore its classification first.' USING ERRCODE='42501';
  END IF;
 WHEN 'announcement_receipts' THEN
  v_id:=NULL; v_org:=NULL;
  EXECUTE 'SELECT p0.id,p0.org_id FROM public.announcements p0 WHERE p0.id=$1 FOR SHARE OF p0' INTO v_id,v_org USING nullif(r->>'announcement_id','')::uuid;
  IF v_id IS NOT NULL AND public.operational_record_is_archived('announcements',v_id,v_org) THEN
   RAISE EXCEPTION 'Archived demonstration content is read-only. Restore its classification first.' USING ERRCODE='42501';
  END IF;
 WHEN 'announcements' THEN
  v_id:=NULL; v_org:=NULL;
  EXECUTE 'SELECT p0.id,p0.org_id FROM public.announcements p0 WHERE p0.id=$1 FOR SHARE OF p0' INTO v_id,v_org USING nullif(r->>'id','')::uuid;
  IF v_id IS NOT NULL AND public.operational_record_is_archived('announcements',v_id,v_org) THEN
   RAISE EXCEPTION 'Archived demonstration content is read-only. Restore its classification first.' USING ERRCODE='42501';
  END IF;
 WHEN 'appraisal_cycles' THEN
  v_id:=NULL; v_org:=NULL;
  EXECUTE 'SELECT p0.id,p0.org_id FROM public.appraisal_cycles p0 WHERE p0.id=$1 FOR SHARE OF p0' INTO v_id,v_org USING nullif(r->>'id','')::uuid;
  IF v_id IS NOT NULL AND public.operational_record_is_archived('appraisal_cycles',v_id,v_org) THEN
   RAISE EXCEPTION 'Archived demonstration content is read-only. Restore its classification first.' USING ERRCODE='42501';
  END IF;
 WHEN 'appraisal_entries' THEN
  v_id:=NULL; v_org:=NULL;
  EXECUTE 'SELECT p0.id,p0.org_id FROM public.appraisal_cycles p0 JOIN public.appraisals p1 ON p1.cycle_id=p0.id WHERE p1.id=$1 FOR SHARE OF p0' INTO v_id,v_org USING nullif(r->>'appraisal_id','')::uuid;
  IF v_id IS NOT NULL AND public.operational_record_is_archived('appraisal_cycles',v_id,v_org) THEN
   RAISE EXCEPTION 'Archived demonstration content is read-only. Restore its classification first.' USING ERRCODE='42501';
  END IF;
 WHEN 'appraisal_evidence_items' THEN
  v_id:=NULL; v_org:=NULL;
  EXECUTE 'SELECT p0.id,p0.org_id FROM public.appraisal_cycles p0 JOIN public.appraisals p1 ON p1.cycle_id=p0.id WHERE p1.id=$1 FOR SHARE OF p0' INTO v_id,v_org USING nullif(r->>'appraisal_id','')::uuid;
  IF v_id IS NOT NULL AND public.operational_record_is_archived('appraisal_cycles',v_id,v_org) THEN
   RAISE EXCEPTION 'Archived demonstration content is read-only. Restore its classification first.' USING ERRCODE='42501';
  END IF;
 WHEN 'appraisal_human_rating_versions' THEN
  v_id:=NULL; v_org:=NULL;
  EXECUTE 'SELECT p0.id,p0.org_id FROM public.appraisal_cycles p0 JOIN public.appraisals p1 ON p1.cycle_id=p0.id WHERE p1.id=$1 FOR SHARE OF p0' INTO v_id,v_org USING nullif(r->>'appraisal_id','')::uuid;
  IF v_id IS NOT NULL AND public.operational_record_is_archived('appraisal_cycles',v_id,v_org) THEN
   RAISE EXCEPTION 'Archived demonstration content is read-only. Restore its classification first.' USING ERRCODE='42501';
  END IF;
  v_id:=NULL; v_org:=NULL;
  EXECUTE 'SELECT p0.id,p0.org_id FROM public.appraisal_cycles p0 JOIN public.appraisals p1 ON p1.cycle_id=p0.id JOIN public.appraisal_entries p2 ON p2.appraisal_id=p1.id WHERE p2.id=$1 FOR SHARE OF p0' INTO v_id,v_org USING nullif(r->>'assessment_entry_id','')::uuid;
  IF v_id IS NOT NULL AND public.operational_record_is_archived('appraisal_cycles',v_id,v_org) THEN
   RAISE EXCEPTION 'Archived demonstration content is read-only. Restore its classification first.' USING ERRCODE='42501';
  END IF;
 WHEN 'appraisal_review_exceptions' THEN
  v_id:=NULL; v_org:=NULL;
  EXECUTE 'SELECT p0.id,p0.org_id FROM public.appraisal_cycles p0 JOIN public.appraisals p1 ON p1.cycle_id=p0.id WHERE p1.id=$1 FOR SHARE OF p0' INTO v_id,v_org USING nullif(r->>'appraisal_id','')::uuid;
  IF v_id IS NOT NULL AND public.operational_record_is_archived('appraisal_cycles',v_id,v_org) THEN
   RAISE EXCEPTION 'Archived demonstration content is read-only. Restore its classification first.' USING ERRCODE='42501';
  END IF;
 WHEN 'appraisals' THEN
  v_id:=NULL; v_org:=NULL;
  EXECUTE 'SELECT p0.id,p0.org_id FROM public.appraisal_cycles p0 WHERE p0.id=$1 FOR SHARE OF p0' INTO v_id,v_org USING nullif(r->>'cycle_id','')::uuid;
  IF v_id IS NOT NULL AND public.operational_record_is_archived('appraisal_cycles',v_id,v_org) THEN
   RAISE EXCEPTION 'Archived demonstration content is read-only. Restore its classification first.' USING ERRCODE='42501';
  END IF;
 WHEN 'asset_assignment_events' THEN
  v_id:=NULL; v_org:=NULL;
  EXECUTE 'SELECT p0.id,p0.org_id FROM public.asset_items p0 WHERE p0.id=$1 FOR SHARE OF p0' INTO v_id,v_org USING nullif(r->>'asset_id','')::uuid;
  IF v_id IS NOT NULL AND public.operational_record_is_archived('asset_items',v_id,v_org) THEN
   RAISE EXCEPTION 'Archived demonstration content is read-only. Restore its classification first.' USING ERRCODE='42501';
  END IF;
 WHEN 'asset_items' THEN
  v_id:=NULL; v_org:=NULL;
  EXECUTE 'SELECT p0.id,p0.org_id FROM public.asset_items p0 WHERE p0.id=$1 FOR SHARE OF p0' INTO v_id,v_org USING nullif(r->>'id','')::uuid;
  IF v_id IS NOT NULL AND public.operational_record_is_archived('asset_items',v_id,v_org) THEN
   RAISE EXCEPTION 'Archived demonstration content is read-only. Restore its classification first.' USING ERRCODE='42501';
  END IF;
 WHEN 'asset_lifecycle_events' THEN
  v_id:=NULL; v_org:=NULL;
  EXECUTE 'SELECT p0.id,p0.org_id FROM public.asset_items p0 WHERE p0.id=$1 FOR SHARE OF p0' INTO v_id,v_org USING nullif(r->>'asset_id','')::uuid;
  IF v_id IS NOT NULL AND public.operational_record_is_archived('asset_items',v_id,v_org) THEN
   RAISE EXCEPTION 'Archived demonstration content is read-only. Restore its classification first.' USING ERRCODE='42501';
  END IF;
 WHEN 'compliance_acknowledgements' THEN
  v_id:=NULL; v_org:=NULL;
  EXECUTE 'SELECT p0.id,p0.org_id FROM public.compliance_policy_versions p0 WHERE p0.id=$1 FOR SHARE OF p0' INTO v_id,v_org USING nullif(r->>'policy_version_id','')::uuid;
  IF v_id IS NOT NULL AND public.operational_record_is_archived('compliance_policy_versions',v_id,v_org) THEN
   RAISE EXCEPTION 'Archived demonstration content is read-only. Restore its classification first.' USING ERRCODE='42501';
  END IF;
 WHEN 'compliance_evidence_versions' THEN
  v_id:=NULL; v_org:=NULL;
  EXECUTE 'SELECT p0.id,p0.org_id FROM public.compliance_policy_versions p0 JOIN public.compliance_requirements p1 ON p1.policy_version_id=p0.id WHERE p1.id=$1 FOR SHARE OF p0' INTO v_id,v_org USING nullif(r->>'requirement_id','')::uuid;
  IF v_id IS NOT NULL AND public.operational_record_is_archived('compliance_policy_versions',v_id,v_org) THEN
   RAISE EXCEPTION 'Archived demonstration content is read-only. Restore its classification first.' USING ERRCODE='42501';
  END IF;
 WHEN 'compliance_exception_versions' THEN
  v_id:=NULL; v_org:=NULL;
  EXECUTE 'SELECT p0.id,p0.org_id FROM public.compliance_policy_versions p0 JOIN public.compliance_requirements p1 ON p1.policy_version_id=p0.id WHERE p1.id=$1 FOR SHARE OF p0' INTO v_id,v_org USING nullif(r->>'requirement_id','')::uuid;
  IF v_id IS NOT NULL AND public.operational_record_is_archived('compliance_policy_versions',v_id,v_org) THEN
   RAISE EXCEPTION 'Archived demonstration content is read-only. Restore its classification first.' USING ERRCODE='42501';
  END IF;
 WHEN 'compliance_policy_applicability' THEN
  v_id:=NULL; v_org:=NULL;
  EXECUTE 'SELECT p0.id,p0.org_id FROM public.compliance_policy_versions p0 WHERE p0.id=$1 FOR SHARE OF p0' INTO v_id,v_org USING nullif(r->>'policy_version_id','')::uuid;
  IF v_id IS NOT NULL AND public.operational_record_is_archived('compliance_policy_versions',v_id,v_org) THEN
   RAISE EXCEPTION 'Archived demonstration content is read-only. Restore its classification first.' USING ERRCODE='42501';
  END IF;
 WHEN 'compliance_policy_versions' THEN
  v_id:=NULL; v_org:=NULL;
  EXECUTE 'SELECT p0.id,p0.org_id FROM public.compliance_policy_versions p0 WHERE p0.id=$1 FOR SHARE OF p0' INTO v_id,v_org USING nullif(r->>'id','')::uuid;
  IF v_id IS NOT NULL AND public.operational_record_is_archived('compliance_policy_versions',v_id,v_org) THEN
   RAISE EXCEPTION 'Archived demonstration content is read-only. Restore its classification first.' USING ERRCODE='42501';
  END IF;
 WHEN 'compliance_requirements' THEN
  v_id:=NULL; v_org:=NULL;
  EXECUTE 'SELECT p0.id,p0.org_id FROM public.compliance_policy_versions p0 WHERE p0.id=$1 FOR SHARE OF p0' INTO v_id,v_org USING nullif(r->>'policy_version_id','')::uuid;
  IF v_id IS NOT NULL AND public.operational_record_is_archived('compliance_policy_versions',v_id,v_org) THEN
   RAISE EXCEPTION 'Archived demonstration content is read-only. Restore its classification first.' USING ERRCODE='42501';
  END IF;
 WHEN 'delivery_group_projects' THEN
  v_id:=NULL; v_org:=NULL;
  EXECUTE 'SELECT p0.id,p0.org_id FROM public.strategy_nodes p0 JOIN public.delivery_groups p1 ON p1.strategy_node_id=p0.id WHERE p1.id=$1 FOR SHARE OF p0' INTO v_id,v_org USING nullif(r->>'delivery_group_id','')::uuid;
  IF v_id IS NOT NULL AND public.operational_record_is_archived('strategy_nodes',v_id,v_org) THEN
   RAISE EXCEPTION 'Archived demonstration content is read-only. Restore its classification first.' USING ERRCODE='42501';
  END IF;
 WHEN 'delivery_groups' THEN
  v_id:=NULL; v_org:=NULL;
  EXECUTE 'SELECT p0.id,p0.org_id FROM public.strategy_nodes p0 WHERE p0.id=$1 FOR SHARE OF p0' INTO v_id,v_org USING nullif(r->>'strategy_node_id','')::uuid;
  IF v_id IS NOT NULL AND public.operational_record_is_archived('strategy_nodes',v_id,v_org) THEN
   RAISE EXCEPTION 'Archived demonstration content is read-only. Restore its classification first.' USING ERRCODE='42501';
  END IF;
 WHEN 'development_plan_versions' THEN
  v_id:=NULL; v_org:=NULL;
  EXECUTE 'SELECT p0.id,p0.org_id FROM public.appraisal_cycles p0 JOIN public.appraisals p1 ON p1.cycle_id=p0.id WHERE p1.id=$1 FOR SHARE OF p0' INTO v_id,v_org USING nullif(r->>'appraisal_id','')::uuid;
  IF v_id IS NOT NULL AND public.operational_record_is_archived('appraisal_cycles',v_id,v_org) THEN
   RAISE EXCEPTION 'Archived demonstration content is read-only. Restore its classification first.' USING ERRCODE='42501';
  END IF;
 WHEN 'feedback_notes' THEN
  v_id:=NULL; v_org:=NULL;
  EXECUTE 'SELECT p0.id,p0.org_id FROM public.strategy_nodes p0 WHERE p0.id=$1 FOR SHARE OF p0' INTO v_id,v_org USING nullif(r->>'strategy_node_id','')::uuid;
  IF v_id IS NOT NULL AND public.operational_record_is_archived('strategy_nodes',v_id,v_org) THEN
   RAISE EXCEPTION 'Archived demonstration content is read-only. Restore its classification first.' USING ERRCODE='42501';
  END IF;
 WHEN 'feedback_responses' THEN
  v_id:=NULL; v_org:=NULL;
  EXECUTE 'SELECT p0.id,p0.org_id FROM public.strategy_nodes p0 JOIN public.feedback_notes p1 ON p1.strategy_node_id=p0.id WHERE p1.id=$1 FOR SHARE OF p0' INTO v_id,v_org USING nullif(r->>'feedback_note_id','')::uuid;
  IF v_id IS NOT NULL AND public.operational_record_is_archived('strategy_nodes',v_id,v_org) THEN
   RAISE EXCEPTION 'Archived demonstration content is read-only. Restore its classification first.' USING ERRCODE='42501';
  END IF;
 WHEN 'learning_assignment_rules' THEN
  v_id:=NULL; v_org:=NULL;
  EXECUTE 'SELECT p0.id,p0.org_id FROM public.learning_courses p0 WHERE p0.id=$1 FOR SHARE OF p0' INTO v_id,v_org USING nullif(r->>'course_id','')::uuid;
  IF v_id IS NOT NULL AND public.operational_record_is_archived('learning_courses',v_id,v_org) THEN
   RAISE EXCEPTION 'Archived demonstration content is read-only. Restore its classification first.' USING ERRCODE='42501';
  END IF;
 WHEN 'learning_assignments' THEN
  v_id:=NULL; v_org:=NULL;
  EXECUTE 'SELECT p0.id,p0.org_id FROM public.learning_courses p0 WHERE p0.id=$1 FOR SHARE OF p0' INTO v_id,v_org USING nullif(r->>'course_id','')::uuid;
  IF v_id IS NOT NULL AND public.operational_record_is_archived('learning_courses',v_id,v_org) THEN
   RAISE EXCEPTION 'Archived demonstration content is read-only. Restore its classification first.' USING ERRCODE='42501';
  END IF;
  v_id:=NULL; v_org:=NULL;
  EXECUTE 'SELECT p0.id,p0.org_id FROM public.learning_courses p0 JOIN public.learning_assignment_rules p1 ON p1.course_id=p0.id WHERE p1.id=$1 FOR SHARE OF p0' INTO v_id,v_org USING nullif(r->>'source_rule_id','')::uuid;
  IF v_id IS NOT NULL AND public.operational_record_is_archived('learning_courses',v_id,v_org) THEN
   RAISE EXCEPTION 'Archived demonstration content is read-only. Restore its classification first.' USING ERRCODE='42501';
  END IF;
 WHEN 'learning_courses' THEN
  v_id:=NULL; v_org:=NULL;
  EXECUTE 'SELECT p0.id,p0.org_id FROM public.learning_courses p0 WHERE p0.id=$1 FOR SHARE OF p0' INTO v_id,v_org USING nullif(r->>'id','')::uuid;
  IF v_id IS NOT NULL AND public.operational_record_is_archived('learning_courses',v_id,v_org) THEN
   RAISE EXCEPTION 'Archived demonstration content is read-only. Restore its classification first.' USING ERRCODE='42501';
  END IF;
 WHEN 'learning_module_progress' THEN
  v_id:=NULL; v_org:=NULL;
  EXECUTE 'SELECT p0.id,p0.org_id FROM public.learning_courses p0 JOIN public.learning_assignments p1 ON p1.course_id=p0.id WHERE p1.id=$1 FOR SHARE OF p0' INTO v_id,v_org USING nullif(r->>'assignment_id','')::uuid;
  IF v_id IS NOT NULL AND public.operational_record_is_archived('learning_courses',v_id,v_org) THEN
   RAISE EXCEPTION 'Archived demonstration content is read-only. Restore its classification first.' USING ERRCODE='42501';
  END IF;
  v_id:=NULL; v_org:=NULL;
  EXECUTE 'SELECT p0.id,p0.org_id FROM public.learning_courses p0 JOIN public.learning_modules p1 ON p1.course_id=p0.id WHERE p1.id=$1 FOR SHARE OF p0' INTO v_id,v_org USING nullif(r->>'module_id','')::uuid;
  IF v_id IS NOT NULL AND public.operational_record_is_archived('learning_courses',v_id,v_org) THEN
   RAISE EXCEPTION 'Archived demonstration content is read-only. Restore its classification first.' USING ERRCODE='42501';
  END IF;
  v_id:=NULL; v_org:=NULL;
  EXECUTE 'SELECT p0.id,p0.org_id FROM public.learning_courses p0 JOIN public.learning_assignment_rules p1 ON p1.course_id=p0.id JOIN public.learning_assignments p2 ON p2.source_rule_id=p1.id WHERE p2.id=$1 FOR SHARE OF p0' INTO v_id,v_org USING nullif(r->>'assignment_id','')::uuid;
  IF v_id IS NOT NULL AND public.operational_record_is_archived('learning_courses',v_id,v_org) THEN
   RAISE EXCEPTION 'Archived demonstration content is read-only. Restore its classification first.' USING ERRCODE='42501';
  END IF;
 WHEN 'learning_modules' THEN
  v_id:=NULL; v_org:=NULL;
  EXECUTE 'SELECT p0.id,p0.org_id FROM public.learning_courses p0 WHERE p0.id=$1 FOR SHARE OF p0' INTO v_id,v_org USING nullif(r->>'course_id','')::uuid;
  IF v_id IS NOT NULL AND public.operational_record_is_archived('learning_courses',v_id,v_org) THEN
   RAISE EXCEPTION 'Archived demonstration content is read-only. Restore its classification first.' USING ERRCODE='42501';
  END IF;
 WHEN 'learning_progress_history' THEN
  v_id:=NULL; v_org:=NULL;
  EXECUTE 'SELECT p0.id,p0.org_id FROM public.learning_courses p0 JOIN public.learning_assignments p1 ON p1.course_id=p0.id WHERE p1.id=$1 FOR SHARE OF p0' INTO v_id,v_org USING nullif(r->>'assignment_id','')::uuid;
  IF v_id IS NOT NULL AND public.operational_record_is_archived('learning_courses',v_id,v_org) THEN
   RAISE EXCEPTION 'Archived demonstration content is read-only. Restore its classification first.' USING ERRCODE='42501';
  END IF;
  v_id:=NULL; v_org:=NULL;
  EXECUTE 'SELECT p0.id,p0.org_id FROM public.learning_courses p0 JOIN public.learning_modules p1 ON p1.course_id=p0.id WHERE p1.id=$1 FOR SHARE OF p0' INTO v_id,v_org USING nullif(r->>'module_id','')::uuid;
  IF v_id IS NOT NULL AND public.operational_record_is_archived('learning_courses',v_id,v_org) THEN
   RAISE EXCEPTION 'Archived demonstration content is read-only. Restore its classification first.' USING ERRCODE='42501';
  END IF;
  v_id:=NULL; v_org:=NULL;
  EXECUTE 'SELECT p0.id,p0.org_id FROM public.learning_courses p0 JOIN public.learning_assignment_rules p1 ON p1.course_id=p0.id JOIN public.learning_assignments p2 ON p2.source_rule_id=p1.id WHERE p2.id=$1 FOR SHARE OF p0' INTO v_id,v_org USING nullif(r->>'assignment_id','')::uuid;
  IF v_id IS NOT NULL AND public.operational_record_is_archived('learning_courses',v_id,v_org) THEN
   RAISE EXCEPTION 'Archived demonstration content is read-only. Restore its classification first.' USING ERRCODE='42501';
  END IF;
 WHEN 'learning_resources' THEN
  v_id:=NULL; v_org:=NULL;
  EXECUTE 'SELECT p0.id,p0.org_id FROM public.learning_courses p0 JOIN public.learning_modules p1 ON p1.course_id=p0.id WHERE p1.id=$1 FOR SHARE OF p0' INTO v_id,v_org USING nullif(r->>'module_id','')::uuid;
  IF v_id IS NOT NULL AND public.operational_record_is_archived('learning_courses',v_id,v_org) THEN
   RAISE EXCEPTION 'Archived demonstration content is read-only. Restore its classification first.' USING ERRCODE='42501';
  END IF;
 WHEN 'meeting_participants' THEN
  v_id:=NULL; v_org:=NULL;
  EXECUTE 'SELECT p0.id,p0.org_id FROM public.meeting_sessions p0 WHERE p0.id=$1 FOR SHARE OF p0' INTO v_id,v_org USING nullif(r->>'meeting_id','')::uuid;
  IF v_id IS NOT NULL AND public.operational_record_is_archived('meeting_sessions',v_id,v_org) THEN
   RAISE EXCEPTION 'Archived demonstration content is read-only. Restore its classification first.' USING ERRCODE='42501';
  END IF;
 WHEN 'meeting_private_notes' THEN
  v_id:=NULL; v_org:=NULL;
  EXECUTE 'SELECT p0.id,p0.org_id FROM public.meeting_sessions p0 WHERE p0.id=$1 FOR SHARE OF p0' INTO v_id,v_org USING nullif(r->>'meeting_id','')::uuid;
  IF v_id IS NOT NULL AND public.operational_record_is_archived('meeting_sessions',v_id,v_org) THEN
   RAISE EXCEPTION 'Archived demonstration content is read-only. Restore its classification first.' USING ERRCODE='42501';
  END IF;
 WHEN 'meeting_records' THEN
  v_id:=NULL; v_org:=NULL;
  EXECUTE 'SELECT p0.id,p0.org_id FROM public.meeting_sessions p0 WHERE p0.id=$1 FOR SHARE OF p0' INTO v_id,v_org USING nullif(r->>'meeting_id','')::uuid;
  IF v_id IS NOT NULL AND public.operational_record_is_archived('meeting_sessions',v_id,v_org) THEN
   RAISE EXCEPTION 'Archived demonstration content is read-only. Restore its classification first.' USING ERRCODE='42501';
  END IF;
 WHEN 'meeting_sessions' THEN
  v_id:=NULL; v_org:=NULL;
  EXECUTE 'SELECT p0.id,p0.org_id FROM public.meeting_sessions p0 WHERE p0.id=$1 FOR SHARE OF p0' INTO v_id,v_org USING nullif(r->>'id','')::uuid;
  IF v_id IS NOT NULL AND public.operational_record_is_archived('meeting_sessions',v_id,v_org) THEN
   RAISE EXCEPTION 'Archived demonstration content is read-only. Restore its classification first.' USING ERRCODE='42501';
  END IF;
 WHEN 'meeting_work_links' THEN
  v_id:=NULL; v_org:=NULL;
  EXECUTE 'SELECT p0.id,p0.org_id FROM public.meeting_sessions p0 WHERE p0.id=$1 FOR SHARE OF p0' INTO v_id,v_org USING nullif(r->>'meeting_id','')::uuid;
  IF v_id IS NOT NULL AND public.operational_record_is_archived('meeting_sessions',v_id,v_org) THEN
   RAISE EXCEPTION 'Archived demonstration content is read-only. Restore its classification first.' USING ERRCODE='42501';
  END IF;
 WHEN 'performance_review_release_requests' THEN
  v_id:=NULL; v_org:=NULL;
  EXECUTE 'SELECT p0.id,p0.org_id FROM public.appraisal_cycles p0 JOIN public.appraisals p1 ON p1.cycle_id=p0.id WHERE p1.id=$1 FOR SHARE OF p0' INTO v_id,v_org USING nullif(r->>'appraisal_id','')::uuid;
  IF v_id IS NOT NULL AND public.operational_record_is_archived('appraisal_cycles',v_id,v_org) THEN
   RAISE EXCEPTION 'Archived demonstration content is read-only. Restore its classification first.' USING ERRCODE='42501';
  END IF;
  v_id:=NULL; v_org:=NULL;
  EXECUTE 'SELECT p0.id,p0.org_id FROM public.appraisal_cycles p0 JOIN public.appraisals p1 ON p1.cycle_id=p0.id JOIN public.appraisal_entries p2 ON p2.appraisal_id=p1.id WHERE p2.id=$1 FOR SHARE OF p0' INTO v_id,v_org USING nullif(r->>'requested_assessment_id','')::uuid;
  IF v_id IS NOT NULL AND public.operational_record_is_archived('appraisal_cycles',v_id,v_org) THEN
   RAISE EXCEPTION 'Archived demonstration content is read-only. Restore its classification first.' USING ERRCODE='42501';
  END IF;
 WHEN 'strategy_delivery_links' THEN
  v_id:=NULL; v_org:=NULL;
  EXECUTE 'SELECT p0.id,p0.org_id FROM public.strategy_nodes p0 WHERE p0.id=$1 FOR SHARE OF p0' INTO v_id,v_org USING nullif(r->>'strategy_node_id','')::uuid;
  IF v_id IS NOT NULL AND public.operational_record_is_archived('strategy_nodes',v_id,v_org) THEN
   RAISE EXCEPTION 'Archived demonstration content is read-only. Restore its classification first.' USING ERRCODE='42501';
  END IF;
 WHEN 'strategy_node_revisions' THEN
  v_id:=NULL; v_org:=NULL;
  EXECUTE 'SELECT p0.id,p0.org_id FROM public.strategy_nodes p0 WHERE p0.id=$1 FOR SHARE OF p0' INTO v_id,v_org USING nullif(r->>'strategy_node_id','')::uuid;
  IF v_id IS NOT NULL AND public.operational_record_is_archived('strategy_nodes',v_id,v_org) THEN
   RAISE EXCEPTION 'Archived demonstration content is read-only. Restore its classification first.' USING ERRCODE='42501';
  END IF;
 WHEN 'strategy_nodes' THEN
  v_id:=NULL; v_org:=NULL;
  EXECUTE 'SELECT p0.id,p0.org_id FROM public.strategy_nodes p0 WHERE p0.id=$1 FOR SHARE OF p0' INTO v_id,v_org USING nullif(r->>'id','')::uuid;
  IF v_id IS NOT NULL AND public.operational_record_is_archived('strategy_nodes',v_id,v_org) THEN
   RAISE EXCEPTION 'Archived demonstration content is read-only. Restore its classification first.' USING ERRCODE='42501';
  END IF;
 WHEN 'training_records' THEN
  v_id:=NULL; v_org:=NULL;
  EXECUTE 'SELECT p0.id,p0.org_id FROM public.learning_courses p0 JOIN public.learning_assignments p1 ON p1.course_id=p0.id WHERE p1.id=$1 FOR SHARE OF p0' INTO v_id,v_org USING nullif(r->>'learning_assignment_id','')::uuid;
  IF v_id IS NOT NULL AND public.operational_record_is_archived('learning_courses',v_id,v_org) THEN
   RAISE EXCEPTION 'Archived demonstration content is read-only. Restore its classification first.' USING ERRCODE='42501';
  END IF;
  v_id:=NULL; v_org:=NULL;
  EXECUTE 'SELECT p0.id,p0.org_id FROM public.learning_courses p0 JOIN public.learning_assignment_rules p1 ON p1.course_id=p0.id JOIN public.learning_assignments p2 ON p2.source_rule_id=p1.id WHERE p2.id=$1 FOR SHARE OF p0' INTO v_id,v_org USING nullif(r->>'learning_assignment_id','')::uuid;
  IF v_id IS NOT NULL AND public.operational_record_is_archived('learning_courses',v_id,v_org) THEN
   RAISE EXCEPTION 'Archived demonstration content is read-only. Restore its classification first.' USING ERRCODE='42501';
  END IF;
 ELSE RAISE EXCEPTION 'Unsupported content archive guard.';
 END CASE;
 END LOOP;
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END;
$guard$;
REVOKE ALL ON FUNCTION private.guard_content_archive() FROM public,anon,authenticated,service_role;

CREATE TRIGGER content_archive_guard BEFORE INSERT OR UPDATE OR DELETE ON public.announcement_audiences FOR EACH ROW EXECUTE FUNCTION private.guard_content_archive();

CREATE TRIGGER content_archive_guard BEFORE INSERT OR UPDATE OR DELETE ON public.announcement_receipts FOR EACH ROW EXECUTE FUNCTION private.guard_content_archive();

CREATE TRIGGER content_archive_guard BEFORE UPDATE OR DELETE ON public.announcements FOR EACH ROW EXECUTE FUNCTION private.guard_content_archive();

CREATE TRIGGER content_archive_guard BEFORE UPDATE OR DELETE ON public.appraisal_cycles FOR EACH ROW EXECUTE FUNCTION private.guard_content_archive();

CREATE TRIGGER content_archive_guard BEFORE INSERT OR UPDATE OR DELETE ON public.appraisal_entries FOR EACH ROW EXECUTE FUNCTION private.guard_content_archive();

CREATE TRIGGER content_archive_guard BEFORE INSERT OR UPDATE OR DELETE ON public.appraisal_evidence_items FOR EACH ROW EXECUTE FUNCTION private.guard_content_archive();

CREATE TRIGGER content_archive_guard BEFORE INSERT OR UPDATE OR DELETE ON public.appraisal_human_rating_versions FOR EACH ROW EXECUTE FUNCTION private.guard_content_archive();

CREATE TRIGGER content_archive_guard BEFORE INSERT OR UPDATE OR DELETE ON public.appraisal_review_exceptions FOR EACH ROW EXECUTE FUNCTION private.guard_content_archive();

CREATE TRIGGER content_archive_guard BEFORE INSERT OR UPDATE OR DELETE ON public.appraisals FOR EACH ROW EXECUTE FUNCTION private.guard_content_archive();

CREATE TRIGGER content_archive_guard BEFORE INSERT OR UPDATE OR DELETE ON public.asset_assignment_events FOR EACH ROW EXECUTE FUNCTION private.guard_content_archive();

CREATE TRIGGER content_archive_guard BEFORE UPDATE OR DELETE ON public.asset_items FOR EACH ROW EXECUTE FUNCTION private.guard_content_archive();

CREATE TRIGGER content_archive_guard BEFORE INSERT OR UPDATE OR DELETE ON public.asset_lifecycle_events FOR EACH ROW EXECUTE FUNCTION private.guard_content_archive();

CREATE TRIGGER content_archive_guard BEFORE INSERT OR UPDATE OR DELETE ON public.compliance_acknowledgements FOR EACH ROW EXECUTE FUNCTION private.guard_content_archive();

CREATE TRIGGER content_archive_guard BEFORE INSERT OR UPDATE OR DELETE ON public.compliance_evidence_versions FOR EACH ROW EXECUTE FUNCTION private.guard_content_archive();

CREATE TRIGGER content_archive_guard BEFORE INSERT OR UPDATE OR DELETE ON public.compliance_exception_versions FOR EACH ROW EXECUTE FUNCTION private.guard_content_archive();

CREATE TRIGGER content_archive_guard BEFORE INSERT OR UPDATE OR DELETE ON public.compliance_policy_applicability FOR EACH ROW EXECUTE FUNCTION private.guard_content_archive();

CREATE TRIGGER content_archive_guard BEFORE UPDATE OR DELETE ON public.compliance_policy_versions FOR EACH ROW EXECUTE FUNCTION private.guard_content_archive();

CREATE TRIGGER content_archive_guard BEFORE INSERT OR UPDATE OR DELETE ON public.compliance_requirements FOR EACH ROW EXECUTE FUNCTION private.guard_content_archive();

CREATE TRIGGER content_archive_guard BEFORE INSERT OR UPDATE OR DELETE ON public.delivery_group_projects FOR EACH ROW EXECUTE FUNCTION private.guard_content_archive();

CREATE TRIGGER content_archive_guard BEFORE INSERT OR UPDATE OR DELETE ON public.delivery_groups FOR EACH ROW EXECUTE FUNCTION private.guard_content_archive();

CREATE TRIGGER content_archive_guard BEFORE INSERT OR UPDATE OR DELETE ON public.development_plan_versions FOR EACH ROW EXECUTE FUNCTION private.guard_content_archive();

CREATE TRIGGER content_archive_guard BEFORE INSERT OR UPDATE OR DELETE ON public.feedback_notes FOR EACH ROW EXECUTE FUNCTION private.guard_content_archive();

CREATE TRIGGER content_archive_guard BEFORE INSERT OR UPDATE OR DELETE ON public.feedback_responses FOR EACH ROW EXECUTE FUNCTION private.guard_content_archive();

CREATE TRIGGER content_archive_guard BEFORE INSERT OR UPDATE OR DELETE ON public.learning_assignment_rules FOR EACH ROW EXECUTE FUNCTION private.guard_content_archive();

CREATE TRIGGER content_archive_guard BEFORE INSERT OR UPDATE OR DELETE ON public.learning_assignments FOR EACH ROW EXECUTE FUNCTION private.guard_content_archive();

CREATE TRIGGER content_archive_guard BEFORE UPDATE OR DELETE ON public.learning_courses FOR EACH ROW EXECUTE FUNCTION private.guard_content_archive();

CREATE TRIGGER content_archive_guard BEFORE INSERT OR UPDATE OR DELETE ON public.learning_module_progress FOR EACH ROW EXECUTE FUNCTION private.guard_content_archive();

CREATE TRIGGER content_archive_guard BEFORE INSERT OR UPDATE OR DELETE ON public.learning_modules FOR EACH ROW EXECUTE FUNCTION private.guard_content_archive();

CREATE TRIGGER content_archive_guard BEFORE INSERT OR UPDATE OR DELETE ON public.learning_progress_history FOR EACH ROW EXECUTE FUNCTION private.guard_content_archive();

CREATE TRIGGER content_archive_guard BEFORE INSERT OR UPDATE OR DELETE ON public.learning_resources FOR EACH ROW EXECUTE FUNCTION private.guard_content_archive();

CREATE TRIGGER content_archive_guard BEFORE INSERT OR UPDATE OR DELETE ON public.meeting_participants FOR EACH ROW EXECUTE FUNCTION private.guard_content_archive();

CREATE TRIGGER content_archive_guard BEFORE INSERT OR UPDATE OR DELETE ON public.meeting_private_notes FOR EACH ROW EXECUTE FUNCTION private.guard_content_archive();

CREATE TRIGGER content_archive_guard BEFORE INSERT OR UPDATE OR DELETE ON public.meeting_records FOR EACH ROW EXECUTE FUNCTION private.guard_content_archive();

CREATE TRIGGER content_archive_guard BEFORE UPDATE OR DELETE ON public.meeting_sessions FOR EACH ROW EXECUTE FUNCTION private.guard_content_archive();

CREATE TRIGGER content_archive_guard BEFORE INSERT OR UPDATE OR DELETE ON public.meeting_work_links FOR EACH ROW EXECUTE FUNCTION private.guard_content_archive();

CREATE TRIGGER content_archive_guard BEFORE INSERT OR UPDATE OR DELETE ON public.performance_review_release_requests FOR EACH ROW EXECUTE FUNCTION private.guard_content_archive();

CREATE TRIGGER content_archive_guard BEFORE INSERT OR UPDATE OR DELETE ON public.strategy_delivery_links FOR EACH ROW EXECUTE FUNCTION private.guard_content_archive();

CREATE TRIGGER content_archive_guard BEFORE INSERT OR UPDATE OR DELETE ON public.strategy_node_revisions FOR EACH ROW EXECUTE FUNCTION private.guard_content_archive();

CREATE TRIGGER content_archive_guard BEFORE UPDATE OR DELETE ON public.strategy_nodes FOR EACH ROW EXECUTE FUNCTION private.guard_content_archive();

CREATE TRIGGER content_archive_guard BEFORE INSERT OR UPDATE OR DELETE ON public.training_records FOR EACH ROW EXECUTE FUNCTION private.guard_content_archive();

CREATE OR REPLACE FUNCTION public.stage2_validate_appraisal_hr_exception()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
 IF NEW.authorised_by IS DISTINCT FROM auth.uid()
    OR NOT public.app_is_admin()
    OR NOT public.app_has_capability('people.manage',NULL)
    OR NOT EXISTS(SELECT 1 FROM private.content_live_appraisals a
      WHERE a.id=NEW.appraisal_id AND a.org_id=NEW.org_id
        AND a.status NOT IN ('shared','closed') AND a.profile_id<>auth.uid())
 THEN RAISE EXCEPTION 'Independent HR authority is required for an attributable review exception.'
   USING ERRCODE='42501'; END IF;
 NEW.created_at:=clock_timestamp();
 INSERT INTO public.activity_events(org_id,actor_id,verb,object_type,object_id,meta)
 VALUES(NEW.org_id,NEW.authorised_by,'appraisal_review_exception_recorded',
 'appraisal',NEW.appraisal_id,jsonb_build_object('kind',NEW.reason_kind,'reason',NEW.reason));
 RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.stage2_validate_human_appraisal_rating()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
 v_review public.appraisals%rowtype;
 v_cycle public.appraisal_cycles%rowtype;
 v_latest uuid;
 v_dimension text;
 v_record jsonb;
 v_rating text;
 v_evidence text;
 v_evidence_uuid uuid;
BEGIN
 SELECT * INTO v_review FROM private.content_live_appraisals
 WHERE id=NEW.appraisal_id AND org_id=NEW.org_id FOR UPDATE;
 IF v_review.id IS NULL OR auth.uid() IS NULL
    OR v_review.manager_id IS DISTINCT FROM auth.uid()
    OR NEW.reviewer_id IS DISTINCT FROM auth.uid()
    OR NEW.profile_id IS DISTINCT FROM v_review.profile_id
    OR v_review.profile_id=auth.uid()
    OR v_review.status IN ('closed','shared')
 THEN RAISE EXCEPTION 'Only the independently assigned reviewer may record an active review.'
   USING ERRCODE='42501'; END IF;
 SELECT * INTO v_cycle FROM private.content_live_appraisal_cycles
 WHERE id=v_review.cycle_id AND org_id=v_review.org_id;
 IF v_cycle.id IS NULL OR v_cycle.stage2_cadence NOT IN ('month','quarter')
    OR NEW.cadence IS DISTINCT FROM v_cycle.stage2_cadence
 THEN RAISE EXCEPTION 'Human ratings require the calendar-aligned review cadence.'
   USING ERRCODE='42501'; END IF;
 SELECT id INTO v_latest FROM private.content_live_appraisal_entries
 WHERE appraisal_id=v_review.id AND org_id=v_review.org_id
   AND entry_type='manager_assessment' AND created_by=auth.uid()
 ORDER BY created_at DESC,id DESC LIMIT 1;
 IF v_latest IS NULL OR NEW.assessment_entry_id IS DISTINCT FROM v_latest
 THEN RAISE EXCEPTION 'First record the current Manager-authored assessment and attach ratings to that version.'
   USING ERRCODE='42501'; END IF;
 IF EXISTS (
  SELECT 1 FROM private.content_live_performance_review_release_requests req
  WHERE req.appraisal_id=v_review.id AND req.requested_assessment_id=v_latest
    AND req.state IN ('pending','approved')
 ) THEN RAISE EXCEPTION 'An HR review or approved publication exists. Revise the assessment before changing ratings.'
   USING ERRCODE='42501'; END IF;

 FOREACH v_dimension IN ARRAY ARRAY['delivery','quality','reliability','initiative','collaboration'] LOOP
  v_record:=NEW.category_ratings->v_dimension;
  IF v_record IS NULL THEN
    IF NEW.cadence='quarter' THEN
      RAISE EXCEPTION 'Quarterly Manager review requires category %.',v_dimension;
    END IF;
    CONTINUE;
  END IF;
  IF jsonb_typeof(v_record)<>'object' THEN
    RAISE EXCEPTION 'Each category must be an object.'; END IF;
  v_rating:=v_record->>'rating';
  IF v_rating IS NULL OR v_rating NOT IN ('1','2','3','4','5','N/O')
    OR length(btrim(coalesce(v_record->>'reason','')))<4
  THEN RAISE EXCEPTION 'Category % needs a human-selected 1-5/N/O rating and specific explanation.',v_dimension;
  END IF;
  IF jsonb_typeof(v_record->'evidenceIds') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Category % must explicitly list its evidence IDs.',v_dimension;
  END IF;
  IF v_rating<>'N/O' AND jsonb_array_length(v_record->'evidenceIds')=0 THEN
    RAISE EXCEPTION 'Category % needs real linked evidence or an explained N/O.',v_dimension;
  END IF;
  FOR v_evidence IN SELECT jsonb_array_elements_text(v_record->'evidenceIds') LOOP
    IF v_evidence !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      RAISE EXCEPTION 'An evidence identifier is malformed.'; END IF;
    v_evidence_uuid:=v_evidence::uuid;
    IF NOT EXISTS (
      SELECT 1 FROM private.content_live_appraisal_evidence_items ev
      WHERE ev.id=v_evidence_uuid AND ev.appraisal_id=v_review.id
        AND ev.org_id=v_review.org_id AND ev.profile_id=v_review.profile_id
    ) THEN RAISE EXCEPTION 'Evidence must belong to this employee review.'
      USING ERRCODE='42501'; END IF;
  END LOOP;
 END LOOP;
 IF EXISTS (
   SELECT 1 FROM jsonb_object_keys(NEW.category_ratings) key
   WHERE key NOT IN ('delivery','quality','reliability','initiative','collaboration')
 ) THEN RAISE EXCEPTION 'Unapproved appraisal rubric category.'; END IF;
 IF NEW.cadence='quarter' OR NEW.overall_rating IS NOT NULL THEN
  IF NEW.overall_rating NOT IN ('1','2','3','4','5','N/O')
    OR length(btrim(coalesce(NEW.overall_narrative,'')))<8
    OR length(btrim(coalesce(NEW.strengths,'')))<3
    OR length(btrim(coalesce(NEW.challenges,'')))<3
    OR length(btrim(coalesce(NEW.next_actions,'')))<3
  THEN RAISE EXCEPTION 'Human-selected overall rating, narrative, strengths, challenges and next actions required.';
  END IF;
 END IF;
 IF NEW.cadence='quarter' AND NOT EXISTS (
  SELECT 1 FROM private.content_live_appraisal_entries ent
  WHERE ent.appraisal_id=v_review.id AND ent.org_id=v_review.org_id
    AND ent.entry_type='employee_reflection' AND ent.created_by=v_review.profile_id
 ) AND NOT EXISTS (
  SELECT 1 FROM private.content_live_appraisal_review_exceptions exc
  WHERE exc.appraisal_id=v_review.id AND exc.org_id=v_review.org_id
    AND exc.reason_kind='employee_nonresponse'
 ) THEN
   RAISE EXCEPTION 'Quarterly review requires a genuine employee reflection or independently authorised exception.'
   USING ERRCODE='42501';
 END IF;
 NEW.created_at:=clock_timestamp();
 RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.stage2_require_quarterly_ratings_for_release()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_kind text;
BEGIN
 SELECT c.stage2_cadence INTO v_kind
 FROM private.content_live_appraisals a JOIN private.content_live_appraisal_cycles c
 ON c.id=a.cycle_id AND c.org_id=a.org_id
 WHERE a.id=NEW.appraisal_id AND a.org_id=NEW.org_id;
 IF v_kind='quarter' AND NOT EXISTS (
  SELECT 1 FROM private.content_live_appraisal_human_rating_versions r
  WHERE r.appraisal_id=NEW.appraisal_id AND r.org_id=NEW.org_id
    AND r.assessment_entry_id=NEW.requested_assessment_id
    AND r.cadence='quarter'
 ) THEN
  RAISE EXCEPTION 'Quarterly review requires completed human-entered Manager category and overall ratings before independent HR release.'
   USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.strategy_delivery_link_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_actor uuid:=auth.uid();
  v_unit uuid;
  v_node_org uuid;
  v_project_org uuid;
begin
  if v_actor is null then
    raise exception 'Sign in to change strategy delivery links.' using errcode='42501';
  end if;

  select n.unit_id,n.org_id into v_unit,v_node_org
  from private.content_live_strategy_nodes n
  where n.id=new.strategy_node_id and n.node_type='unit_objective';

  select p.org_id into v_project_org
  from public.projects p
  where p.id=new.project_id;

  if v_node_org is null or v_project_org is null
     or v_node_org is distinct from new.org_id
     or v_project_org is distinct from new.org_id
     or new.org_id is distinct from public.app_org_id() then
    raise exception 'Strategy delivery links must stay inside the same organisation.' using errcode='42501';
  end if;

  if not (
    public.app_has_capability('strategy.manage',null)
    or v_unit in (select public.app_managed_units())
  ) then
    raise exception 'You do not have authority to link delivery for that Unit Objective.' using errcode='42501';
  end if;

  if length(btrim(coalesce(new.change_reason,'')))<3 then
    raise exception 'A reason is required for every strategy delivery change.';
  end if;

  if tg_op='INSERT' then
    new.created_by:=v_actor;
    new.updated_by:=v_actor;
  else
    if old.org_id is distinct from new.org_id
       or old.strategy_node_id is distinct from new.strategy_node_id
       or old.project_id is distinct from new.project_id
       or old.created_by is distinct from new.created_by
       or old.created_at is distinct from new.created_at then
      raise exception 'Strategy delivery-link identity is immutable.' using errcode='42501';
    end if;
    if old.status='withdrawn' and new.status<>'withdrawn' then
      raise exception 'A withdrawn delivery link cannot be reactivated. Create a new attributable link instead.';
    end if;
    new.updated_by:=v_actor;
    new.updated_at:=now();
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.refresh_performance_evidence(p_appraisal_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_org uuid:=public.app_org_id();
  v_actor uuid:=auth.uid();
  v_appraisal public.appraisals;
begin
  select * into v_appraisal
  from private.content_live_appraisals
  where id=p_appraisal_id and org_id=v_org;

  if v_appraisal.id is null then
    raise exception 'Review case not found.' using errcode='42501';
  end if;

  if not (
    public.app_has_capability('performance.admin',null)
    or v_appraisal.manager_id=v_actor
  ) then
    raise exception 'You do not have authority to refresh this evidence pack.' using errcode='42501';
  end if;

  return public.performance_generate_evidence_internal(v_appraisal.id,v_actor);
end;
$function$;

CREATE OR REPLACE FUNCTION public.close_announcement(p_announcement_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare a public.announcements;
begin
  if not public.app_can_publish_announcements() then raise exception 'You are not allowed to close announcements.' using errcode='42501'; end if;
  select * into a from private.content_live_announcements where id=p_announcement_id for update;
  if a.id is null or a.org_id<>public.app_org_id() then raise exception 'That announcement is not available.'; end if;
  if a.status='closed' then raise exception 'That announcement is already closed.'; end if;
  update public.announcements set status='closed',updated_at=now() where id=a.id;
  insert into public.activity_events(org_id,actor_id,verb,object_type,object_id,meta)
  values(a.org_id,auth.uid(),'announcement_closed','announcement',a.id,'{}'::jsonb);
end;
$function$;

CREATE OR REPLACE FUNCTION public.app_can_write_operational_context(p_context_type text, p_context_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      select 1 from private.content_live_announcements a
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
$function$;

CREATE OR REPLACE FUNCTION public.update_announcement(p_announcement_id uuid, p_title text, p_body text, p_priority text, p_requires_acknowledgement boolean, p_expires_at timestamp with time zone, p_all_org boolean, p_unit_ids uuid[], p_roles text[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  a public.announcements;
  v_unit uuid;
  v_role text;
begin
  if not public.app_can_publish_announcements() then
    raise exception 'You are not allowed to edit announcements.' using errcode='42501';
  end if;
  select * into a from private.content_live_announcements where id=p_announcement_id for update;
  if a.id is null or a.org_id<>public.app_org_id() then raise exception 'That announcement is not available.'; end if;
  if a.status<>'draft' then raise exception 'Only a draft announcement can be edited.'; end if;
  if nullif(btrim(p_title),'') is null or nullif(btrim(p_body),'') is null then raise exception 'Add a title and message.'; end if;
  if p_priority not in ('normal','important','urgent') then raise exception 'Choose a valid priority.'; end if;
  if not p_all_org and coalesce(cardinality(p_unit_ids),0)=0 and coalesce(cardinality(p_roles),0)=0 then
    raise exception 'Choose at least one audience.';
  end if;
  if exists (
    select 1 from unnest(coalesce(p_unit_ids,'{}'::uuid[])) requested(id)
    left join public.units u on u.id=requested.id and u.org_id=public.app_org_id()
    where u.id is null
  ) then raise exception 'An audience unit is not available in your organisation.'; end if;
  if exists (
    select 1 from unnest(coalesce(p_roles,'{}'::text[])) requested(role)
    where requested.role not in ('staff','sub_team_lead','manager','admin','exec')
  ) then raise exception 'Choose a valid audience role.'; end if;

  update public.announcements
  set title=btrim(p_title),body=btrim(p_body),priority=p_priority,
      requires_acknowledgement=p_requires_acknowledgement,
      expires_at=p_expires_at,updated_at=now()
  where id=a.id;

  delete from public.announcement_audiences where announcement_id=a.id;
  if p_all_org then
    insert into public.announcement_audiences(announcement_id,audience_type)
    values(a.id,'organisation');
  end if;
  foreach v_unit in array coalesce(p_unit_ids,'{}'::uuid[]) loop
    insert into public.announcement_audiences(announcement_id,audience_type,unit_id)
    values(a.id,'unit',v_unit) on conflict do nothing;
  end loop;
  foreach v_role in array coalesce(p_roles,'{}'::text[]) loop
    insert into public.announcement_audiences(announcement_id,audience_type,audience_role)
    values(a.id,'role',v_role) on conflict do nothing;
  end loop;
end;
$function$;

CREATE OR REPLACE FUNCTION public.publish_announcement(p_announcement_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare a public.announcements;
begin
  if not public.app_can_publish_announcements() then raise exception 'You are not allowed to publish announcements.' using errcode='42501'; end if;
  select * into a from private.content_live_announcements where id=p_announcement_id for update;
  if a.id is null or a.org_id<>public.app_org_id() then raise exception 'That announcement is not available.'; end if;
  if a.status<>'draft' then raise exception 'Only a draft announcement can be published.'; end if;
  if not exists(select 1 from private.content_live_announcement_audiences where announcement_id=a.id) then raise exception 'Choose an audience before publishing.'; end if;
  if a.expires_at is not null and a.expires_at<=now() then raise exception 'The expiry must be in the future.'; end if;

  update public.announcements set status='published',published_at=now(),updated_at=now() where id=a.id;
  insert into public.activity_events(org_id,actor_id,verb,object_type,object_id,meta)
  values(a.org_id,auth.uid(),'announcement_published','announcement',a.id,
    jsonb_build_object('requires_acknowledgement',a.requires_acknowledgement));
end;
$function$;

CREATE OR REPLACE FUNCTION public.mark_announcement_read(p_announcement_id uuid, p_acknowledge boolean DEFAULT false)
 RETURNS announcement_receipts
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  a public.announcements;
  r public.announcement_receipts;
begin
  if auth.uid() is null or not public.app_can_read_announcement(p_announcement_id) then
    raise exception 'That announcement is not available to you.' using errcode='42501';
  end if;
  select * into a from private.content_live_announcements where id=p_announcement_id;
  if p_acknowledge and not a.requires_acknowledgement then
    raise exception 'This announcement does not require acknowledgement.';
  end if;

  insert into public.announcement_receipts(announcement_id,profile_id,read_at,acknowledged_at)
  values(a.id,auth.uid(),now(),case when p_acknowledge then now() else null end)
  on conflict(announcement_id,profile_id) do update
    set read_at=least(announcement_receipts.read_at,excluded.read_at),
        acknowledged_at=case
          when p_acknowledge then coalesce(announcement_receipts.acknowledged_at,now())
          else announcement_receipts.acknowledged_at
        end
  returning * into r;

  return r;
end;
$function$;

CREATE OR REPLACE FUNCTION public.announcement_audience_counts(p_announcement_id uuid)
 RETURNS TABLE(target_count bigint, read_count bigint, acknowledged_count bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.app_can_publish_announcements() then
    raise exception 'You are not allowed to view announcement counts.' using errcode='42501';
  end if;
  if not exists(select 1 from private.content_live_announcements where id=p_announcement_id and org_id=public.app_org_id()) then
    raise exception 'That announcement is not available.';
  end if;

  return query
  with targets as (
    select distinct p.id
    from public.profiles p
    where p.org_id=public.app_org_id() and p.active
      and exists (
        select 1 from private.content_live_announcement_audiences aa
        where aa.announcement_id=p_announcement_id
          and (
            aa.audience_type='organisation'
            or (aa.audience_type='unit' and exists (
              select 1 from public.unit_memberships m where m.profile_id=p.id and m.unit_id=aa.unit_id
            ))
            or (aa.audience_type='role' and (
              (aa.audience_role in ('staff','sub_team_lead','manager') and exists (
                select 1 from public.unit_memberships m where m.profile_id=p.id and m.role=aa.audience_role
              ))
              or (aa.audience_role='admin' and p.is_admin)
              or (aa.audience_role='exec' and p.is_exec)
            ))
          )
      )
  )
  select count(t.id),count(r.id),count(r.acknowledged_at)
  from targets t
  left join private.content_live_announcement_receipts r
    on r.announcement_id=p_announcement_id and r.profile_id=t.id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.schedule_meeting(p_scope text, p_unit_id uuid, p_project_id uuid, p_title text, p_agenda text, p_starts_at timestamp with time zone, p_ends_at timestamp with time zone, p_provider text, p_join_url text, p_location text, p_audience jsonb DEFAULT '[]'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_actor uuid:=auth.uid();
  v_org uuid:=public.app_org_id();
  v_meeting uuid:=gen_random_uuid();
  v_audience jsonb:=coalesce(p_audience,'[]'::jsonb);
  v_entry jsonb;
  v_type text;
  v_id uuid;
  v_count integer:=0;
begin
  if v_actor is null or v_org is null then
    raise exception 'Sign in to schedule a meeting.' using errcode='42501';
  end if;

  if p_scope not in ('organisation','unit','project') then
    raise exception 'Choose a valid meeting context.';
  end if;

  if nullif(btrim(coalesce(p_title,'')),'') is null then
    raise exception 'Add a meeting title.';
  end if;

  if p_ends_at is not null and p_ends_at<p_starts_at then
    raise exception 'Meeting end time cannot be before its start.';
  end if;

  if p_provider not in ('zoom','external') then
    raise exception 'Choose a supported meeting provider.';
  end if;

  if p_join_url is not null and p_join_url !~ '^https://' then
    raise exception 'Meeting link must use https.';
  end if;

  if p_scope='organisation' then
    if not (public.app_is_admin() or public.app_is_exec()) then
      raise exception 'Only Administration or the Group Pastor can schedule an organisation meeting.'
        using errcode='42501';
    end if;
    p_unit_id:=null;
    p_project_id:=null;

  elsif p_scope='unit' then
    if p_unit_id is null or not exists(
      select 1 from public.units u
      where u.id=p_unit_id and u.org_id=v_org and u.active
    ) then
      raise exception 'Choose an active unit.';
    end if;

    if not (
      public.app_is_admin()
      or public.app_is_exec()
      or p_unit_id in (select public.app_managed_units())
    ) then
      raise exception 'You cannot schedule for that unit.' using errcode='42501';
    end if;
    p_project_id:=null;

  else
    if p_project_id is null or not exists(
      select 1 from public.projects p
      where p.id=p_project_id and p.org_id=v_org and p.status in ('planned','active')
    ) then
      raise exception 'Choose an active project.';
    end if;

    if not (
      public.app_is_admin()
      or public.app_is_exec()
      or exists(
        select 1 from public.projects p
        where p.id=p_project_id
          and (
            p.lead_unit_id in (select public.app_managed_units())
            or exists(
              select 1 from public.project_units pu
              where pu.project_id=p.id
                and pu.unit_id in (select public.app_managed_units())
            )
          )
      )
    ) then
      raise exception 'You cannot schedule for that project.' using errcode='42501';
    end if;
    p_unit_id:=null;
  end if;

  insert into public.meeting_sessions(
    id,org_id,scope,unit_id,project_id,title,agenda,starts_at,ends_at,
    provider,join_url,location,status,created_by
  ) values(
    v_meeting,v_org,p_scope,p_unit_id,p_project_id,btrim(p_title),
    nullif(btrim(coalesce(p_agenda,'')),''),
    p_starts_at,p_ends_at,p_provider,
    nullif(btrim(coalesce(p_join_url,'')),''),
    nullif(btrim(coalesce(p_location,'')),''),
    'scheduled',v_actor
  );

  insert into public.meeting_participants(
    meeting_id,profile_id,role,source_type,source_id,invited_by
  ) values(v_meeting,v_actor,'organiser','organiser',null,v_actor)
  on conflict do nothing;

  if jsonb_array_length(v_audience)=0 then
    if p_scope='organisation' then
      v_audience:=jsonb_build_array(jsonb_build_object('type','organisation','id',null));
    elsif p_scope='unit' then
      v_audience:=jsonb_build_array(jsonb_build_object('type','unit','id',p_unit_id));
    else
      v_audience:=jsonb_build_array(jsonb_build_object('type','project','id',p_project_id));
    end if;
  end if;

  for v_entry in select * from jsonb_array_elements(v_audience) loop
    v_type:=v_entry->>'type';
    v_id:=nullif(v_entry->>'id','')::uuid;

    if v_type='organisation' then
      if p_scope<>'organisation' or not (public.app_is_admin() or public.app_is_exec()) then
        raise exception 'Organisation audience is not available here.' using errcode='42501';
      end if;
      insert into public.meeting_participants(meeting_id,profile_id,source_type,source_id,invited_by)
      select v_meeting,p.id,'organisation',null,v_actor
      from public.profiles p
      where p.org_id=v_org and p.active
      on conflict do nothing;

    elsif v_type='unit' then
      if v_id is null or not exists(
        select 1 from public.units u where u.id=v_id and u.org_id=v_org and u.active
      ) then
        raise exception 'A selected unit is not available.';
      end if;

      if not (
        public.app_is_admin()
        or public.app_is_exec()
        or v_id in (select public.app_managed_units())
        or (
          p_scope='project'
          and exists(
            select 1
            from public.projects pr
            where pr.id=p_project_id
              and (
                pr.lead_unit_id=v_id
                or exists(select 1 from public.project_units pu where pu.project_id=pr.id and pu.unit_id=v_id)
              )
          )
        )
      ) then
        raise exception 'You cannot invite that unit.' using errcode='42501';
      end if;

      insert into public.meeting_participants(meeting_id,profile_id,source_type,source_id,invited_by)
      select v_meeting,um.profile_id,'unit',v_id,v_actor
      from public.unit_memberships um
      join public.profiles p on p.id=um.profile_id
      where um.org_id=v_org and um.unit_id=v_id and p.active
      on conflict do nothing;

    elsif v_type='sub_team' then
      if v_id is null or not exists(
        select 1 from public.sub_teams st
        where st.id=v_id and st.org_id=v_org and st.active
      ) then
        raise exception 'A selected sub-team is not available.';
      end if;

      if not (
        public.app_is_admin()
        or public.app_is_exec()
        or exists(
          select 1 from public.sub_teams st
          where st.id=v_id and st.unit_id in (select public.app_managed_units())
        )
      ) then
        raise exception 'You cannot invite that sub-team.' using errcode='42501';
      end if;

      insert into public.meeting_participants(meeting_id,profile_id,source_type,source_id,invited_by)
      select v_meeting,stm.profile_id,'sub_team',v_id,v_actor
      from public.sub_team_members stm
      join public.profiles p on p.id=stm.profile_id
      where stm.sub_team_id=v_id and p.org_id=v_org and p.active
      union
      select v_meeting,st.lead_id,'sub_team',v_id,v_actor
      from public.sub_teams st
      join public.profiles p on p.id=st.lead_id
      where st.id=v_id and st.lead_id is not null and p.active
      on conflict do nothing;

    elsif v_type='project' then
      if p_scope<>'project' or v_id is distinct from p_project_id then
        raise exception 'Project audience must match the meeting project.';
      end if;

      insert into public.meeting_participants(meeting_id,profile_id,source_type,source_id,invited_by)
      select distinct v_meeting,um.profile_id,'project',p_project_id,v_actor
      from public.projects pr
      join public.unit_memberships um
        on um.org_id=pr.org_id
       and (
         um.unit_id=pr.lead_unit_id
         or exists(
           select 1 from public.project_units pu
           where pu.project_id=pr.id and pu.unit_id=um.unit_id
         )
       )
      join public.profiles p on p.id=um.profile_id and p.active
      where pr.id=p_project_id
      on conflict do nothing;

    elsif v_type='project_managers' then
      if p_scope<>'project' or v_id is distinct from p_project_id then
        raise exception 'Project manager audience must match the meeting project.';
      end if;

      insert into public.meeting_participants(meeting_id,profile_id,source_type,source_id,invited_by)
      select distinct v_meeting,um.profile_id,'project_managers',p_project_id,v_actor
      from public.projects pr
      join public.unit_memberships um
        on um.org_id=pr.org_id
       and um.role='manager'
       and (
         um.unit_id=pr.lead_unit_id
         or exists(
           select 1 from public.project_units pu
           where pu.project_id=pr.id and pu.unit_id=um.unit_id
         )
       )
      join public.profiles p on p.id=um.profile_id and p.active
      where pr.id=p_project_id
      on conflict do nothing;

    elsif v_type='selected' then
      if v_id is null or not exists(
        select 1 from public.profiles p
        where p.id=v_id and p.org_id=v_org and p.active
      ) then
        raise exception 'A selected person is not available.';
      end if;

      if not (
        public.app_is_admin()
        or public.app_is_exec()
        or exists(
          select 1 from public.unit_memberships um
          where um.profile_id=v_id
            and um.unit_id in (select public.app_managed_units())
        )
        or (
          p_scope='project'
          and exists(
            select 1
            from public.unit_memberships invitee
            join public.projects pr on pr.id=p_project_id
            where invitee.profile_id=v_id
              and invitee.role='manager'
              and (
                invitee.unit_id=pr.lead_unit_id
                or exists(
                  select 1 from public.project_units pu
                  where pu.project_id=pr.id and pu.unit_id=invitee.unit_id
                )
              )
          )
        )
      ) then
        raise exception 'You cannot invite that person.' using errcode='42501';
      end if;

      insert into public.meeting_participants(meeting_id,profile_id,source_type,source_id,invited_by)
      values(v_meeting,v_id,'selected',v_id,v_actor)
      on conflict do nothing;

    else
      raise exception 'Unsupported meeting audience type.';
    end if;
  end loop;

  select count(*) into v_count
  from private.content_live_meeting_participants
  where meeting_id=v_meeting;

  if v_count<1 then
    raise exception 'A meeting must have at least one participant.';
  end if;

  return v_meeting;
end;
$function$;

CREATE OR REPLACE FUNCTION public.learning_apply_rule_internal(p_rule_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_rule public.learning_assignment_rules;
  v_profile_id uuid;
  v_count integer:=0;
  v_assignment uuid;
begin
  select * into v_rule
  from private.content_live_learning_assignment_rules
  where id=p_rule_id and active;

  if v_rule.id is null then return 0; end if;

  if v_rule.target_kind='person' then
    v_assignment:=public.learning_materialise_assignment(v_rule.id,v_rule.target_profile_id);
    if v_assignment is not null then v_count:=v_count+1; end if;
    return v_count;
  end if;

  if v_rule.target_kind='unit' then
    for v_profile_id in
      select er.profile_id
      from public.employment_records er
      join public.profiles p on p.id=er.profile_id and p.org_id=er.org_id
      where er.org_id=v_rule.org_id
        and er.unit_id=v_rule.target_unit_id
        and er.employment_status='active'
        and p.active and not p.is_exec
    loop
      v_assignment:=public.learning_materialise_assignment(v_rule.id,v_profile_id);
      if v_assignment is not null then v_count:=v_count+1; end if;
    end loop;
    return v_count;
  end if;

  if v_rule.target_kind='role' then
    for v_profile_id in
      select er.profile_id
      from public.employment_records er
      join public.profiles p on p.id=er.profile_id and p.org_id=er.org_id
      where er.org_id=v_rule.org_id
        and er.membership_role=v_rule.target_role
        and er.employment_status='active'
        and p.active and not p.is_exec
    loop
      v_assignment:=public.learning_materialise_assignment(v_rule.id,v_profile_id);
      if v_assignment is not null then v_count:=v_count+1; end if;
    end loop;
    return v_count;
  end if;

  if v_rule.target_kind='onboarding' then
    for v_profile_id in
      select distinct c.profile_id
      from public.employee_lifecycle_cases c
      join public.profiles p on p.id=c.profile_id and p.org_id=c.org_id
      where c.org_id=v_rule.org_id
        and c.lifecycle_type='onboarding'
        and c.state='active'
        and p.active and not p.is_exec
    loop
      v_assignment:=public.learning_materialise_assignment(v_rule.id,v_profile_id);
      if v_assignment is not null then v_count:=v_count+1; end if;
    end loop;
  end if;

  return v_count;
end;
$function$;

CREATE OR REPLACE FUNCTION public.learning_employment_rule_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_rule_id uuid;
begin
  if new.employment_status='active' then
    for v_rule_id in
      select r.id
      from private.content_live_learning_assignment_rules r
      where r.org_id=new.org_id
        and r.active
        and (
          (r.target_kind='person' and r.target_profile_id=new.profile_id)
          or (r.target_kind='unit' and r.target_unit_id=new.unit_id)
          or (r.target_kind='role' and r.target_role=new.membership_role)
        )
    loop
      perform public.learning_materialise_assignment(v_rule_id,new.profile_id);
    end loop;
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.app_can_manage_meeting(p_meeting_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select auth.uid() is not null
    and exists (
      select 1
      from private.content_live_meeting_sessions m
      where m.id=p_meeting_id
        and m.org_id=public.app_org_id()
        and (
          public.app_is_admin()
          or public.app_is_exec()
          or m.created_by=auth.uid()
          or exists (
            select 1
            from private.content_live_meeting_participants mp
            where mp.meeting_id=m.id
              and mp.profile_id=auth.uid()
              and mp.role='organiser'
          )
          or (
            m.scope='unit'
            and m.unit_id in (select public.app_managed_units())
          )
          or (
            m.scope='project'
            and exists (
              select 1
              from public.projects p
              where p.id=m.project_id
                and (
                  p.lead_unit_id in (select public.app_managed_units())
                  or exists (
                    select 1
                    from public.project_units pu
                    where pu.project_id=p.id
                      and pu.unit_id in (select public.app_managed_units())
                  )
                )
            )
          )
        )
    );
$function$;

CREATE OR REPLACE FUNCTION public.learning_onboarding_rule_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_rule_id uuid;
begin
  if new.lifecycle_type='onboarding' and new.state='active' then
    for v_rule_id in
      select r.id
      from private.content_live_learning_assignment_rules r
      where r.org_id=new.org_id
        and r.active
        and r.target_kind='onboarding'
    loop
      perform public.learning_materialise_assignment(v_rule_id,new.profile_id);
    end loop;
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_employee_published_development(p_profile_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_org uuid:=public.app_org_id(); v_rows jsonb;
BEGIN
 IF auth.uid() IS NULL OR v_org IS NULL
  OR NOT public.app_stage2_universal_aal_allowed()
  OR NOT public.app_is_admin()
  OR NOT public.app_has_capability('people.manage',NULL) THEN
  RAISE EXCEPTION 'Authorised HR employee dossier access required.' USING errcode='42501';
 END IF;
 IF p_profile_id IS NULL THEN
  RAISE EXCEPTION 'Select a linked employee before opening development history.' USING errcode='22023';
 END IF;

 SELECT coalesce(jsonb_agg(
   jsonb_build_object(
    'id',rated.id,'cadence',rated.cadence,'overall_rating',rated.overall_rating,
    'overall_narrative',rated.overall_narrative,'strengths',rated.strengths,
    'challenges',rated.challenges,'next_actions',rated.next_actions,
    'created_at',rated.created_at
   ) ORDER BY rated.created_at DESC,rated.id DESC
 ),'[]'::jsonb)
 INTO v_rows
 FROM (
  SELECT r.id,r.cadence,r.overall_rating,r.overall_narrative,
   r.strengths,r.challenges,r.next_actions,r.created_at
  FROM private.content_live_appraisal_human_rating_versions r
  JOIN private.content_live_appraisals a ON a.id=r.appraisal_id
    AND a.org_id=r.org_id AND a.profile_id=r.profile_id
  WHERE a.org_id=v_org AND a.profile_id=p_profile_id
   AND a.status IN ('shared','closed')
   AND EXISTS(
    SELECT 1 FROM private.content_live_performance_review_release_requests d
    WHERE d.appraisal_id=a.id AND d.org_id=a.org_id
     AND d.requested_assessment_id=r.assessment_entry_id
     AND d.state='approved' AND d.decided_at IS NOT NULL
   )
  ORDER BY r.created_at DESC,r.id DESC
  LIMIT 501
 ) rated;
 IF jsonb_array_length(v_rows)>500 THEN
  RAISE EXCEPTION 'Published employee development history exceeds verified retrieval limit.' USING errcode='54000';
 END IF;
 RETURN v_rows;
END
$function$;

CREATE OR REPLACE FUNCTION public.delivery_group_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_actor uuid:=auth.uid();
  v_parent_kind text;
  v_parent_org uuid;
begin
  if v_actor is null then
    raise exception 'Sign in to change delivery groups.' using errcode='42501';
  end if;
  if new.org_id is distinct from public.app_org_id() then
    raise exception 'Delivery groups must stay in your organisation.' using errcode='42501';
  end if;

  if tg_op='INSERT' then
    new.created_by:=v_actor;
    new.updated_by:=v_actor;
  else
    if old.org_id is distinct from new.org_id
       or old.created_by is distinct from new.created_by
       or old.created_at is distinct from new.created_at then
      raise exception 'Delivery group identity fields are immutable.' using errcode='42501';
    end if;
    new.updated_by:=v_actor;
    new.updated_at:=now();
  end if;

  if new.unit_id is not null and not exists(
    select 1 from public.units u where u.id=new.unit_id and u.org_id=new.org_id
  ) then
    raise exception 'That delivery-group unit does not belong to this organisation.' using errcode='42501';
  end if;

  if new.owner_profile_id is not null and not exists(
    select 1 from public.profiles p where p.id=new.owner_profile_id and p.org_id=new.org_id
  ) then
    raise exception 'That delivery-group owner does not belong to this organisation.' using errcode='42501';
  end if;

  if new.strategy_node_id is not null and not exists(
    select 1 from private.content_live_strategy_nodes n where n.id=new.strategy_node_id and n.org_id=new.org_id
  ) then
    raise exception 'That strategy record does not belong to this organisation.' using errcode='42501';
  end if;

  if new.kind='portfolio' and new.parent_group_id is not null then
    raise exception 'A Portfolio cannot have a parent in Stage 5.';
  end if;

  if new.parent_group_id is not null then
    select g.kind,g.org_id into v_parent_kind,v_parent_org
    from private.content_live_delivery_groups g where g.id=new.parent_group_id;
    if v_parent_kind is distinct from 'portfolio' or v_parent_org is distinct from new.org_id then
      raise exception 'A Programme parent must be a Portfolio in the same organisation.';
    end if;
    if new.kind<>'programme' then
      raise exception 'Only a Programme can sit under a Portfolio.';
    end if;
  end if;

  if not (
    public.app_is_admin()
    or public.app_is_exec()
    or public.app_has_capability('delivery.manage',null)
    or (new.unit_id is not null and new.unit_id in (select public.app_managed_units()))
  ) then
    raise exception 'You do not have authority to manage that Programme or Portfolio.' using errcode='42501';
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.delivery_group_project_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_actor uuid:=auth.uid();
  v_group_org uuid;
  v_project_org uuid;
begin
  if v_actor is null then
    raise exception 'Sign in to change delivery membership.' using errcode='42501';
  end if;

  select org_id into v_group_org from private.content_live_delivery_groups where id=new.delivery_group_id;
  select org_id into v_project_org from public.projects where id=new.project_id;

  if v_group_org is null or v_project_org is null
     or v_group_org is distinct from new.org_id
     or v_project_org is distinct from new.org_id
     or new.org_id is distinct from public.app_org_id() then
    raise exception 'Programme/Portfolio project links must stay inside one organisation.' using errcode='42501';
  end if;

  if tg_op='INSERT' then
    new.created_by:=v_actor;
    new.updated_by:=v_actor;
  else
    if old.org_id is distinct from new.org_id
       or old.delivery_group_id is distinct from new.delivery_group_id
       or old.project_id is distinct from new.project_id
       or old.created_by is distinct from new.created_by
       or old.created_at is distinct from new.created_at then
      raise exception 'Delivery membership identity is immutable.' using errcode='42501';
    end if;
    if old.state='withdrawn' and new.state<>'withdrawn' then
      raise exception 'A withdrawn delivery link cannot be reactivated. Create a new link instead.';
    end if;
    new.updated_by:=v_actor;
    new.updated_at:=now();
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.strategy_node_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_actor uuid:=auth.uid();
  v_parent_type text;
  v_parent_org uuid;
begin
  if v_actor is null then
    raise exception 'Sign in to change strategy.' using errcode='42501';
  end if;

  if new.org_id is distinct from public.app_org_id() then
    raise exception 'Strategy must belong to your organisation.' using errcode='42501';
  end if;

  if tg_op='INSERT' then
    new.created_by:=v_actor;
    new.updated_by:=v_actor;
    new.created_at:=coalesce(new.created_at,now());
  else
    if old.org_id is distinct from new.org_id
       or old.created_by is distinct from new.created_by
       or old.created_at is distinct from new.created_at then
      raise exception 'Strategy record identity fields are immutable.' using errcode='42501';
    end if;
    new.updated_by:=v_actor;
    new.updated_at:=now();
  end if;

  if length(btrim(coalesce(new.change_reason,'')))<3 then
    raise exception 'A reason is required for every strategy change.';
  end if;

  if new.node_type in ('ministry_direction','ministry_objective') then
    if not (public.app_is_exec() or public.app_has_capability('strategy.manage',null)) then
      raise exception 'You do not have authority to change ministry-level strategy.' using errcode='42501';
    end if;
  elsif new.node_type='unit_objective' then
    if not (
      public.app_has_capability('strategy.manage',null)
      or new.unit_id in (select public.app_managed_units())
    ) then
      raise exception 'You do not manage that unit objective.' using errcode='42501';
    end if;
  end if;

  if new.node_type='ministry_direction' then
    if new.parent_id is not null or new.unit_id is not null then
      raise exception 'A Ministry Direction cannot have a parent or unit.';
    end if;
  else
    select node_type,org_id into v_parent_type,v_parent_org
    from private.content_live_strategy_nodes
    where id=new.parent_id;

    if v_parent_type is null or v_parent_org is distinct from new.org_id then
      raise exception 'The strategy parent is not available in this organisation.' using errcode='42501';
    end if;

    if new.node_type='ministry_objective' and v_parent_type<>'ministry_direction' then
      raise exception 'A Ministry Objective must sit under a Ministry Direction.';
    end if;

    if new.node_type='unit_objective' and v_parent_type<>'ministry_objective' then
      raise exception 'A Unit Objective must sit under a Ministry Objective.';
    end if;

    if new.node_type='unit_objective' and not exists(
      select 1 from public.units u where u.id=new.unit_id and u.org_id=new.org_id
    ) then
      raise exception 'That unit does not belong to this organisation.' using errcode='42501';
    end if;
  end if;

  if new.owner_profile_id is not null and not exists(
    select 1 from public.profiles p
    where p.id=new.owner_profile_id and p.org_id=new.org_id
  ) then
    raise exception 'The strategy owner does not belong to this organisation.' using errcode='42501';
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.strategy_node_revision_capture()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_revision integer;
begin
  select coalesce(max(r.revision),0)+1 into v_revision
  from private.content_live_strategy_node_revisions r
  where r.strategy_node_id=new.id;

  insert into public.strategy_node_revisions(
    org_id,strategy_node_id,revision,node_type,parent_id,unit_id,name,statement,
    measurement_kind,measure_label,target_value,target_unit,current_value,
    starts_on,target_on,status,owner_profile_id,change_reason,changed_by,changed_at
  ) values (
    new.org_id,new.id,v_revision,new.node_type,new.parent_id,new.unit_id,new.name,new.statement,
    new.measurement_kind,new.measure_label,new.target_value,new.target_unit,new.current_value,
    new.starts_on,new.target_on,new.status,new.owner_profile_id,new.change_reason,new.updated_by,now()
  );
  return new;
end;
$function$;

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
  from private.content_live_appraisals
  where id=p_appraisal_id;

  if v_appraisal.id is null then
    raise exception 'Review case not found.';
  end if;

  select * into v_cycle
  from private.content_live_appraisal_cycles
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
  from private.content_live_strategy_nodes s
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
  from private.content_live_training_records tr
  where tr.org_id=v_appraisal.org_id
    and tr.profile_id=v_appraisal.profile_id
    and tr.completed_on is not null
    and tr.completed_on between v_cycle.starts_on and v_cycle.ends_on
  on conflict(appraisal_id,source_type,source_id) do nothing;
  get diagnostics v_count=row_count;
  v_inserted:=v_inserted+v_count;

  return v_inserted;
end;
$function$;

CREATE OR REPLACE FUNCTION public.assign_performance_reviewer(p_appraisal_id uuid, p_reviewer_id uuid, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid:=public.app_org_id();
  v_actor uuid:=auth.uid();
  v_appraisal public.appraisals;
  v_subject public.profiles;
  v_reviewer public.profiles;
  v_ok boolean:=false;
BEGIN
  IF v_actor IS NULL OR NOT public.app_has_capability('performance.admin',NULL) THEN
    RAISE EXCEPTION 'You do not have authority to assign review responsibility.' USING ERRCODE='42501';
  END IF;
  IF length(btrim(coalesce(p_reason,'')))<3 THEN
    RAISE EXCEPTION 'A reason is required.';
  END IF;
  SELECT * INTO v_appraisal FROM private.content_live_appraisals
    WHERE id=p_appraisal_id AND org_id=v_org FOR UPDATE;
  IF v_appraisal.id IS NULL OR v_appraisal.status IN ('shared','closed') THEN
    RAISE EXCEPTION 'Open review case not found.' USING ERRCODE='42501';
  END IF;
  SELECT * INTO v_subject FROM public.profiles
    WHERE id=v_appraisal.profile_id AND org_id=v_org AND active;
  SELECT * INTO v_reviewer FROM public.profiles
    WHERE id=p_reviewer_id AND org_id=v_org AND active;
  IF v_subject.id IS NULL OR v_reviewer.id IS NULL
     OR v_subject.id=v_reviewer.id THEN
    RAISE EXCEPTION 'Only a different active authorised person may review this employee.' USING ERRCODE='42501';
  END IF;

  IF v_subject.is_admin THEN
    -- The Group Pastor is the reviewed *individual* exception. Executive role
    -- alone or a job title alone grants nothing: both must hold and HR must
    -- explicitly assign this particular case, with an attributable reason.
    -- No capability or access to any other HR record is granted.
    v_ok:=v_reviewer.is_exec
      AND lower(btrim(coalesce(v_reviewer.job_title,'')))='group pastor'
      AND NOT v_reviewer.is_admin;
  ELSE
    -- All ordinary employee reviews retain the former Administration/Manager
    -- eligibility, with an additional no-self-review constraint.
    v_ok:=v_reviewer.is_admin OR EXISTS(
      SELECT 1 FROM public.unit_memberships um
      WHERE um.profile_id=v_reviewer.id AND um.org_id=v_org
        AND um.unit_id=v_appraisal.unit_id AND um.role='manager'
    );
  END IF;
  IF NOT v_ok THEN
    RAISE EXCEPTION 'The requested reviewer is not authorised for this employee review.' USING ERRCODE='42501';
  END IF;

  UPDATE public.appraisals
  SET manager_id=v_reviewer.id,
      reviewer_assigned_by=v_actor,
      reviewer_assigned_at=now(),
      reviewer_assignment_reason=btrim(p_reason)
  WHERE id=v_appraisal.id;

  -- Preserve an attributable record even if the person initially had no
  -- employment-record Manager; assigning this case does not change the roster.
  INSERT INTO public.activity_events(org_id,actor_id,verb,object_type,object_id,meta)
  VALUES(v_org,v_actor,'performance_reviewer_assigned','appraisal',v_appraisal.id,
         jsonb_build_object('reviewer_id',v_reviewer.id,
          'subject_id',v_appraisal.profile_id,'reason',btrim(p_reason)));
END;
$function$;

CREATE OR REPLACE FUNCTION public.record_appraisal_entry(p_appraisal_id uuid, p_entry_type text, p_body text, p_supersedes_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_org uuid:=public.app_org_id();
  v_actor uuid:=auth.uid();
  v_appraisal public.appraisals;
  v_prior public.appraisal_entries;
  v_id uuid;
begin
  select * into v_appraisal
  from private.content_live_appraisals
  where id=p_appraisal_id and org_id=v_org;

  if v_appraisal.id is null then
    raise exception 'Review case not found.' using errcode='42501';
  end if;
  if p_entry_type not in (
    'employee_reflection','manager_assessment','conversation_record','staff_response'
  ) then
    raise exception 'That review entry type is not supported.';
  end if;
  if length(btrim(coalesce(p_body,'')))<3 then
    raise exception 'Write at least a short review note.';
  end if;

  if p_entry_type in ('employee_reflection','staff_response') then
    if v_actor is distinct from v_appraisal.profile_id then
      raise exception 'Only the employee can write this part of the review.' using errcode='42501';
    end if;
  else
    if v_actor is distinct from v_appraisal.manager_id then
      raise exception 'Only the assigned reviewer can write this part of the review.' using errcode='42501';
    end if;
  end if;

  if p_supersedes_id is not null then
    select * into v_prior
    from private.content_live_appraisal_entries
    where id=p_supersedes_id
      and appraisal_id=v_appraisal.id
      and entry_type=p_entry_type;

    if v_prior.id is null then
      raise exception 'The review entry being revised was not found.';
    end if;
    if exists(select 1 from private.content_live_appraisal_entries where supersedes_id=v_prior.id) then
      raise exception 'That review entry has already been revised.';
    end if;
  end if;

  insert into public.appraisal_entries(
    org_id,appraisal_id,profile_id,entry_type,body,supersedes_id,created_by
  ) values (
    v_org,v_appraisal.id,v_appraisal.profile_id,p_entry_type,btrim(p_body),
    p_supersedes_id,v_actor
  )
  returning id into v_id;

  if p_entry_type='employee_reflection'
     and v_appraisal.status='evidence' then
    update public.appraisals
    set status='reflection_submitted'
    where id=v_appraisal.id;
  elsif p_entry_type='manager_assessment'
     and v_appraisal.status in ('evidence','reflection_submitted') then
    update public.appraisals
    set status='manager_draft'
    where id=v_appraisal.id;
  elsif p_entry_type='conversation_record'
     and v_appraisal.status in ('evidence','reflection_submitted','manager_draft') then
    update public.appraisals
    set status='conversation_recorded'
    where id=v_appraisal.id;
  end if;

  return v_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.record_development_plan_version(p_appraisal_id uuid, p_focus text, p_desired_outcome text, p_next_steps text, p_starts_on date, p_target_on date, p_state text, p_reason text, p_supersedes_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_org uuid:=public.app_org_id();
  v_actor uuid:=auth.uid();
  v_appraisal public.appraisals;
  v_prior public.development_plan_versions;
  v_plan_key uuid;
  v_version integer;
  v_id uuid;
begin
  select * into v_appraisal
  from private.content_live_appraisals
  where id=p_appraisal_id and org_id=v_org;

  if v_appraisal.id is null then
    raise exception 'Review case not found.' using errcode='42501';
  end if;
  if v_actor is distinct from v_appraisal.manager_id then
    raise exception 'Only the assigned reviewer can record this development plan.' using errcode='42501';
  end if;
  if length(btrim(coalesce(p_focus,'')))<3
     or length(btrim(coalesce(p_desired_outcome,'')))<3
     or length(btrim(coalesce(p_next_steps,'')))<3 then
    raise exception 'Focus, desired outcome and next steps are required.';
  end if;
  if p_state not in ('active','completed','closed') then
    raise exception 'Choose a valid development-plan state.';
  end if;
  if p_target_on is not null and p_starts_on is not null and p_target_on<p_starts_on then
    raise exception 'Target date cannot be before the start date.';
  end if;
  if length(btrim(coalesce(p_reason,'')))<3 then
    raise exception 'A reason is required for development-plan changes.';
  end if;

  if p_supersedes_id is not null then
    select * into v_prior
    from private.content_live_development_plan_versions
    where id=p_supersedes_id
      and appraisal_id=v_appraisal.id
      and org_id=v_org;

    if v_prior.id is null then
      raise exception 'The development-plan version being revised was not found.';
    end if;
    if exists(select 1 from private.content_live_development_plan_versions where supersedes_id=v_prior.id) then
      raise exception 'That development-plan version has already been superseded.';
    end if;

    v_plan_key:=v_prior.plan_key;
    v_version:=v_prior.version+1;
  else
    v_plan_key:=gen_random_uuid();
    v_version:=1;
  end if;

  insert into public.development_plan_versions(
    org_id,plan_key,version,appraisal_id,profile_id,manager_id,
    focus,desired_outcome,next_steps,starts_on,target_on,state,
    supersedes_id,change_reason,created_by
  ) values (
    v_org,v_plan_key,v_version,v_appraisal.id,v_appraisal.profile_id,v_appraisal.manager_id,
    btrim(p_focus),btrim(p_desired_outcome),btrim(p_next_steps),
    p_starts_on,p_target_on,p_state,p_supersedes_id,btrim(p_reason),v_actor
  )
  returning id into v_id;

  return v_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.record_performance_feedback(p_profile_id uuid, p_kind text, p_note text, p_occurred_on date DEFAULT CURRENT_DATE, p_work_item_id uuid DEFAULT NULL::uuid, p_project_id uuid DEFAULT NULL::uuid, p_strategy_node_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_org uuid:=public.app_org_id();
  v_actor uuid:=auth.uid();
  v_record public.employment_records;
  v_id uuid;
begin
  select * into v_record
  from public.employment_records
  where profile_id=p_profile_id and org_id=v_org;

  if v_record.profile_id is null then
    raise exception 'Employee record not found.' using errcode='42501';
  end if;

  if not (
    public.app_has_capability('performance.admin',null)
    or v_record.manager_profile_id=v_actor
    or v_record.unit_id in (select public.app_managed_units())
  ) then
    raise exception 'You do not have authority to record feedback for this person.' using errcode='42501';
  end if;

  if p_kind not in ('observation','recognition','guidance') then
    raise exception 'Choose a valid feedback type.';
  end if;
  if length(btrim(coalesce(p_note,'')))<3 then
    raise exception 'Feedback is required.';
  end if;

  if p_work_item_id is not null and not exists(
    select 1 from public.work_items w
    where w.id=p_work_item_id and w.org_id=v_org and w.assignee_id=p_profile_id
  ) then
    raise exception 'That work item is not recorded for this person.' using errcode='42501';
  end if;

  if p_project_id is not null and not exists(
    select 1 from public.projects p where p.id=p_project_id and p.org_id=v_org
  ) then
    raise exception 'That project is not in your organisation.' using errcode='42501';
  end if;

  if p_strategy_node_id is not null and not exists(
    select 1 from private.content_live_strategy_nodes s
    where s.id=p_strategy_node_id and s.org_id=v_org and s.owner_profile_id=p_profile_id
  ) then
    raise exception 'That objective is not recorded as owned by this person.' using errcode='42501';
  end if;

  insert into public.feedback_notes(
    org_id,profile_id,author_id,note,kind,occurred_on,
    work_item_id,project_id,strategy_node_id
  ) values (
    v_org,p_profile_id,v_actor,btrim(p_note),p_kind,coalesce(p_occurred_on,current_date),
    p_work_item_id,p_project_id,p_strategy_node_id
  )
  returning id into v_id;

  return v_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.respond_to_performance_feedback(p_feedback_note_id uuid, p_response text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_org uuid:=public.app_org_id();
  v_actor uuid:=auth.uid();
  v_feedback public.feedback_notes;
  v_id uuid;
begin
  select * into v_feedback
  from private.content_live_feedback_notes
  where id=p_feedback_note_id and org_id=v_org;

  if v_feedback.id is null then
    raise exception 'Feedback not found.' using errcode='42501';
  end if;
  if v_feedback.profile_id is distinct from v_actor then
    raise exception 'Only the person this feedback is about can reply.' using errcode='42501';
  end if;
  if length(btrim(coalesce(p_response,'')))<1 then
    raise exception 'Write a response first.';
  end if;

  insert into public.feedback_responses(
    org_id,feedback_note_id,profile_id,response,created_by
  ) values (
    v_org,v_feedback.id,v_feedback.profile_id,btrim(p_response),v_actor
  )
  returning id into v_id;

  return v_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.learning_materialise_assignment(p_rule_id uuid, p_profile_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_rule public.learning_assignment_rules;
  v_profile public.profiles;
  v_id uuid;
begin
  select * into v_rule
  from private.content_live_learning_assignment_rules
  where id=p_rule_id and active;

  if v_rule.id is null then return null; end if;

  if not exists(
    select 1 from private.content_live_learning_courses c
    where c.id=v_rule.course_id and c.org_id=v_rule.org_id and c.state='published'
  ) then return null; end if;

  select * into v_profile
  from public.profiles
  where id=p_profile_id and org_id=v_rule.org_id and active and not is_exec;

  if v_profile.id is null then return null; end if;

  insert into public.learning_assignments(
    org_id,course_id,profile_id,source_rule_id,assigned_by,due_on,assignment_reason
  ) values (
    v_rule.org_id,v_rule.course_id,v_profile.id,v_rule.id,v_rule.assigned_by,
    case when v_rule.due_days_after_assignment is null then null
         else current_date+v_rule.due_days_after_assignment end,
    v_rule.reason
  )
  on conflict(course_id,profile_id) do nothing
  returning id into v_id;

  if v_id is not null then
    perform public.platform_emit_event(
      v_rule.org_id,'learning.assignment_created',v_rule.assigned_by,v_profile.id,
      'learning_assignment',v_id,
      jsonb_build_object('course_id',v_rule.course_id,'source_rule_id',v_rule.id,'target_kind',v_rule.target_kind),
      'learning-assignment:'||v_id::text,null,null,now()
    );
  else
    select id into v_id
    from private.content_live_learning_assignments
    where course_id=v_rule.course_id and profile_id=v_profile.id;
  end if;

  return v_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.learning_complete_module(p_assignment_id uuid, p_module_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_actor uuid:=auth.uid();
  v_org uuid:=public.app_org_id();
  v_assignment public.learning_assignments;
  v_module public.learning_modules;
  v_progress public.learning_module_progress;
  v_progress_id uuid;
  v_history_id uuid;
  v_required integer;
  v_completed integer;
  v_was_completed boolean:=false;
  v_course public.learning_courses;
begin
  if v_actor is null then
    raise exception 'Sign in to record learning progress.' using errcode='42501';
  end if;

  select * into v_assignment
  from private.content_live_learning_assignments
  where id=p_assignment_id
    and org_id=v_org
    and profile_id=v_actor;

  if v_assignment.id is null then
    raise exception 'Learning assignment not found.' using errcode='42501';
  end if;

  if v_assignment.state='withdrawn' then
    raise exception 'This learning assignment has been withdrawn.' using errcode='42501';
  end if;

  select * into v_module
  from private.content_live_learning_modules
  where id=p_module_id
    and org_id=v_org
    and course_id=v_assignment.course_id;

  if v_module.id is null then
    raise exception 'That module is not part of this learning assignment.' using errcode='42501';
  end if;

  select * into v_progress
  from private.content_live_learning_module_progress
  where assignment_id=v_assignment.id and module_id=v_module.id;

  if v_progress.id is not null and v_progress.state='completed' then
    return v_progress.id;
  end if;

  if v_progress.id is null then
    insert into public.learning_module_progress(
      org_id,assignment_id,module_id,state,completed_at,updated_by
    ) values (
      v_org,v_assignment.id,v_module.id,'completed',now(),v_actor
    )
    returning id into v_progress_id;
  else
    update public.learning_module_progress
    set state='completed',completed_at=now(),updated_by=v_actor,updated_at=now()
    where id=v_progress.id
    returning id into v_progress_id;
  end if;

  insert into public.learning_progress_history(
    org_id,assignment_id,module_id,action,reason,actor_id
  ) values (
    v_org,v_assignment.id,v_module.id,'completed',null,v_actor
  )
  returning id into v_history_id;

  perform public.platform_emit_event(
    v_org,'learning.module_completed',v_actor,v_actor,
    'learning_assignment',v_assignment.id,
    jsonb_build_object('module_id',v_module.id,'course_id',v_assignment.course_id),
    'learning-module-completed:'||v_history_id::text,null,null,now()
  );

  if v_assignment.state='assigned' then
    update public.learning_assignments
    set state='in_progress'
    where id=v_assignment.id;
  end if;

  select count(*) into v_required
  from private.content_live_learning_modules
  where course_id=v_assignment.course_id and required;

  select count(*) into v_completed
  from private.content_live_learning_modules m
  join private.content_live_learning_module_progress p
    on p.module_id=m.id
   and p.assignment_id=v_assignment.id
   and p.state='completed'
  where m.course_id=v_assignment.course_id and m.required;

  if v_required>0 and v_completed=v_required then
    v_was_completed:=v_assignment.state='completed';

    update public.learning_assignments
    set state='completed',completed_at=coalesce(completed_at,now()),
        withdrawn_at=null,withdrawn_by=null,withdrawal_reason=null
    where id=v_assignment.id;

    select * into v_course
    from private.content_live_learning_courses
    where id=v_assignment.course_id;

    insert into public.training_records(
      org_id,profile_id,name,completed_on,note,source,
      learning_assignment_id,recorded_by,voided_at,voided_by,void_reason
    ) values (
      v_org,v_actor,v_course.title,current_date,
      'Completed through CEAC OS structured learning.',
      'learning_course',v_assignment.id,v_actor,null,null,null
    )
    on conflict(learning_assignment_id) where learning_assignment_id is not null do update
    set completed_on=excluded.completed_on,
        name=excluded.name,
        note=excluded.note,
        source='learning_course',
        voided_at=null,
        voided_by=null,
        void_reason=null;

    if not v_was_completed then
      perform public.platform_emit_event(
        v_org,'learning.course_completed',v_actor,v_actor,
        'learning_assignment',v_assignment.id,
        jsonb_build_object('course_id',v_assignment.course_id,'required_modules',v_required),
        'learning-course-completed:'||v_assignment.id::text||':'||v_history_id::text,null,null,now()
      );
    end if;
  end if;

  return v_progress_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.learning_admin_action(p_assignment_id uuid, p_action text, p_module_id uuid DEFAULT NULL::uuid, p_reason text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_actor uuid:=auth.uid();
  v_org uuid:=public.app_org_id();
  v_assignment public.learning_assignments;
  v_progress public.learning_module_progress;
  v_required integer;
  v_completed integer;
begin
  if v_actor is null or not public.app_has_capability('learning.manage',null) then
    raise exception 'You do not have authority to correct learning records.' using errcode='42501';
  end if;

  if length(btrim(coalesce(p_reason,'')))<3 then
    raise exception 'A reason is required.';
  end if;

  select * into v_assignment
  from private.content_live_learning_assignments
  where id=p_assignment_id and org_id=v_org;

  if v_assignment.id is null then
    raise exception 'Learning assignment not found.' using errcode='42501';
  end if;

  if p_action='withdraw' then
    if v_assignment.state='withdrawn' then return; end if;

    update public.learning_assignments
    set state='withdrawn',withdrawn_at=now(),withdrawn_by=v_actor,
        withdrawal_reason=btrim(p_reason)
    where id=v_assignment.id;

    perform public.platform_emit_event(
      v_org,'learning.assignment_changed',v_actor,v_assignment.profile_id,
      'learning_assignment',v_assignment.id,
      jsonb_build_object('action','withdrawn','course_id',v_assignment.course_id),
      null,null,null,now()
    );
    return;
  end if;

  if p_action='restore' then
    if v_assignment.state<>'withdrawn' then
      raise exception 'Only a withdrawn assignment can be restored.';
    end if;

    select count(*) into v_completed
    from private.content_live_learning_module_progress
    where assignment_id=v_assignment.id and state='completed';

    select count(*) into v_required
    from private.content_live_learning_modules
    where course_id=v_assignment.course_id and required;

    if v_required>0 and (
      select count(*)
      from private.content_live_learning_modules m
      join private.content_live_learning_module_progress p
        on p.module_id=m.id
       and p.assignment_id=v_assignment.id
       and p.state='completed'
      where m.course_id=v_assignment.course_id and m.required
    )=v_required then
      update public.learning_assignments
      set state='completed',completed_at=coalesce(completed_at,now()),
          withdrawn_at=null,withdrawn_by=null,withdrawal_reason=null
      where id=v_assignment.id;
    else
      update public.learning_assignments
      set state=case when v_completed>0 then 'in_progress' else 'assigned' end,
          completed_at=null,withdrawn_at=null,withdrawn_by=null,withdrawal_reason=null
      where id=v_assignment.id;
    end if;

    perform public.platform_emit_event(
      v_org,'learning.assignment_changed',v_actor,v_assignment.profile_id,
      'learning_assignment',v_assignment.id,
      jsonb_build_object('action','restored','course_id',v_assignment.course_id),
      null,null,null,now()
    );
    return;
  end if;

  if p_action='reopen_module' then
    if p_module_id is null then
      raise exception 'Choose the completed module to correct.';
    end if;

    select p.* into v_progress
    from private.content_live_learning_module_progress p
    join private.content_live_learning_modules m on m.id=p.module_id
    where p.assignment_id=v_assignment.id
      and p.module_id=p_module_id
      and p.state='completed'
      and m.course_id=v_assignment.course_id;

    if v_progress.id is null then
      raise exception 'Completed module progress not found.';
    end if;

    update public.learning_module_progress
    set state='not_started',completed_at=null,updated_by=v_actor,updated_at=now()
    where id=v_progress.id;

    insert into public.learning_progress_history(
      org_id,assignment_id,module_id,action,reason,actor_id
    ) values (
      v_org,v_assignment.id,p_module_id,'reopened',btrim(p_reason),v_actor
    );

    select count(*) into v_required
    from private.content_live_learning_modules
    where course_id=v_assignment.course_id and required;

    select count(*) into v_completed
    from private.content_live_learning_modules m
    join private.content_live_learning_module_progress p
      on p.module_id=m.id
     and p.assignment_id=v_assignment.id
     and p.state='completed'
    where m.course_id=v_assignment.course_id and m.required;

    if v_assignment.state='completed' and v_completed<v_required then
      update public.learning_assignments
      set state=case when exists(
            select 1 from private.content_live_learning_module_progress
            where assignment_id=v_assignment.id and state='completed'
          ) then 'in_progress' else 'assigned' end,
          completed_at=null
      where id=v_assignment.id;

      update public.training_records
      set completed_on=null,voided_at=now(),voided_by=v_actor,
          void_reason=btrim(p_reason)
      where learning_assignment_id=v_assignment.id;
    end if;

    perform public.platform_emit_event(
      v_org,'learning.progress_corrected',v_actor,v_assignment.profile_id,
      'learning_assignment',v_assignment.id,
      jsonb_build_object('module_id',p_module_id,'course_id',v_assignment.course_id),
      null,null,null,now()
    );
    return;
  end if;

  raise exception 'Unsupported learning administration action.';
end;
$function$;

CREATE OR REPLACE FUNCTION public.asset_record_item(p_asset_id uuid, p_asset_code text, p_category text, p_manufacturer text, p_model text, p_serial_number text, p_purchase_date date, p_purchase_vendor text, p_purchase_cost numeric, p_purchase_currency text, p_warranty_expires_on date, p_unit_id uuid, p_location text, p_condition_note text, p_notes text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_org uuid:=public.app_org_id();
  v_actor uuid:=auth.uid();
  v_id uuid:=coalesce(p_asset_id,gen_random_uuid());
  v_existing public.asset_items;
  v_event_type text;
begin
  if v_actor is null or not public.app_has_capability('asset.manage',null) then
    raise exception 'You do not have authority to manage assets.' using errcode='42501';
  end if;

  if length(btrim(coalesce(p_asset_code,'')))<2
     or length(btrim(coalesce(p_category,'')))<2 then
    raise exception 'Asset code and category are required.';
  end if;

  if p_purchase_cost is not null and p_purchase_cost<0 then
    raise exception 'Purchase cost cannot be negative.';
  end if;

  if (p_purchase_cost is null) is distinct from (nullif(btrim(coalesce(p_purchase_currency,'')),'') is null) then
    raise exception 'Purchase amount and three-letter currency must be recorded together.';
  end if;

  if p_purchase_currency is not null
     and upper(btrim(p_purchase_currency)) !~ '^[A-Z]{3}$' then
    raise exception 'Purchase currency must be a three-letter code.';
  end if;

  if p_warranty_expires_on is not null
     and p_purchase_date is not null
     and p_warranty_expires_on<p_purchase_date then
    raise exception 'Warranty expiry cannot be before purchase date.';
  end if;

  if p_unit_id is not null and not exists(
    select 1 from public.units u
    where u.id=p_unit_id and u.org_id=v_org and u.active
  ) then
    raise exception 'Choose an active unit in your organisation.' using errcode='42501';
  end if;

  if p_asset_id is null then
    insert into public.asset_items(
      id,org_id,asset_code,category,manufacturer,model,serial_number,
      purchase_date,purchase_vendor,purchase_cost,purchase_currency,
      warranty_expires_on,current_status,current_unit_id,current_location,
      current_condition_note,notes,created_by,updated_by
    ) values (
      v_id,v_org,btrim(p_asset_code),btrim(p_category),
      nullif(btrim(coalesce(p_manufacturer,'')),''),
      nullif(btrim(coalesce(p_model,'')),''),
      nullif(btrim(coalesce(p_serial_number,'')),''),
      p_purchase_date,nullif(btrim(coalesce(p_purchase_vendor,'')),''),
      p_purchase_cost,
      case when p_purchase_cost is null then null else upper(btrim(p_purchase_currency)) end,
      p_warranty_expires_on,'available',p_unit_id,
      nullif(btrim(coalesce(p_location,'')),''),
      nullif(btrim(coalesce(p_condition_note,'')),''),
      nullif(btrim(coalesce(p_notes,'')),''),
      v_actor,v_actor
    );
    v_event_type:='asset.created';
  else
    select * into v_existing
    from private.content_live_asset_items
    where id=p_asset_id and org_id=v_org
    for update;

    if v_existing.id is null then
      raise exception 'Asset not found.' using errcode='42501';
    end if;

    update public.asset_items
    set asset_code=btrim(p_asset_code),
        category=btrim(p_category),
        manufacturer=nullif(btrim(coalesce(p_manufacturer,'')),''),
        model=nullif(btrim(coalesce(p_model,'')),''),
        serial_number=nullif(btrim(coalesce(p_serial_number,'')),''),
        purchase_date=p_purchase_date,
        purchase_vendor=nullif(btrim(coalesce(p_purchase_vendor,'')),''),
        purchase_cost=p_purchase_cost,
        purchase_currency=case when p_purchase_cost is null then null else upper(btrim(p_purchase_currency)) end,
        warranty_expires_on=p_warranty_expires_on,
        current_unit_id=case
          when current_status='available' and current_assignee_profile_id is null then p_unit_id
          else current_unit_id
        end,
        current_location=case
          when current_status='available' and current_assignee_profile_id is null
          then nullif(btrim(coalesce(p_location,'')),'')
          else current_location
        end,
        current_condition_note=case
          when current_status='available' and current_assignee_profile_id is null
          then nullif(btrim(coalesce(p_condition_note,'')),'')
          else current_condition_note
        end,
        notes=nullif(btrim(coalesce(p_notes,'')),''),
        updated_by=v_actor,
        updated_at=now()
    where id=v_existing.id;

    v_event_type:='asset.updated';
  end if;

  perform public.platform_emit_event(
    v_org,v_event_type,v_actor,null,
    'asset',v_id,
    jsonb_build_object('asset_code',btrim(p_asset_code),'category',btrim(p_category)),
    v_event_type||':'||v_id::text||':'||extract(epoch from clock_timestamp())::text,
    null,null,now()
  );

  return v_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.asset_assign(p_asset_id uuid, p_profile_id uuid, p_unit_id uuid, p_location text, p_expected_return_on date, p_condition_note text, p_reason text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_org uuid:=public.app_org_id();
  v_actor uuid:=auth.uid();
  v_asset public.asset_items;
  v_target_unit uuid:=p_unit_id;
  v_action text;
  v_event_id uuid;
begin
  if v_actor is null or not public.app_has_capability('asset.manage',null) then
    raise exception 'You do not have authority to assign assets.' using errcode='42501';
  end if;

  if p_profile_id is null and p_unit_id is null then
    raise exception 'Choose a person, a unit, or both for custody.';
  end if;

  if length(btrim(coalesce(p_reason,'')))<3 then
    raise exception 'A reason is required.';
  end if;

  select * into v_asset
  from private.content_live_asset_items
  where id=p_asset_id and org_id=v_org
  for update;
  if v_asset.id is null then raise exception 'Asset not found.' using errcode='42501'; end if;

  if v_asset.current_status in ('repair','retired') then
    raise exception 'This asset cannot be assigned from its current state.';
  end if;

  if p_profile_id is not null then
    if not exists(
      select 1 from public.profiles p
      where p.id=p_profile_id and p.org_id=v_org and p.active
    ) then
      raise exception 'Choose an active person in your organisation.' using errcode='42501';
    end if;

    if v_target_unit is null then
      select er.unit_id into v_target_unit
      from public.employment_records er
      where er.profile_id=p_profile_id and er.org_id=v_org;
    end if;
  end if;

  if v_target_unit is not null and not exists(
    select 1 from public.units u
    where u.id=v_target_unit and u.org_id=v_org and u.active
  ) then
    raise exception 'Choose an active unit in your organisation.' using errcode='42501';
  end if;

  if p_profile_id is not null and v_target_unit is not null and not exists(
    select 1 from public.employment_records er
    where er.profile_id=p_profile_id and er.org_id=v_org and er.unit_id=v_target_unit
  ) then
    raise exception 'That person is not currently recorded in the selected unit.';
  end if;

  v_action:=case when v_asset.current_status='assigned' then 'transferred' else 'assigned' end;

  insert into public.asset_assignment_events(
    org_id,asset_id,action,
    from_profile_id,from_unit_id,from_location,
    to_profile_id,to_unit_id,to_location,
    expected_return_on,condition_note,reason,actor_id
  ) values (
    v_org,v_asset.id,v_action,
    v_asset.current_assignee_profile_id,v_asset.current_unit_id,v_asset.current_location,
    p_profile_id,v_target_unit,nullif(btrim(coalesce(p_location,'')),''),
    p_expected_return_on,nullif(btrim(coalesce(p_condition_note,'')),''),
    btrim(p_reason),v_actor
  )
  returning id into v_event_id;

  update public.asset_items
  set current_status='assigned',
      current_assignee_profile_id=p_profile_id,
      current_unit_id=v_target_unit,
      current_location=nullif(btrim(coalesce(p_location,'')),''),
      current_condition_note=nullif(btrim(coalesce(p_condition_note,'')),''),
      updated_by=v_actor,
      updated_at=now()
  where id=v_asset.id;

  perform public.platform_emit_event(
    v_org,
    case when v_action='transferred' then 'asset.transferred' else 'asset.assigned' end,
    v_actor,p_profile_id,'asset',v_asset.id,
    jsonb_build_object(
      'assignment_event_id',v_event_id,
      'from_profile_id',v_asset.current_assignee_profile_id,
      'from_unit_id',v_asset.current_unit_id,
      'to_profile_id',p_profile_id,
      'to_unit_id',v_target_unit,
      'expected_return_on',p_expected_return_on
    ),
    'asset-assignment:'||v_event_id::text,null,null,now()
  );

  return v_event_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.asset_return(p_asset_id uuid, p_location text, p_condition_note text, p_reason text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_org uuid:=public.app_org_id();
  v_actor uuid:=auth.uid();
  v_asset public.asset_items;
  v_event_id uuid;
begin
  if v_actor is null or not public.app_has_capability('asset.manage',null) then
    raise exception 'You do not have authority to return assets.' using errcode='42501';
  end if;
  if length(btrim(coalesce(p_reason,'')))<3 then raise exception 'A reason is required.'; end if;

  select * into v_asset
  from private.content_live_asset_items
  where id=p_asset_id and org_id=v_org
  for update;
  if v_asset.id is null then raise exception 'Asset not found.' using errcode='42501'; end if;
  if v_asset.current_status<>'assigned' then
    raise exception 'Only an assigned asset can be returned.';
  end if;

  insert into public.asset_assignment_events(
    org_id,asset_id,action,
    from_profile_id,from_unit_id,from_location,
    to_profile_id,to_unit_id,to_location,
    condition_note,reason,actor_id
  ) values (
    v_org,v_asset.id,'returned',
    v_asset.current_assignee_profile_id,v_asset.current_unit_id,v_asset.current_location,
    null,v_asset.current_unit_id,nullif(btrim(coalesce(p_location,'')),''),
    nullif(btrim(coalesce(p_condition_note,'')),''),
    btrim(p_reason),v_actor
  )
  returning id into v_event_id;

  update public.asset_items
  set current_status='available',
      current_assignee_profile_id=null,
      current_location=nullif(btrim(coalesce(p_location,'')),''),
      current_condition_note=nullif(btrim(coalesce(p_condition_note,'')),''),
      updated_by=v_actor,
      updated_at=now()
  where id=v_asset.id;

  perform public.platform_emit_event(
    v_org,'asset.returned',v_actor,v_asset.current_assignee_profile_id,
    'asset',v_asset.id,
    jsonb_build_object('assignment_event_id',v_event_id,'unit_id',v_asset.current_unit_id),
    'asset-return:'||v_event_id::text,null,null,now()
  );

  return v_event_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.asset_lifecycle_action(p_asset_id uuid, p_action text, p_note text, p_reason text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_org uuid:=public.app_org_id();
  v_actor uuid:=auth.uid();
  v_asset public.asset_items;
  v_to text;
  v_event_id uuid;
  v_event_type text;
begin
  if v_actor is null or not public.app_has_capability('asset.manage',null) then
    raise exception 'You do not have authority to manage asset lifecycle.' using errcode='42501';
  end if;
  if p_action not in ('repair_started','repair_completed','warranty_claimed','retired') then
    raise exception 'Choose a supported asset lifecycle action.';
  end if;
  if length(btrim(coalesce(p_reason,'')))<3 then raise exception 'A reason is required.'; end if;

  select * into v_asset
  from private.content_live_asset_items
  where id=p_asset_id and org_id=v_org
  for update;
  if v_asset.id is null then raise exception 'Asset not found.' using errcode='42501'; end if;

  if p_action='repair_started' then
    if v_asset.current_status<>'available' then
      raise exception 'Return the asset before starting a repair.';
    end if;
    v_to:='repair';
    v_event_type:='asset.repair_started';
  elsif p_action='repair_completed' then
    if v_asset.current_status<>'repair' then
      raise exception 'Only an asset in repair can be marked repair complete.';
    end if;
    v_to:='available';
    v_event_type:='asset.repair_completed';
  elsif p_action='warranty_claimed' then
    if v_asset.current_status='retired' then
      raise exception 'A retired asset cannot start a warranty claim.';
    end if;
    v_to:=v_asset.current_status;
    v_event_type:='asset.warranty_claimed';
  elsif p_action='retired' then
    if v_asset.current_status='assigned' then
      raise exception 'Return the asset before retirement.';
    end if;
    if v_asset.current_status='retired' then
      raise exception 'This asset is already retired.';
    end if;
    v_to:='retired';
    v_event_type:='asset.retired';
  end if;

  insert into public.asset_lifecycle_events(
    org_id,asset_id,action,from_status,to_status,note,reason,actor_id
  ) values (
    v_org,v_asset.id,p_action,v_asset.current_status,v_to,
    nullif(btrim(coalesce(p_note,'')),''),
    btrim(p_reason),v_actor
  )
  returning id into v_event_id;

  if v_to is distinct from v_asset.current_status then
    update public.asset_items
    set current_status=v_to,
        current_assignee_profile_id=case when v_to='retired' then null else current_assignee_profile_id end,
        updated_by=v_actor,
        updated_at=now()
    where id=v_asset.id;
  else
    update public.asset_items
    set updated_by=v_actor,updated_at=now()
    where id=v_asset.id;
  end if;

  perform public.platform_emit_event(
    v_org,v_event_type,v_actor,v_asset.current_assignee_profile_id,
    'asset',v_asset.id,
    jsonb_build_object(
      'lifecycle_event_id',v_event_id,
      'from_status',v_asset.current_status,
      'to_status',v_to
    ),
    v_event_type||':'||v_event_id::text,null,null,now()
  );

  return v_event_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.compliance_record_policy(p_policy_key uuid, p_title text, p_category text, p_summary text, p_body_text text, p_state text, p_effective_on date, p_expires_on date, p_source_reference text, p_reason text, p_applicability jsonb, p_requirements jsonb, p_supersedes_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_org uuid:=public.app_org_id();
  v_actor uuid:=auth.uid();
  v_prior public.compliance_policy_versions;
  v_key uuid;
  v_version integer;
  v_id uuid;
  v_item jsonb;
  v_kind text;
  v_unit uuid;
  v_profile uuid;
  v_employment_type text;
begin
  if v_actor is null or not public.app_has_capability('compliance.manage',null) then
    raise exception 'You do not have authority to manage compliance policies.' using errcode='42501';
  end if;
  if length(btrim(coalesce(p_title,'')))<3
     or length(btrim(coalesce(p_category,'')))<2
     or length(btrim(coalesce(p_body_text,'')))<3
     or length(btrim(coalesce(p_reason,'')))<3 then
    raise exception 'Title, category, policy text and reason are required.';
  end if;
  if p_state not in ('active','retired') then
    raise exception 'Choose a valid policy state.';
  end if;
  if p_effective_on is null or (p_expires_on is not null and p_expires_on<p_effective_on) then
    raise exception 'Choose a valid policy date range.';
  end if;
  if jsonb_typeof(coalesce(p_applicability,'[]'::jsonb))<>'array'
     or jsonb_typeof(coalesce(p_requirements,'[]'::jsonb))<>'array' then
    raise exception 'Applicability and requirements must be arrays.';
  end if;
  if p_state='active' and jsonb_array_length(coalesce(p_applicability,'[]'::jsonb))=0 then
    raise exception 'An active policy needs at least one applicability rule.';
  end if;

  if p_supersedes_id is not null then
    select * into v_prior
    from private.content_live_compliance_policy_versions
    where id=p_supersedes_id and org_id=v_org;
    if v_prior.id is null then raise exception 'Policy version being superseded was not found.'; end if;
    if exists(select 1 from private.content_live_compliance_policy_versions where supersedes_id=v_prior.id) then
      raise exception 'That policy version has already been superseded.';
    end if;
    v_key:=v_prior.policy_key;
    v_version:=v_prior.version+1;
  else
    v_key:=coalesce(p_policy_key,gen_random_uuid());
    v_version:=1;
    if exists(select 1 from private.content_live_compliance_policy_versions where org_id=v_org and policy_key=v_key) then
      raise exception 'That policy key already exists; revise the current version instead.';
    end if;
  end if;

  insert into public.compliance_policy_versions(
    org_id,policy_key,version,title,category,summary,body_text,state,
    effective_on,expires_on,source_reference,supersedes_id,reason,created_by
  ) values (
    v_org,v_key,v_version,btrim(p_title),btrim(p_category),
    nullif(btrim(coalesce(p_summary,'')),''),
    btrim(p_body_text),p_state,p_effective_on,p_expires_on,
    nullif(btrim(coalesce(p_source_reference,'')),''),
    p_supersedes_id,btrim(p_reason),v_actor
  )
  returning id into v_id;

  if p_state='retired'
     and p_supersedes_id is not null
     and jsonb_array_length(coalesce(p_applicability,'[]'::jsonb))=0 then
    insert into public.compliance_policy_applicability(
      org_id,policy_version_id,scope_kind,unit_id,profile_id,employment_type
    )
    select v_org,v_id,a.scope_kind,a.unit_id,a.profile_id,a.employment_type
    from private.content_live_compliance_policy_applicability a
    where a.policy_version_id=p_supersedes_id;
  end if;

  if p_state='retired'
     and p_supersedes_id is not null
     and jsonb_array_length(coalesce(p_requirements,'[]'::jsonb))=0 then
    insert into public.compliance_requirements(
      org_id,policy_version_id,requirement_code,title,description,
      acknowledgement_required,evidence_required,evidence_kind,evidence_valid_days
    )
    select v_org,v_id,r.requirement_code,r.title,r.description,
           r.acknowledgement_required,r.evidence_required,r.evidence_kind,r.evidence_valid_days
    from private.content_live_compliance_requirements r
    where r.policy_version_id=p_supersedes_id;
  end if;

  for v_item in select value from jsonb_array_elements(coalesce(p_applicability,'[]'::jsonb))
  loop
    v_kind:=v_item->>'scope_kind';
    v_unit:=nullif(v_item->>'unit_id','')::uuid;
    v_profile:=nullif(v_item->>'profile_id','')::uuid;
    v_employment_type:=nullif(btrim(coalesce(v_item->>'employment_type','')),'');

    if v_kind not in ('organisation','unit','person','employment_type') then
      raise exception 'Choose a supported compliance applicability scope.';
    end if;
    if v_kind='unit' and not exists(
      select 1 from public.units u where u.id=v_unit and u.org_id=v_org and u.active
    ) then
      raise exception 'Applicability unit is not active in this organisation.' using errcode='42501';
    end if;
    if v_kind='person' and not exists(
      select 1 from public.profiles p where p.id=v_profile and p.org_id=v_org and p.active
    ) then
      raise exception 'Applicability person is not active in this organisation.' using errcode='42501';
    end if;
    if v_kind='employment_type' and v_employment_type is null then
      raise exception 'Employment type applicability requires a value.';
    end if;

    insert into public.compliance_policy_applicability(
      org_id,policy_version_id,scope_kind,unit_id,profile_id,employment_type
    ) values (
      v_org,v_id,v_kind,
      case when v_kind='unit' then v_unit else null end,
      case when v_kind='person' then v_profile else null end,
      case when v_kind='employment_type' then v_employment_type else null end
    );
  end loop;

  for v_item in select value from jsonb_array_elements(coalesce(p_requirements,'[]'::jsonb))
  loop
    if length(btrim(coalesce(v_item->>'requirement_code','')))<2
       or length(btrim(coalesce(v_item->>'title','')))<3 then
      raise exception 'Each compliance requirement needs a code and title.';
    end if;

    insert into public.compliance_requirements(
      org_id,policy_version_id,requirement_code,title,description,
      acknowledgement_required,evidence_required,evidence_kind,evidence_valid_days
    ) values (
      v_org,v_id,btrim(v_item->>'requirement_code'),btrim(v_item->>'title'),
      nullif(btrim(coalesce(v_item->>'description','')),''),
      coalesce((v_item->>'acknowledgement_required')::boolean,false),
      coalesce((v_item->>'evidence_required')::boolean,false),
      nullif(btrim(coalesce(v_item->>'evidence_kind','')),''),
      nullif(v_item->>'evidence_valid_days','')::integer
    );
  end loop;

  perform public.platform_emit_event(
    v_org,
    case when p_state='retired' then 'compliance.policy_retired' else 'compliance.policy_published' end,
    v_actor,null,'compliance_policy',v_key,
    jsonb_build_object('policy_version_id',v_id,'version',v_version,'title',btrim(p_title),'state',p_state),
    'compliance-policy:'||v_id::text,null,null,now()
  );

  return v_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.compliance_acknowledge_policy(p_policy_version_id uuid, p_statement text DEFAULT 'I acknowledge this policy version.'::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_org uuid:=public.app_org_id();
  v_actor uuid:=auth.uid();
  v_policy public.compliance_policy_versions;
  v_id uuid;
  v_applies boolean:=false;
begin
  if v_actor is null then raise exception 'Sign in to acknowledge a policy.' using errcode='42501'; end if;

  select * into v_policy
  from private.content_live_compliance_policy_versions
  where id=p_policy_version_id and org_id=v_org and state='active';

  if v_policy.id is null
     or v_policy.effective_on>current_date
     or (v_policy.expires_on is not null and v_policy.expires_on<current_date) then
    raise exception 'This policy version is not currently active.';
  end if;

  select exists(
    select 1
    from private.content_live_compliance_policy_applicability a
    left join public.employment_records er
      on er.profile_id=v_actor and er.org_id=v_org
    where a.policy_version_id=v_policy.id
      and (
        a.scope_kind='organisation'
        or (a.scope_kind='person' and a.profile_id=v_actor)
        or (a.scope_kind='unit' and a.unit_id=er.unit_id)
        or (a.scope_kind='employment_type' and a.employment_type=er.employment_type)
      )
  ) into v_applies;

  if not v_applies then
    raise exception 'This policy version is not applicable to your current record.' using errcode='42501';
  end if;

  insert into public.compliance_acknowledgements(
    org_id,policy_version_id,profile_id,statement
  ) values (
    v_org,v_policy.id,v_actor,
    coalesce(nullif(btrim(coalesce(p_statement,'')),''),'I acknowledge this policy version.')
  )
  returning id into v_id;

  perform public.platform_emit_event(
    v_org,'compliance.policy_acknowledged',v_actor,v_actor,
    'compliance_policy',v_policy.policy_key,
    jsonb_build_object('policy_version_id',v_policy.id,'acknowledgement_id',v_id),
    'compliance-ack:'||v_id::text,null,null,now()
  );

  return v_id;
exception
  when unique_violation then
    raise exception 'You already acknowledged this policy version.';
end;
$function$;

CREATE OR REPLACE FUNCTION public.app_can_read_operational_context(p_context_type text, p_context_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select auth.uid() is not null and case p_context_type
    when 'work_item' then public.app_can_see_item(p_context_id)
    when 'project' then p_context_id in (select public.app_visible_projects())
    when 'room_message' then exists(
      select 1 from public.room_messages rm
      where rm.id=p_context_id
        and rm.org_id=public.app_org_id()
        and public.app_can_access_room(rm.room_id)
    )
    when 'announcement' then exists(
      select 1 from private.content_live_announcements a
      where a.id=p_context_id
        and a.org_id=public.app_org_id()
        and (
          public.app_is_admin()
          or public.app_is_exec()
          or a.author_id=auth.uid()
          or public.app_can_read_announcement(a.id)
        )
    )
    when 'employee_photo' then exists(
      select 1 from public.employee_roster e
      where e.id=p_context_id and e.org_id=public.app_org_id()
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
        where p.id=p_context_id and p.org_id=public.app_org_id()
          and w.visibility='unit' and not w.confidential and public.app_can_see_item(w.id))
    )
    when 'support_case' then public.app_can_read_support_case(p_context_id)
    else false
  end;
$function$;

CREATE OR REPLACE FUNCTION public.compliance_submit_evidence(p_requirement_id uuid, p_evidence_reference text, p_note text, p_issued_on date, p_expires_on date, p_supersedes_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_org uuid:=public.app_org_id();
  v_actor uuid:=auth.uid();
  v_req public.compliance_requirements;
  v_policy public.compliance_policy_versions;
  v_prior public.compliance_evidence_versions;
  v_key uuid;
  v_version integer;
  v_id uuid;
  v_applies boolean:=false;
begin
  if v_actor is null then raise exception 'Sign in to submit compliance evidence.' using errcode='42501'; end if;
  if length(btrim(coalesce(p_evidence_reference,'')))<2 then
    raise exception 'Evidence reference is required.';
  end if;
  if p_expires_on is not null and p_issued_on is not null and p_expires_on<p_issued_on then
    raise exception 'Evidence expiry cannot be before the issue date.';
  end if;

  select * into v_req
  from private.content_live_compliance_requirements
  where id=p_requirement_id and org_id=v_org and evidence_required;

  if v_req.id is null then
    raise exception 'This requirement does not accept evidence.';
  end if;

  select * into v_policy
  from private.content_live_compliance_policy_versions
  where id=v_req.policy_version_id and org_id=v_org and state='active';

  if v_policy.id is null
     or v_policy.effective_on>current_date
     or (v_policy.expires_on is not null and v_policy.expires_on<current_date) then
    raise exception 'The requirement is not on a current active policy.';
  end if;

  select exists(
    select 1
    from private.content_live_compliance_policy_applicability a
    left join public.employment_records er
      on er.profile_id=v_actor and er.org_id=v_org
    where a.policy_version_id=v_policy.id
      and (
        a.scope_kind='organisation'
        or (a.scope_kind='person' and a.profile_id=v_actor)
        or (a.scope_kind='unit' and a.unit_id=er.unit_id)
        or (a.scope_kind='employment_type' and a.employment_type=er.employment_type)
      )
  ) into v_applies;

  if not v_applies then
    raise exception 'This requirement is not applicable to your current record.' using errcode='42501';
  end if;

  if p_supersedes_id is not null then
    select * into v_prior
    from private.content_live_compliance_evidence_versions
    where id=p_supersedes_id and org_id=v_org
      and profile_id=v_actor and requirement_id=v_req.id;
    if v_prior.id is null then raise exception 'Evidence version being superseded was not found.'; end if;
    if exists(select 1 from private.content_live_compliance_evidence_versions where supersedes_id=v_prior.id) then
      raise exception 'That evidence version has already been superseded.';
    end if;
    v_key:=v_prior.evidence_key;
    v_version:=v_prior.version+1;
  else
    v_key:=gen_random_uuid();
    v_version:=1;
  end if;

  insert into public.compliance_evidence_versions(
    org_id,evidence_key,version,profile_id,requirement_id,state,
    evidence_reference,note,issued_on,expires_on,supersedes_id,created_by
  ) values (
    v_org,v_key,v_version,v_actor,v_req.id,'submitted',
    btrim(p_evidence_reference),nullif(btrim(coalesce(p_note,'')),''),
    p_issued_on,p_expires_on,p_supersedes_id,v_actor
  )
  returning id into v_id;

  perform public.platform_emit_event(
    v_org,'compliance.evidence_submitted',v_actor,v_actor,
    'compliance_evidence',v_key,
    jsonb_build_object('evidence_version_id',v_id,'requirement_id',v_req.id,'version',v_version),
    'compliance-evidence:'||v_id::text,null,null,now()
  );

  return v_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.compliance_review_evidence(p_evidence_version_id uuid, p_action text, p_reviewer_note text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_org uuid:=public.app_org_id();
  v_actor uuid:=auth.uid();
  v_prior public.compliance_evidence_versions;
  v_id uuid;
begin
  if v_actor is null or not public.app_has_capability('compliance.manage',null) then
    raise exception 'You do not have authority to review compliance evidence.' using errcode='42501';
  end if;
  if p_action not in ('verified','rejected') then raise exception 'Choose verified or rejected.'; end if;
  if length(btrim(coalesce(p_reviewer_note,'')))<3 then raise exception 'A reviewer note is required.'; end if;

  select * into v_prior
  from private.content_live_compliance_evidence_versions
  where id=p_evidence_version_id and org_id=v_org and state='submitted';

  if v_prior.id is null then raise exception 'Submitted evidence version not found.'; end if;
  if exists(select 1 from private.content_live_compliance_evidence_versions where supersedes_id=v_prior.id) then
    raise exception 'That evidence version already has a later decision.';
  end if;

  insert into public.compliance_evidence_versions(
    org_id,evidence_key,version,profile_id,requirement_id,state,
    evidence_reference,note,issued_on,expires_on,supersedes_id,
    reviewer_id,reviewer_note,created_by
  ) values (
    v_org,v_prior.evidence_key,v_prior.version+1,v_prior.profile_id,v_prior.requirement_id,p_action,
    v_prior.evidence_reference,v_prior.note,v_prior.issued_on,v_prior.expires_on,v_prior.id,
    v_actor,btrim(p_reviewer_note),v_actor
  )
  returning id into v_id;

  perform public.platform_emit_event(
    v_org,
    case when p_action='verified' then 'compliance.evidence_verified' else 'compliance.evidence_rejected' end,
    v_actor,v_prior.profile_id,'compliance_evidence',v_prior.evidence_key,
    jsonb_build_object('evidence_version_id',v_id,'requirement_id',v_prior.requirement_id,'version',v_prior.version+1),
    'compliance-evidence-review:'||v_id::text,null,null,now()
  );

  return v_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.compliance_request_exception(p_requirement_id uuid, p_reason text, p_requested_until date DEFAULT NULL::date)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_org uuid:=public.app_org_id();
  v_actor uuid:=auth.uid();
  v_req public.compliance_requirements;
  v_policy public.compliance_policy_versions;
  v_key uuid:=gen_random_uuid();
  v_id uuid;
  v_applies boolean:=false;
begin
  if v_actor is null then raise exception 'Sign in to request an exception.' using errcode='42501'; end if;
  if length(btrim(coalesce(p_reason,'')))<3 then raise exception 'A reason is required.'; end if;

  select * into v_req
  from private.content_live_compliance_requirements
  where id=p_requirement_id and org_id=v_org;
  if v_req.id is null then raise exception 'Compliance requirement not found.'; end if;

  select * into v_policy
  from private.content_live_compliance_policy_versions
  where id=v_req.policy_version_id and org_id=v_org and state='active';
  if v_policy.id is null then raise exception 'The requirement is not on an active policy.'; end if;

  select exists(
    select 1
    from private.content_live_compliance_policy_applicability a
    left join public.employment_records er
      on er.profile_id=v_actor and er.org_id=v_org
    where a.policy_version_id=v_policy.id
      and (
        a.scope_kind='organisation'
        or (a.scope_kind='person' and a.profile_id=v_actor)
        or (a.scope_kind='unit' and a.unit_id=er.unit_id)
        or (a.scope_kind='employment_type' and a.employment_type=er.employment_type)
      )
  ) into v_applies;

  if not v_applies then
    raise exception 'This requirement is not applicable to your current record.' using errcode='42501';
  end if;

  insert into public.compliance_exception_versions(
    org_id,exception_key,version,profile_id,requirement_id,state,
    requested_until,reason,actor_id
  ) values (
    v_org,v_key,1,v_actor,v_req.id,'requested',
    p_requested_until,btrim(p_reason),v_actor
  )
  returning id into v_id;

  perform public.platform_emit_event(
    v_org,'compliance.exception_requested',v_actor,v_actor,
    'compliance_exception',v_key,
    jsonb_build_object('exception_version_id',v_id,'requirement_id',v_req.id,'requested_until',p_requested_until),
    'compliance-exception:'||v_id::text,null,null,now()
  );

  return v_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.compliance_exception_action(p_exception_version_id uuid, p_action text, p_note text, p_approved_until date DEFAULT NULL::date)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_org uuid:=public.app_org_id();
  v_actor uuid:=auth.uid();
  v_prior public.compliance_exception_versions;
  v_id uuid;
begin
  if v_actor is null or not public.app_has_capability('compliance.manage',null) then
    raise exception 'You do not have authority to decide compliance exceptions.' using errcode='42501';
  end if;
  if p_action not in ('approved','declined','resolved') then raise exception 'Choose a valid exception action.'; end if;
  if length(btrim(coalesce(p_note,'')))<3 then raise exception 'A decision note is required.'; end if;

  select * into v_prior
  from private.content_live_compliance_exception_versions
  where id=p_exception_version_id and org_id=v_org;
  if v_prior.id is null then raise exception 'Exception version not found.'; end if;
  if exists(select 1 from private.content_live_compliance_exception_versions where supersedes_id=v_prior.id) then
    raise exception 'That exception version already has a later state.';
  end if;

  if p_action in ('approved','declined') and v_prior.state<>'requested' then
    raise exception 'Only a requested exception can be approved or declined.';
  end if;
  if p_action='resolved' and v_prior.state<>'approved' then
    raise exception 'Only an approved exception can be resolved.';
  end if;

  insert into public.compliance_exception_versions(
    org_id,exception_key,version,profile_id,requirement_id,state,
    requested_until,approved_until,reason,note,supersedes_id,actor_id
  ) values (
    v_org,v_prior.exception_key,v_prior.version+1,v_prior.profile_id,v_prior.requirement_id,p_action,
    v_prior.requested_until,
    case when p_action='approved' then p_approved_until else v_prior.approved_until end,
    v_prior.reason,btrim(p_note),v_prior.id,v_actor
  )
  returning id into v_id;

  perform public.platform_emit_event(
    v_org,
    case p_action
      when 'approved' then 'compliance.exception_approved'
      when 'declined' then 'compliance.exception_declined'
      else 'compliance.exception_resolved'
    end,
    v_actor,v_prior.profile_id,'compliance_exception',v_prior.exception_key,
    jsonb_build_object('exception_version_id',v_id,'requirement_id',v_prior.requirement_id,'state',p_action,'approved_until',p_approved_until),
    'compliance-exception-action:'||v_id::text,null,null,now()
  );

  return v_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.performance_employee_release_visible(p_appraisal_id uuid, p_entry_created_at timestamp with time zone)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select coalesce(exists(
    select 1 from private.content_live_appraisals a
    join private.content_live_performance_review_release_requests d
      on d.appraisal_id=a.id and d.org_id=a.org_id
    where a.id=p_appraisal_id
      and a.org_id=public.app_org_id()
      and a.profile_id=auth.uid()
      and d.state='approved' and d.decided_at>=p_entry_created_at
  ),false);
$function$;

CREATE OR REPLACE FUNCTION public.performance_request_release(p_appraisal_id uuid, p_reason text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_org uuid:=public.app_org_id();
  v_actor uuid:=auth.uid();
  v_review public.appraisals%rowtype;
  v_assessment public.appraisal_entries%rowtype;
  v_request uuid;
begin
  if v_actor is null or v_org is null then
    raise exception 'Sign in to request an assessment release.' using errcode='42501';
  end if;
  if length(btrim(coalesce(p_reason,''))) not between 8 and 1000 then
    raise exception 'Record why this assessment is ready for HR review.';
  end if;
  select * into v_review from private.content_live_appraisals
  where id=p_appraisal_id and org_id=v_org for update;
  if v_review.id is null or v_review.manager_id is distinct from v_actor or v_review.status='closed' then
    raise exception 'Only the current reviewer of an open review may request release.' using errcode='42501';
  end if;
  select * into v_assessment from private.content_live_appraisal_entries
  where appraisal_id=v_review.id and org_id=v_org and entry_type='manager_assessment'
  order by created_at desc,id desc limit 1;
  if v_assessment.id is null then
    raise exception 'Record a manager-authored assessment before requesting release.';
  end if;
  if exists(
    select 1 from private.content_live_performance_review_release_requests d
    where d.appraisal_id=v_review.id and d.state='approved'
      and d.requested_assessment_id=v_assessment.id
  ) then
    raise exception 'The current assessment version has already been released by HR.';
  end if;
  insert into public.performance_review_release_requests(
    org_id,appraisal_id,requested_by,requested_assessment_id,request_reason
  ) values(v_org,v_review.id,v_actor,v_assessment.id,btrim(p_reason))
  returning id into v_request;

  insert into public.activity_events(org_id,actor_id,verb,object_type,object_id,meta)
  values(v_org,v_actor,'performance_release_requested','performance_review',v_review.id,
    jsonb_build_object('request_id',v_request,'assessment_id',v_assessment.id));
  return v_request;
end;
$function$;

CREATE OR REPLACE FUNCTION public.performance_hr_decide_release(p_request_id uuid, p_approve boolean, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
 v_org uuid:=public.app_org_id();
 v_actor uuid:=auth.uid();
 v_request public.performance_review_release_requests%rowtype;
 v_review public.appraisals%rowtype;
 v_latest uuid;
 v_ok boolean:=coalesce(p_approve,false);
 v_pastor_exception boolean:=false;
 v_hr boolean:=false;
BEGIN
 v_hr:=coalesce(public.app_is_admin() AND public.app_has_capability('people.manage',NULL),false);
 IF v_actor IS NULL OR v_org IS NULL
    OR NOT public.app_privileged_aal_allowed() OR NOT (
    v_hr OR EXISTS(SELECT 1 FROM public.profiles p
      WHERE p.id=v_actor AND p.org_id=v_org AND p.active
        AND p.is_exec AND NOT p.is_admin
        AND lower(btrim(coalesce(p.job_title,'')))='group pastor')
 ) THEN
   RAISE EXCEPTION 'Assessment publication authority is required.' USING ERRCODE='42501';
 END IF;
 IF length(btrim(coalesce(p_reason,''))) NOT BETWEEN 8 AND 1000 THEN
   RAISE EXCEPTION 'Record the HR release decision and reason.';
 END IF;
 SELECT * INTO v_request FROM private.content_live_performance_review_release_requests
 WHERE id=p_request_id AND org_id=v_org AND state='pending' FOR UPDATE;
 IF v_request.id IS NULL THEN
   RAISE EXCEPTION 'This pending assessment release request is unavailable.' USING ERRCODE='42501';
 END IF;
 SELECT * INTO v_review FROM private.content_live_appraisals
 WHERE id=v_request.appraisal_id AND org_id=v_org FOR UPDATE;
 -- Owner approval, 23 Oct: only the assigned Group Pastor may publish
 -- the active HR head's own review. No general HR publication/read grant.
 v_pastor_exception:=EXISTS(
   SELECT 1 FROM public.profiles actor
   JOIN public.profiles subject ON subject.id=v_review.profile_id
      AND subject.org_id=actor.org_id AND subject.active AND subject.is_admin
   JOIN public.employment_records er ON er.profile_id=subject.id
      AND er.org_id=subject.org_id AND er.employment_status='active'
   WHERE actor.id=v_actor AND actor.org_id=v_org AND actor.active
     AND actor.is_exec AND NOT actor.is_admin
     AND lower(btrim(coalesce(actor.job_title,'')))='group pastor'
     AND subject.id<>actor.id
     AND v_review.manager_id=actor.id
     AND v_review.reviewer_assigned_by IS NOT NULL
     AND length(btrim(coalesce(v_review.reviewer_assignment_reason,'')))>=3
     AND v_request.requested_by=actor.id
 );
 IF v_review.id IS NULL OR v_review.status='closed'
    OR v_actor=v_review.profile_id
    OR NOT (v_hr OR v_pastor_exception)
    OR (v_actor=v_request.requested_by AND NOT v_pastor_exception)
    OR (v_ok AND v_review.manager_id IS DISTINCT FROM v_request.requested_by) THEN
   RAISE EXCEPTION 'Authorised publication authority is required for this review.' USING ERRCODE='42501';
 END IF;
 SELECT id INTO v_latest FROM private.content_live_appraisal_entries
 WHERE appraisal_id=v_review.id AND org_id=v_org AND entry_type='manager_assessment'
 ORDER BY created_at DESC,id DESC LIMIT 1;
 IF v_ok AND v_latest IS DISTINCT FROM v_request.requested_assessment_id THEN
   RAISE EXCEPTION 'The manager assessment changed. Request HR review of the latest version.' USING ERRCODE='42501';
 END IF;
 UPDATE public.performance_review_release_requests
 SET state=CASE WHEN v_ok THEN 'approved' ELSE 'declined' END,
     decided_by=v_actor,decided_at=now(),decision_reason=btrim(p_reason)
 WHERE id=v_request.id;
 IF v_ok THEN
   UPDATE public.appraisals
   SET status='shared',shared_at=now(),shared_by=v_actor
   WHERE id=v_review.id;
 END IF;
 INSERT INTO public.activity_events(org_id,actor_id,verb,object_type,object_id,meta)
 VALUES(v_org,v_actor,'performance_hr_release_decided','performance_review',v_review.id,
    jsonb_build_object('request_id',v_request.id,'approved',v_ok,'assessment_id',v_latest,
      'subject_id',v_review.profile_id,'authority_scope',
      CASE WHEN v_pastor_exception THEN 'assigned_hr_head_group_pastor' ELSE 'independent_hr' END));
 RETURN jsonb_build_object('request_id',v_request.id,'approved',v_ok,
    'appraisal_id',v_review.id,'manager_assessment_id',v_latest);
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_operational_archive_records()
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
  UNION ALL SELECT 'announcements',p.id,p.org_id,p.title,p.status,md5(to_jsonb(p)::text) FROM public.announcements p
  UNION ALL SELECT 'learning_courses',p.id,p.org_id,p.title,p.state,md5(to_jsonb(p)::text) FROM public.learning_courses p WHERE public.app_has_capability('learning.manage')
  UNION ALL SELECT 'asset_items',p.id,p.org_id,p.asset_code,p.current_status,md5(to_jsonb(p)::text) FROM public.asset_items p WHERE public.app_has_capability('asset.manage')
  UNION ALL SELECT 'appraisal_cycles',p.id,p.org_id,p.name,p.status,md5(to_jsonb(p)::text) FROM public.appraisal_cycles p WHERE public.app_has_capability('performance.admin')
  UNION ALL SELECT 'meeting_sessions',p.id,p.org_id,p.title,p.status,md5(to_jsonb(p)::text) FROM public.meeting_sessions p
  UNION ALL SELECT 'compliance_policy_versions',p.id,p.org_id,p.title,p.state,md5(to_jsonb(p)::text) FROM public.compliance_policy_versions p WHERE public.app_has_capability('compliance.manage')
  UNION ALL SELECT 'strategy_nodes',p.id,p.org_id,p.name,p.status,md5(to_jsonb(p)::text) FROM public.strategy_nodes p WHERE public.app_has_capability('strategy.manage')
 ) SELECT r.kind,r.id,r.label,r.status,coalesce(e.archived,false),coalesce(e.event_no,0),CASE WHEN r.kind IN ('announcements','learning_courses','asset_items','appraisal_cycles','meeting_sessions','compliance_policy_versions','strategy_nodes') THEN private.content_archive_fingerprint(r.kind,r.id,r.org_id) ELSE r.fingerprint END,
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

CREATE OR REPLACE FUNCTION public.admin_apply_operational_archive(p_changes jsonb,p_reason text)
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
  IF v_table IS NULL OR v_table NOT IN ('projects','work_items','report_periods','announcements','learning_courses','asset_items','appraisal_cycles','meeting_sessions','compliance_policy_versions','strategy_nodes') OR v_id IS NULL
   OR j->>'fingerprint' IS NULL OR j->>'event_no' IS NULL OR jsonb_typeof(j->'archived') IS DISTINCT FROM 'boolean' THEN
   RAISE EXCEPTION 'Refresh the selected record details.';
  END IF;
  IF (v_table='learning_courses' AND NOT public.app_has_capability('learning.manage'))
   OR (v_table='asset_items' AND NOT public.app_has_capability('asset.manage'))
   OR (v_table='appraisal_cycles' AND NOT public.app_has_capability('performance.admin'))
   OR (v_table='compliance_policy_versions' AND NOT public.app_has_capability('compliance.manage'))
   OR (v_table='strategy_nodes' AND NOT public.app_has_capability('strategy.manage')) THEN
   RAISE EXCEPTION 'That content administration access is not assigned.' USING ERRCODE='42501';
  END IF;
  EXECUTE format('SELECT to_jsonb(t) FROM public.%I t WHERE t.id=$1 AND t.org_id=$2 FOR UPDATE',v_table)
   INTO v_row USING v_id,v_org;
  IF v_row IS NULL OR (v_table='work_items' AND v_row->>'visibility'='private' AND (v_row->>'assignee_id')::uuid IS DISTINCT FROM auth.uid()) THEN
   RAISE EXCEPTION 'That operational record is unavailable.' USING ERRCODE='42501';
  END IF;
  SELECT e.event_no,e.archived INTO v_previous FROM public.operational_archive_events e
   WHERE e.org_id=v_org AND e.record_table=v_table AND e.record_id=v_id ORDER BY e.event_no DESC LIMIT 1;
  IF (CASE WHEN v_table IN ('announcements','learning_courses','asset_items','appraisal_cycles','meeting_sessions','compliance_policy_versions','strategy_nodes') THEN private.content_archive_fingerprint(v_table,v_id,v_org) ELSE md5(v_row::text) END)<>j->>'fingerprint' OR coalesce(v_previous.event_no,0)<>(j->>'event_no')::bigint THEN
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
  IF v_archive AND v_table='strategy_nodes' THEN
   IF EXISTS(SELECT 1 FROM public.strategy_nodes n WHERE n.parent_id=v_id
    AND NOT public.operational_record_is_archived('strategy_nodes',n.id,v_org)
    AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_changes) c WHERE c->>'record_table'='strategy_nodes' AND c->>'record_id'=n.id::text AND (c->>'archived')::boolean))
    OR EXISTS(SELECT 1 FROM public.strategy_delivery_links l WHERE l.strategy_node_id=v_id AND NOT public.operational_record_is_archived('projects',l.project_id,v_org))
    OR EXISTS(SELECT 1 FROM public.delivery_groups g JOIN public.delivery_group_projects gp ON gp.delivery_group_id=g.id
      WHERE g.strategy_node_id=v_id AND NOT public.operational_record_is_archived('projects',gp.project_id,v_org)) THEN
    RAISE EXCEPTION 'Review live strategy children and linked projects before archiving.';
   END IF;
  END IF;
  IF NOT v_archive AND v_table='strategy_nodes' AND public.operational_record_is_archived('strategy_nodes',(v_row->>'parent_id')::uuid,v_org) THEN
   RAISE EXCEPTION 'Restore the parent ministry objective first.';
  END IF;
  IF v_archive AND v_table='meeting_sessions' AND EXISTS(SELECT 1 FROM public.meeting_work_links l
   WHERE l.meeting_id=v_id AND NOT public.operational_record_is_archived('work_items',l.work_item_id,v_org)) THEN
   RAISE EXCEPTION 'Review linked live meeting work before archiving.';
  END IF;
  IF v_archive AND v_table='compliance_policy_versions' AND EXISTS(SELECT 1 FROM public.compliance_policy_versions p
   WHERE p.supersedes_id=v_id AND NOT public.operational_record_is_archived('compliance_policy_versions',p.id,v_org)) THEN
   RAISE EXCEPTION 'Retain the adopted policy history for separate review.';
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
