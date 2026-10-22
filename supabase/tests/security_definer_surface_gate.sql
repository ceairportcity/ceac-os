\set ON_ERROR_STOP on

begin;

-- Current release exact authenticated SECURITY DEFINER allowlist.
-- Source migration versions 140-146 add 12 reviewed caller/tenant-bound
-- interfaces and revoke legacy direct attendance correction EXECUTE (-1).
-- Expected = prior 135 + 12 - 2 = 145, with both obsolete grants revoked.
-- A count-only ceiling can be bypassed by replacing one reviewed RPC with a
-- different one. This table therefore locks the exact reviewed signatures.

create temporary table s2_expected_authenticated_definers(
  signature text primary key
) on commit drop;

insert into s2_expected_authenticated_definers(signature) values
  ('public.admin_access_invitations()'),
  ('public.admin_employment_detail(p_profile_id uuid)'),
  ('public.admin_people_summary()'),
  ('public.admin_person_detail(p_profile_id uuid)'),
  ('public.admin_record_unit_responsibility(p_profile_id uuid, p_unit_id uuid, p_role text, p_action text, p_reason text)'),
  ('public.admin_revoke_staff_invitation(p_invitation_id uuid, p_reason text)'),
  ('public.admin_set_work_lane_membership(p_profile_id uuid, p_sub_team_id uuid, p_member boolean, p_reason text)'),
  ('public.admin_update_employment(p_profile_id uuid, p_employment_type text, p_job_title text, p_unit_id uuid, p_manager_profile_id uuid, p_membership_role text, p_working_pattern jsonb, p_employment_status text, p_joined_on date, p_exited_on date, p_change_type text, p_effective_on date, p_reason text, p_correction_of uuid)'),
  ('public.announcement_audience_counts(p_announcement_id uuid)'),
  ('public.app_can_access_operational_file(p_file_id uuid)'),
  ('public.app_can_access_room(p_room_id uuid)'),
  ('public.app_can_manage_meeting(p_meeting_id uuid)'),
  ('public.app_can_read_operational_context(p_context_type text, p_context_id uuid)'),
  ('public.app_can_review_item(item_id uuid)'),
  ('public.app_can_see_item(item_id uuid)'),
  ('public.app_has_capability(p_capability text, p_unit_id uuid)'),
  ('public.app_is_admin()'),
  ('public.app_is_exec()'),
  ('public.app_led_sub_teams()'),
  ('public.app_managed_units()'),
  ('public.app_my_units()'),
  ('public.app_org_id()'),
  ('public.app_stage2_universal_aal_allowed()'),
  ('public.app_visible_profiles()'),
  ('public.app_visible_projects()'),
  ('public.app_visible_units()'),
  ('public.approve_work_submission(p_submission_id uuid, p_comment text)'),
  ('public.asset_assign(p_asset_id uuid, p_profile_id uuid, p_unit_id uuid, p_location text, p_expected_return_on date, p_condition_note text, p_reason text)'),
  ('public.asset_lifecycle_action(p_asset_id uuid, p_action text, p_note text, p_reason text)'),
  ('public.asset_record_item(p_asset_id uuid, p_asset_code text, p_category text, p_manufacturer text, p_model text, p_serial_number text, p_purchase_date date, p_purchase_vendor text, p_purchase_cost numeric, p_purchase_currency text, p_warranty_expires_on date, p_unit_id uuid, p_location text, p_condition_note text, p_notes text)'),
  ('public.asset_return(p_asset_id uuid, p_location text, p_condition_note text, p_reason text)'),
  ('public.assign_performance_reviewer(p_appraisal_id uuid, p_reviewer_id uuid, p_reason text)'),
  ('public.assign_unit_head(p_unit_id uuid, p_profile_id uuid)'),
  ('public.attendance_corroboration_for_day(p_date date)'),
  ('public.attendance_create_notice(p_kind text, p_starts_at timestamp with time zone, p_expected_return_at timestamp with time zone, p_reason text, p_note text)'),
  ('public.attendance_day_evidence(p_date date)'),
  ('public.attendance_hr_audit_correction(p_request_id uuid, p_outcome text, p_note text)'),
  ('public.attendance_integrity_status()'),
  ('public.attendance_manager_decide_correction(p_request_id uuid, p_approve boolean, p_note text)'),
  ('public.attendance_record_return(p_work_item_id uuid)'),
  ('public.attendance_request_correction(p_profile_id uuid, p_work_date date, p_correction_type text, p_context jsonb, p_reason text, p_session_id uuid)'),
  ('public.attendance_respond_notice(p_work_item_id uuid, p_outcome text, p_note text)'),
  ('public.attendance_set_office_code(p_enabled boolean, p_ttl_minutes integer, p_office_location_id uuid)'),
  ('public.attendance_set_office_code(p_enabled boolean, p_ttl_minutes integer)'),
  ('public.attendance_verify_office_code(p_code text, p_session_id uuid)'),
  ('public.change_routine_schedule(p_work_item_id uuid, p_effective_from date, p_schedule_kind text, p_weekdays smallint[], p_day_of_month integer, p_ends_on date)'),
  ('public.close_announcement(p_announcement_id uuid)'),
  ('public.close_performance_review_cycle(p_cycle_id uuid, p_reason text)'),
  ('public.close_project(p_project_id uuid)'),
  ('public.complete_workflow_step(p_run_step_id uuid, p_outcome text, p_note text)'),
  ('public.compliance_acknowledge_policy(p_policy_version_id uuid, p_statement text)'),
  ('public.compliance_exception_action(p_exception_version_id uuid, p_action text, p_note text, p_approved_until date)'),
  ('public.compliance_record_policy(p_policy_key uuid, p_title text, p_category text, p_summary text, p_body_text text, p_state text, p_effective_on date, p_expires_on date, p_source_reference text, p_reason text, p_applicability jsonb, p_requirements jsonb, p_supersedes_id uuid)'),
  ('public.compliance_request_exception(p_requirement_id uuid, p_reason text, p_requested_until date)'),
  ('public.compliance_review_evidence(p_evidence_version_id uuid, p_action text, p_reviewer_note text)'),
  ('public.compliance_submit_evidence(p_requirement_id uuid, p_evidence_reference text, p_note text, p_issued_on date, p_expires_on date, p_supersedes_id uuid)'),
  ('public.continue_work_session_with_location(p_session_id uuid, p_lat double precision, p_lng double precision, p_accuracy_m double precision, p_captured_at timestamp with time zone)'),
  ('public.correct_report(p_report_id uuid, p_reason text)'),
  ('public.create_announcement(p_title text, p_body text, p_priority text, p_requires_acknowledgement boolean, p_expires_at timestamp with time zone, p_all_org boolean, p_unit_ids uuid[], p_roles text[])'),
  ('public.create_ministry_number(p_unit_id uuid, p_name text, p_value_label text)'),
  ('public.create_pending_invitation(p_email text, p_full_name text, p_unit_id uuid, p_role text)'),
  ('public.create_project_with_participants(p_lead_unit_id uuid, p_name text, p_purpose text, p_starts_on date, p_ends_on date, p_participant_unit_ids uuid[])'),
  ('public.create_task_with_checklist(p_unit_id uuid, p_assignee_id uuid, p_title text, p_expected_outcome text, p_sub_team_id uuid, p_project_id uuid, p_objective_id uuid, p_phase_id uuid, p_purpose text, p_instructions text, p_due_at timestamp with time zone, p_origin text, p_visibility text, p_steps text[])'),
  ('public.create_typed_work(p_kind text, p_unit_id uuid, p_title text, p_assignee_id uuid, p_sub_team_id uuid, p_project_id uuid, p_phase_id uuid, p_objective_id uuid, p_responsibility_id uuid, p_purpose text, p_expected_outcome text, p_due_at timestamp with time zone, p_visibility text, p_confidential boolean, p_details jsonb)'),
  ('public.decide_finance_request(p_request_id uuid, p_decision text, p_note text)'),
  ('public.end_work_session_with_location(p_session_id uuid, p_lat double precision, p_lng double precision, p_accuracy_m double precision, p_captured_at timestamp with time zone, p_device_time timestamp with time zone, p_failure text)'),
  ('public.end_work_session(p_session_id uuid)'),
  ('public.finalize_operational_file(p_file_id uuid)'),
  ('public.follow_up_blocker(p_blocker_id uuid)'),
  ('public.follow_up_work_review(p_work_item_id uuid)'),
  ('public.fulfil_finance_request(p_request_id uuid, p_spent_on date, p_source_note text)'),
  ('public.grant_capability(p_profile_id uuid, p_capability text, p_scope_unit_id uuid, p_reason text, p_expires_at timestamp with time zone)'),
  ('public.hr_employee_protected_record(p_employee_id uuid, p_record_type text, p_payload jsonb, p_replaces_id uuid, p_reason text)'),
  ('public.hr_employee_protected_summary(p_employee_id uuid)'),
  ('public.hr_protected_record(p_profile_id uuid, p_record_type text, p_payload jsonb, p_replaces_id uuid, p_reason text)'),
  ('public.hr_protected_summary(p_profile_id uuid)'),
  ('public.learning_admin_action(p_assignment_id uuid, p_action text, p_module_id uuid, p_reason text)'),
  ('public.learning_complete_module(p_assignment_id uuid, p_module_id uuid)'),
  ('public.link_operational_file(p_file_id uuid, p_context_type text, p_context_id uuid, p_relation text)'),
  ('public.list_unit_approved_leave(p_unit_id uuid, p_from date, p_to date)'),
  ('public.mark_announcement_read(p_announcement_id uuid, p_acknowledge boolean)'),
  ('public.mark_room_read(p_room_id uuid)'),
  ('public.my_account_activity(p_limit integer)'),
  ('public.my_sessions()'),
  ('public.next_objective_ref(p_project_id uuid, p_unit_id uuid)'),
  ('public.open_performance_review_cycle(p_name text, p_starts_on date, p_ends_on date, p_reason text)'),
  ('public.payroll_approve_run(p_run_id uuid, p_note text)'),
  ('public.payroll_create_correction(p_source_run_id uuid, p_reason text)'),
  ('public.payroll_create_run(p_label text, p_period_start date, p_period_end date, p_currency text, p_pay_date date, p_note text)'),
  ('public.payroll_list_runs()'),
  ('public.payroll_readiness_summary()'),
  ('public.payroll_run_detail(p_run_id uuid)'),
  ('public.payroll_set_line(p_run_id uuid, p_profile_id uuid, p_line_id uuid, p_category text, p_direction text, p_label text, p_amount_minor bigint, p_note text)'),
  ('public.payroll_submit_run(p_run_id uuid, p_note text)'),
  ('public.performance_employee_release_visible(p_appraisal_id uuid, p_entry_created_at timestamp with time zone)'),
  ('public.performance_hr_decide_release(p_request_id uuid, p_approve boolean, p_reason text)'),
  ('public.performance_request_release(p_appraisal_id uuid, p_reason text)'),
  ('public.prepare_staff_invitation_resend(p_invitation_id uuid)'),
  ('public.project_close_readiness(p_project_id uuid)'),
  ('public.provide_request_clarification(p_work_item_id uuid, p_note text)'),
  ('public.publish_announcement(p_announcement_id uuid)'),
  ('public.raise_work_blocker(p_work_item_id uuid, p_party_unit_id uuid, p_party_text text, p_note text)'),
  ('public.reconcile_closed_work_session(p_session_id uuid, p_effective_ended_at timestamp with time zone, p_note text)'),
  ('public.reconcile_work_session(p_session_id uuid, p_action text, p_effective_ended_at timestamp with time zone, p_note text)'),
  ('public.record_appraisal_entry(p_appraisal_id uuid, p_entry_type text, p_body text, p_supersedes_id uuid)'),
  ('public.record_development_plan_version(p_appraisal_id uuid, p_focus text, p_desired_outcome text, p_next_steps text, p_starts_on date, p_target_on date, p_state text, p_reason text, p_supersedes_id uuid)'),
  ('public.record_ministry_number(p_operation_id uuid, p_occurred_on date, p_value numeric, p_note text)'),
  ('public.record_performance_feedback(p_profile_id uuid, p_kind text, p_note text, p_occurred_on date, p_work_item_id uuid, p_project_id uuid, p_strategy_node_id uuid)'),
  ('public.record_routine_occurrence(p_work_item_id uuid, p_occurred_on date, p_value numeric, p_note text)'),
  ('public.record_work_checkpoint(p_session_id uuid, p_type text, p_lat double precision, p_lng double precision, p_accuracy_m double precision, p_captured_at timestamp with time zone, p_device_time timestamp with time zone, p_failure text)'),
  ('public.record_work_decision(p_work_item_id uuid, p_decision text, p_rationale text)'),
  ('public.refresh_performance_evidence(p_appraisal_id uuid)'),
  ('public.register_operational_file(p_context_type text, p_context_id uuid, p_relation text, p_filename text, p_mime_type text, p_size_bytes bigint)'),
  ('public.reopen_approved_work(p_work_item_id uuid, p_reason text)'),
  ('public.reopen_project(p_project_id uuid, p_reason text)'),
  ('public.resolve_blocker(p_blocker_id uuid, p_note text)'),
  ('public.resolve_work_case(p_work_item_id uuid, p_resolution_note text)'),
  ('public.respond_to_blocker(p_blocker_id uuid, p_state text, p_note text)'),
  ('public.respond_to_performance_feedback(p_feedback_note_id uuid, p_response text)'),
  ('public.respond_work_request(p_work_item_id uuid, p_outcome text, p_note text)'),
  ('public.return_work_for_correction(p_submission_id uuid, p_comment text, p_checklist_item_ids uuid[])'),
  ('public.revoke_capability(p_grant_id uuid, p_reason text)'),
  ('public.save_and_submit_project_close(p_project_id uuid, p_scope text, p_unit_id uuid, p_deliverables_note text, p_challenges text, p_do_differently text, p_objectives jsonb, p_deliverables jsonb, p_costs jsonb)'),
  ('public.save_and_submit_report(p_period_id uuid, p_scope text, p_unit_id uuid, p_project_id uuid, p_narrative text, p_challenges text, p_evidence jsonb, p_refs jsonb)'),
  ('public.save_report_draft(p_period_id uuid, p_scope text, p_unit_id uuid, p_project_id uuid, p_narrative text, p_challenges text)'),
  ('public.save_unit_resource(p_resource_id uuid, p_unit_id uuid, p_title text, p_category text, p_reference_url text, p_description text, p_visibility text, p_pinned boolean, p_sort_order integer)'),
  ('public.schedule_meeting(p_scope text, p_unit_id uuid, p_project_id uuid, p_title text, p_agenda text, p_starts_at timestamp with time zone, p_ends_at timestamp with time zone, p_provider text, p_join_url text, p_location text, p_audience jsonb)'),
  ('public.self_certify_work(p_work_item_id uuid, p_session_id uuid, p_note text, p_link text)'),
  ('public.send_room_message(p_room_id uuid, p_body text, p_reply_to_id uuid, p_refs jsonb, p_mention_ids uuid[])'),
  ('public.set_routine_paused(p_work_item_id uuid, p_paused boolean, p_reason text)'),
  ('public.set_unit_resource_active(p_resource_id uuid, p_active boolean)'),
   ('public.submit_work_for_review(p_work_item_id uuid, p_session_id uuid, p_note text, p_link text)'),
  ('public.swap_sub_team_positions(p_first_id uuid, p_second_id uuid)'),
  ('public.unit_budget_position(p_unit_id uuid, p_year integer)'),
  ('public.update_announcement(p_announcement_id uuid, p_title text, p_body text, p_priority text, p_requires_acknowledgement boolean, p_expires_at timestamp with time zone, p_all_org boolean, p_unit_ids uuid[], p_roles text[])'),
  ('public.update_my_personal_details(p_preferred_name text, p_phone text, p_birthday date, p_emergency_contact_name text, p_emergency_contact_phone text, p_emergency_contact_relationship text, p_address_text text, p_social_handles jsonb)'),
  ('public.volunteer_approve_invitation(p_invitation_id uuid, p_reason text)'),
  ('public.volunteer_reimbursement_request(p_kind text, p_amount_minor bigint, p_activity_context text, p_reason text)'),
  ('public.volunteer_reimbursement_review(p_request_id uuid, p_action text, p_note text)'),
  ('public.volunteer_request_invitation(p_email text, p_full_name text, p_unit_id uuid, p_working_pattern jsonb)'),
  ('public.workforce_leave_action(p_leave_request_id uuid, p_action text, p_reason text)'),
  ('public.workforce_record_day_type(p_id uuid, p_name text, p_description text, p_session_expected boolean, p_leave_overlay_allowed boolean, p_active boolean)'),
  ('public.workforce_record_leave_policy(p_name text, p_effective_from date, p_effective_to date, p_source_reference text, p_reason text, p_rules jsonb, p_activate boolean, p_supersedes_id uuid)'),
  ('public.workforce_record_pattern(p_profile_id uuid, p_unit_id uuid, p_effective_from date, p_effective_to date, p_day_map jsonb, p_clock_map jsonb, p_reason text, p_supersedes_id uuid)'),
  ('public.workforce_record_roster_pattern(p_employee_id uuid, p_effective_from date, p_effective_to date, p_day_map jsonb, p_clock_map jsonb, p_reason text, p_supersedes_id uuid)'),
  ('public.workforce_record_schedule(p_profile_id uuid, p_unit_id uuid, p_effective_from date, p_effective_to date, p_source text, p_day_map jsonb, p_expected_start time without time zone, p_expected_end time without time zone, p_reason text, p_supersedes_id uuid)');

