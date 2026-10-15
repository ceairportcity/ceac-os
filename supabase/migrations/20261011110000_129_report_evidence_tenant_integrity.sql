-- 129 — Forward-only report submission evidence tenant integrity (REVIEW DRAFT).
-- Based on read-only live production function definition at frozen PR #44.
-- Earlier forward migration 127 constrains report-period/unit/project links.
-- This function also inserts evidence referencing work items, submissions,
-- and sessions under SECURITY DEFINER, which bypasses RLS. Plain foreign IDs
-- and unit equality do not prove the referenced row's org_id matches report.
-- Require same-org evidence rows and same-org session membership, and assert
-- the report and its period are in the authenticated caller's organisation.
-- Function signature, existing grant privileges, outer save/submit, date
-- range, visibility and normal accepted evidence formats remain unchanged.
-- Do not apply to live Supabase before isolated 130 baseline + 127/128/129
-- replay, role/SQL tests, encrypted full backup/actual restore and owner signoff.
-- No direct grants, schema drops, or existing row rewrites.

CREATE OR REPLACE FUNCTION public.save_and_submit_report(p_period_id uuid, p_scope text, p_unit_id uuid, p_project_id uuid DEFAULT NULL::uuid, p_narrative text DEFAULT NULL::text, p_challenges text DEFAULT NULL::text, p_evidence jsonb DEFAULT NULL::jsonb, p_refs jsonb DEFAULT '[]'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_report uuid;
  r public.reports;
  rp public.report_periods;
  j jsonb;
  v_type text;
  v_object uuid;
begin
  v_report:=public.save_report_draft(p_period_id,p_scope,p_unit_id,p_project_id,p_narrative,p_challenges);
  select * into r from public.reports where id=v_report for update;
  select * into rp from public.report_periods where id=p_period_id;
  if r.org_id is distinct from public.app_org_id()
     or rp.org_id is distinct from r.org_id
     or r.period_id is distinct from rp.id then
    raise exception 'That report or period belongs to another organisation.' using errcode='42501';
  end if;

  delete from public.report_evidence_refs where report_id=v_report;

  for j in select * from jsonb_array_elements(coalesce(p_refs,'[]'::jsonb)) loop
    v_type:=j->>'object_type';
    v_object:=(j->>'object_id')::uuid;
    if v_type='work_item' then
      if not exists(
        select 1 from public.work_items w
        where w.id=v_object and w.org_id=r.org_id and w.unit_id=p_unit_id
          and (p_scope<>'project' or w.project_id=p_project_id)
          and w.visibility<>'private'
      ) then raise exception 'A report work reference is outside this report scope.'; end if;
    elsif v_type='submission' then
      if not exists(
        select 1 from public.submissions s join public.work_items w on w.id=s.work_item_id
        where s.id=v_object and s.org_id=r.org_id
          and w.org_id=r.org_id and w.unit_id=p_unit_id
          and (p_scope<>'project' or w.project_id=p_project_id)
          and w.visibility<>'private'
          and s.submitted_at>=rp.starts_on::timestamptz
          and s.submitted_at<(rp.ends_on+1)::timestamptz
      ) then raise exception 'A report submission reference is outside this report scope or period.'; end if;
    elsif v_type='work_session' then
      if not exists(
        select 1 from public.work_sessions ws
        join public.unit_memberships um on um.profile_id=ws.profile_id
          and um.org_id=r.org_id and um.unit_id=p_unit_id
        where ws.id=v_object and ws.org_id=r.org_id
          and ws.started_at>=rp.starts_on::timestamptz
          and ws.started_at<(rp.ends_on+1)::timestamptz
      ) then raise exception 'A report session reference is outside this unit or period.'; end if;
    else
      raise exception 'Unsupported report evidence type: %',v_type;
    end if;

    insert into public.report_evidence_refs(report_id,section,object_type,object_id,label)
    values(v_report,j->>'section',v_type,v_object,nullif(j->>'label',''));
  end loop;

  perform public.submit_report(v_report,p_evidence);

  insert into public.activity_events(org_id,actor_id,verb,object_type,object_id,meta)
  values(r.org_id,auth.uid(),'report_submitted','report',v_report,
    jsonb_build_object('scope',p_scope,'unit_id',p_unit_id,'project_id',p_project_id,'evidence_ref_count',jsonb_array_length(coalesce(p_refs,'[]'::jsonb))));

  return v_report;
end;
$function$
