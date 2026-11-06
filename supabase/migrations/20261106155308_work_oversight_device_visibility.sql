-- The named supervisor can differ from final reviewer, especially Admin-assigned work.
-- Reuse the same active-actor, tenant and shared-work authority for device delivery.
CREATE OR REPLACE FUNCTION public.ceac_push_context_visible(p_kind text,p_id uuid,p_profile uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT p_profile IS NOT NULL AND (select org_id from public.profiles where id=p_profile and active) IS NOT NULL
 AND true
 AND CASE
 WHEN p_kind='routine_occurrence' THEN EXISTS(select 1 from public.operation_occurrences o join public.recurring_operations r on r.id=o.operation_id and r.org_id=o.org_id join public.work_items w on w.id=r.work_item_id and w.org_id=o.org_id where o.id=p_id and w.visibility='unit' and not w.confidential and (o.recorded_by=p_profile or private.routine_date_assignee(r.id,o.occurred_on)=p_profile))
 WHEN p_kind='room' THEN private.ceac_profile_room(p_id,p_profile)
 WHEN p_kind='leave' THEN EXISTS(select 1 from public.leave_requests l where l.id=p_id and l.org_id=(select org_id from public.profiles where id=p_profile and active) and (l.profile_id=p_profile or ((select is_admin from public.profiles where id=p_profile and active) and private.ceac_profile_capability(p_profile,'workforce.manage',null))))
 WHEN p_kind='meeting' THEN EXISTS(select 1 from public.meeting_sessions m where m.id=p_id and m.org_id=(select org_id from public.profiles where id=p_profile and active) and (m.created_by=p_profile or exists(select 1 from public.meeting_participants mp where mp.meeting_id=m.id and mp.profile_id=p_profile)))
 WHEN p_kind='compliance_case' THEN EXISTS (
  SELECT 1 FROM public.compliance_attendance_cases c WHERE c.id=p_id
  AND c.org_id=(select org_id from public.profiles where id=p_profile and active) AND private.ceac_profile_case(c.employee_id,p_profile))
 WHEN p_kind='support_case' THEN EXISTS (
  SELECT 1 FROM public.support_cases sc WHERE sc.id=p_id AND sc.org_id=(select org_id from public.profiles where id=p_profile and active)
  AND private.ceac_profile_capability(p_profile,'support.case.manage',NULL)
  AND EXISTS(SELECT 1 FROM public.support_team_memberships stm WHERE stm.org_id=sc.org_id
    AND stm.profile_id=p_profile AND stm.active)
 )
 WHEN p_kind='memo' THEN EXISTS(select 1 from public.memos m where m.id=p_id and m.org_id=(select org_id from public.profiles where id=p_profile and active) and (m.sender_id=p_profile or (m.status<>'draft' and exists(select 1 from public.memo_recipients r where r.memo_id=m.id and r.profile_id=p_profile))))
 WHEN p_kind='work_item' THEN private.work_oversight_visible(p_id,p_profile) OR EXISTS (
  SELECT 1 FROM public.work_items w WHERE w.id=p_id AND w.org_id=(select org_id from public.profiles where id=p_profile and active)
  AND (w.assignee_id=p_profile OR private.ceac_responsible_reviewer_id(w.id)=p_profile) AND w.visibility<>'private')
 WHEN p_kind='compliance_evidence' THEN EXISTS (
  SELECT 1 FROM public.compliance_evidence_versions e
  WHERE e.id=p_id AND e.org_id=(select org_id from public.profiles where id=p_profile and active)
  AND private.content_record_is_live('compliance_evidence_versions',to_jsonb(e.*))
  AND (e.profile_id=p_profile OR private.ceac_profile_capability(p_profile,'compliance.manage',NULL)
   OR EXISTS(SELECT 1 FROM public.employment_records er
    WHERE er.org_id=e.org_id AND er.profile_id=e.profile_id
    AND er.unit_id IN (SELECT private.ceac_profile_units(p_profile,true)))))
 WHEN p_kind='compliance_exception' THEN EXISTS (
  SELECT 1 FROM public.compliance_exception_versions e
  WHERE e.id=p_id AND e.org_id=(select org_id from public.profiles where id=p_profile and active)
  AND private.content_record_is_live('compliance_exception_versions',to_jsonb(e.*))
  AND (e.profile_id=p_profile OR private.ceac_profile_capability(p_profile,'compliance.manage',NULL)
   OR EXISTS(SELECT 1 FROM public.employment_records er
    WHERE er.org_id=e.org_id AND er.profile_id=e.profile_id
    AND er.unit_id IN (SELECT private.ceac_profile_units(p_profile,true)))))
 WHEN p_kind='compliance_policy' THEN EXISTS (
  SELECT 1 FROM public.compliance_policy_versions p
  WHERE p.id=p_id AND p.org_id=(select org_id from public.profiles where id=p_profile and active)
  AND private.content_record_is_live('compliance_policy_versions',to_jsonb(p.*))
  AND (private.ceac_profile_capability(p_profile,'compliance.manage',NULL) OR EXISTS(
   SELECT 1 FROM public.compliance_policy_applicability a
   WHERE a.policy_version_id=p.id AND a.org_id=p.org_id
   AND (a.scope_kind='organisation'
    OR (a.scope_kind='person' AND a.profile_id=p_profile)
    OR (a.scope_kind='unit' AND
      (a.unit_id IN(SELECT er.unit_id FROM public.employment_records er
        WHERE er.profile_id=p_profile AND er.org_id=p.org_id)
       OR a.unit_id IN(SELECT private.ceac_profile_units(p_profile,true)) OR a.unit_id IN(SELECT private.ceac_profile_units(p_profile,false))))
    OR (a.scope_kind='employment_type' AND EXISTS(
      SELECT 1 FROM public.employment_records er WHERE er.profile_id=p_profile
      AND er.org_id=p.org_id AND er.employment_type=a.employment_type))
    OR (a.scope_kind='person' AND EXISTS(
      SELECT 1 FROM public.employment_records er
      WHERE er.profile_id=a.profile_id AND er.org_id=p.org_id
      AND er.unit_id IN(SELECT private.ceac_profile_units(p_profile,true))))
   )))
  )
 ELSE false END;
$function$
;
revoke all on function public.ceac_push_context_visible(text,uuid,uuid) from public,anon,authenticated;
grant execute on function public.ceac_push_context_visible(text,uuid,uuid) to service_role;