-- Two explicitly scoped owner-correction interfaces, covered by the rollback-only
-- stage2_owner_activity_guard_gate.sql. The original signatures remain unchanged.
insert into s2_expected_authenticated_definers(signature) values
 ('public.stage2_relink_own_work(p_work_item_id uuid, p_project_id uuid, p_objective_id uuid, p_phase_id uuid, p_reason text)'),
 ('public.stage2_record_project_person_assessment(p_project_id uuid, p_subject_profile_id uuid, p_narrative text, p_evidence_note text, p_next_action text, p_project_close_id uuid, p_period_start date, p_period_end date)');

-- Additional owner-correction interfaces are individually enumerated and
-- covered by roster and one-date negative-role gates; not a generic ceiling raise.
insert into s2_expected_authenticated_definers(signature) values
 ('public.admin_record_roster_employment(p_employee_id uuid, p_expected_updated_at timestamp with time zone, p_full_name text, p_preferred_name text, p_job_title text, p_employment_type text, p_employment_status text, p_primary_unit_id uuid, p_secondary_unit_ids uuid[], p_manager_profile_id uuid, p_reason text)'),
 ('public.routine_change_single_date(p_work_item_id uuid, p_scheduled_on date, p_action text, p_reason text, p_expected_version integer)'),
 ('public.routine_set_date_cover(p_work_item_id uuid, p_scheduled_on date, p_assignee_id uuid, p_reason text, p_expected_version integer)');

-- Precisely reviewed owner corrective HR and Compliance surfaces in 178–181.
-- The internal Compliance visibility helper deliberately has NO authenticated
-- execute grant and therefore MUST NOT be added to this REST allowlist.
insert into s2_expected_authenticated_definers(signature) values
 ('public.admin_confirm_existing_roster_account_link(p_employee_id uuid, p_profile_id uuid, p_expected_updated_at timestamp with time zone, p_evidence_file_id uuid, p_confirmed_account_email text, p_independently_verified boolean, p_reason text)'),
 ('public.admin_employee_published_development(p_profile_id uuid)'),
 ('public.admin_record_roster_employment_profile(p_employee_id uuid, p_expected_updated_at timestamp with time zone, p_full_name text, p_preferred_name text, p_job_title text, p_employment_type text, p_employment_status text, p_primary_unit_id uuid, p_secondary_unit_ids uuid[], p_manager_profile_id uuid, p_contact_email text, p_contact_phone text, p_started_on date, p_reason text)'),
 ('public.compliance_attendance_case_action(p_case_id uuid, p_expected_status text, p_action text, p_explanation text, p_evidence_reference text, p_referral_target text)'),
 ('public.compliance_attendance_case_register(p_date_from date, p_date_to date)'),
 ('public.compliance_record_attendance_observation(p_employee_id uuid, p_work_date date, p_category text, p_factual_note text, p_interpretation_note text, p_evidence_reference text)');

do $allowlist$
declare
  v_unexpected text;
  v_missing text;
  v_actual integer;
  v_expected integer;
begin
  with actual as (
    select format('%I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)) as signature
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.prosecdef
      and has_function_privilege('authenticated',p.oid,'EXECUTE')
  )
  select count(*) into v_actual from actual;

  select count(*) into v_expected from s2_expected_authenticated_definers;

  with actual as (
    select format('%I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)) as signature
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.prosecdef
      and has_function_privilege('authenticated',p.oid,'EXECUTE')
  )
  select string_agg(a.signature,E'\n' order by a.signature)
    into v_unexpected
  from actual a
  left join s2_expected_authenticated_definers e using(signature)
  where e.signature is null;

  with actual as (
    select format('%I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)) as signature
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.prosecdef
      and has_function_privilege('authenticated',p.oid,'EXECUTE')
  )
  select string_agg(e.signature,E'\n' order by e.signature)
    into v_missing
  from s2_expected_authenticated_definers e
  left join actual a using(signature)
  where a.signature is null;

  if v_actual<>157 or v_expected<>157 or v_unexpected is not null or v_missing is not null then
    raise exception E'S2 SECURITY DEFINER allowlist mismatch. actual=% expected=%\nunexpected:\n%\nmissing:\n%',
      v_actual,v_expected,coalesce(v_unexpected,'(none)'),coalesce(v_missing,'(none)');
  end if;
end
$allowlist$;

do $revoked_surface$
begin
  if has_function_privilege('authenticated','public.app_can_write_operational_context(text,uuid)','EXECUTE')
     or has_function_privilege('authenticated','public.cancel_ministry_event(uuid,text)','EXECUTE')
     or has_function_privilege('authenticated','public.link_work_items(uuid,uuid,text)','EXECUTE')
     or has_function_privilege('authenticated','public.guard_last_authority()','EXECUTE')
     or has_function_privilege('authenticated','public.share_performance_review(uuid)','EXECUTE') then
    raise exception 'S2 gate failure: an internal/dead RPC remains directly executable by authenticated.';
  end if;

  if not has_function_privilege('service_role','public.app_can_write_operational_context(text,uuid)','EXECUTE')
     or not has_function_privilege('service_role','public.cancel_ministry_event(uuid,text)','EXECUTE')
     or not has_function_privilege('service_role','public.link_work_items(uuid,uuid,text)','EXECUTE')
     or not has_function_privilege('service_role','public.guard_last_authority()','EXECUTE') then
    raise exception 'S2 gate failure: controlled service execution was removed from a retained compatibility function.';
  end if;
end
$revoked_surface$;


-- A reviewed private implementation reader supports the invoker publication
-- view. It is additional trusted code, never part of the public REST inventory.
do $private_published_reader$
begin
 if not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='private' and p.proname='stage2_self_published_human_ratings'
     and p.pronargs=0 and p.prosecdef and p.provolatile='s'
     and p.proconfig @> array['search_path=""'])
   or has_function_privilege('anon','private.stage2_self_published_human_ratings()','EXECUTE')
   or not has_function_privilege('authenticated','private.stage2_self_published_human_ratings()','EXECUTE') then
  raise exception 'Unreviewed private published-rating reader boundary';
 end if;
end
$private_published_reader$;

-- Explicitly review the two NEW invoker APIs and private trusted writer;
-- the older public SECURITY DEFINER allowlist is not a claim of no new API.
do $routine_options_surface$
begin
 if exists(select 1 from pg_proc where oid in('public.routine_schedule_preview(uuid[],date,date)'::regprocedure,
   'public.change_routine_schedule_options(uuid,date,jsonb)'::regprocedure) and prosecdef)
  or has_function_privilege('anon','public.routine_schedule_preview(uuid[],date,date)','EXECUTE')
  or has_function_privilege('anon','public.change_routine_schedule_options(uuid,date,jsonb)','EXECUTE')
  or has_function_privilege('anon','private.change_routine_schedule_options(uuid,date,jsonb)','EXECUTE')
  or not exists(select 1 from pg_proc where oid='private.change_routine_schedule_options(uuid,date,jsonb)'::regprocedure
   and prosecdef and pronargs=3 and proconfig @> array['search_path=""'])
  then raise exception 'Unreviewed routine options API boundary'; end if;
end;
$routine_options_surface$;

-- Canonical schedule evaluation remains invoker/RLS, not a bypass. The NEW
-- private delivery worker is executable only by its owner via controlled heartbeat.
do $routine_reminder_surface$
begin
 if exists(select 1 from pg_proc where oid='private.routine_schedule_dates(uuid[],date,date,uuid)'::regprocedure and prosecdef)
  or has_function_privilege('anon','private.routine_schedule_dates(uuid[],date,date,uuid)','EXECUTE')
  or has_function_privilege('authenticated','private.deliver_routine_reminders()','EXECUTE')
  or has_function_privilege('anon','private.deliver_routine_reminders()','EXECUTE')
  or has_function_privilege('service_role','private.deliver_routine_reminders()','EXECUTE')
  or not exists(select 1 from pg_proc where oid='private.deliver_routine_reminders()'::regprocedure
    and prosecdef and proconfig @> array['search_path=""'])
  or has_table_privilege('authenticated','public.routine_reminder_deliveries','INSERT')
  or has_table_privilege('authenticated','public.routine_reminder_deliveries','UPDATE')
  or has_table_privilege('authenticated','public.routine_reminder_deliveries','DELETE')
 then raise exception 'Unreviewed routine reminder boundary'; end if;
end;
$routine_reminder_surface$;

-- Ordinary Staff must not turn an arbitrary target identifier into a protected
-- read/write or capability escalation.
set local role authenticated;
select set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000001',true);

do $staff_negative$
begin
  begin
    perform public.admin_employment_detail('31000000-0000-4000-8000-000000000003');
    raise exception 'S2 gate failure: Staff swapped a profile id into Administration employment detail.';
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.grant_capability(
      '31000000-0000-4000-8000-000000000001',
      'people.manage',
      null,
      'S2 self-escalation probe'
    );
    raise exception 'S2 gate failure: Staff self-granted a privileged capability.';
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.payroll_list_runs();
    raise exception 'S2 gate failure: Staff called protected Payroll.';
  exception when insufficient_privilege then null;
  end;
end
$staff_negative$;

reset role;
rollback;

select 'CEAC OS S2 SECURITY DEFINER surface gate passed' as result;
