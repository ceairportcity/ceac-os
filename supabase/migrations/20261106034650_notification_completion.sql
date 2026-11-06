CREATE OR REPLACE FUNCTION private.ceac_responsible_reviewer_id(item_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
declare
  w public.work_items;
  v_reviewer uuid;
begin


  select * into w
  from public.work_items
  where id=item_id
    and kind in ('task','deliverable','meeting_outcome')
    and visibility<>'private';

  if w.id is null or w.assignee_id is null then
    return null;
  end if;

  -- Managers, including the OFTGP Secretariat manager, submit organisational
  -- work to the Executive, unless it was explicitly assigned by Administration.
  -- Private work is intentionally excluded by the visibility check above.
  if exists (
    select 1 from public.unit_memberships manager_membership
    where manager_membership.profile_id=w.assignee_id
      and manager_membership.org_id=w.org_id
      and manager_membership.role='manager'
  ) then
    -- An actual Admin-to-manager assignment returns to that assigning Admin.
    -- Self-created items (assigned_by=assignee) are not Admin assignments.
    if w.assigned_by is distinct from w.assignee_id
       and exists (
         select 1 from public.profiles assigning_admin
         where assigning_admin.id=w.assigned_by
           and assigning_admin.org_id=w.org_id
           and assigning_admin.active
           and assigning_admin.is_admin
       ) then
      return w.assigned_by;
    end if;

    -- Use a verified active Executive from the same organisation.
    -- Do not fall back to HR or a peer manager if no Executive exists.
    select executive.id into v_reviewer
    from public.profiles executive
    where executive.org_id=w.org_id
      and executive.active and executive.is_exec
      and executive.id is distinct from w.assignee_id
    order by executive.created_at,executive.id
    limit 1;
    return v_reviewer;
  end if;

  -- A valid recorded assigning authority owns the ordinary review route.
  if w.assigned_by is not null
     and w.assigned_by is distinct from w.assignee_id
     and exists (
       select 1
       from public.profiles p
       where p.id=w.assigned_by
         and p.org_id=w.org_id
         and p.active
         and (
           p.is_admin
           or (w.origin='assigned_by_exec' and p.is_exec)
           or (not w.confidential and exists (
             select 1 from public.unit_memberships m
             where m.profile_id=p.id
               and m.org_id=w.org_id
               and m.unit_id=w.unit_id
               and m.role='manager'
           ))
           or (
             not w.confidential
             and
             w.sub_team_id is not null
             and exists (
               select 1 from public.sub_teams s
               where s.id=w.sub_team_id
                 and s.org_id=w.org_id
                 and s.unit_id=w.unit_id
                 and s.lead_id=p.id
                 and s.active
             )
           )
         )
     ) then
    return w.assigned_by;
  end if;

  -- Existing review authority reserves confidential work for Administration,
  -- except for a valid explicit Executive-origin route handled above.
  if w.confidential then
    return null;
  end if;

  -- Agreed/self-created work first follows the closest recorded work-lane lead.
  if w.sub_team_id is not null then
    select s.lead_id into v_reviewer
    from public.sub_teams s
    join public.profiles p on p.id=s.lead_id
    where s.id=w.sub_team_id
      and s.org_id=w.org_id
      and s.unit_id=w.unit_id
      and s.active
      and p.active
      and p.org_id=w.org_id
      and s.lead_id is distinct from w.assignee_id
    limit 1;

    if v_reviewer is not null then
      return v_reviewer;
    end if;
  end if;

  select m.profile_id into v_reviewer
  from public.unit_memberships m
  join public.profiles p on p.id=m.profile_id
  where m.unit_id=w.unit_id
    and m.org_id=w.org_id
    and m.role='manager'
    and p.active
    and p.org_id=w.org_id
    and m.profile_id is distinct from w.assignee_id
  order by m.profile_id
  limit 1;

  return v_reviewer;
end;
$function$;


revoke all on function private.ceac_responsible_reviewer_id(uuid) from public,anon,authenticated;
-- Explicit privacy, device preferences and current-state delivery guards.
-- Existing participant-only memos remain confidential until their sender explicitly changes this.
alter table public.memos add column confidential boolean not null default true;
alter table public.ceac_push_subscriptions
 add column app_origin text check(app_origin is null or app_origin ~ '^https://[a-z0-9.-]+$'),
 add column reminder_minutes smallint not null default 30 check(reminder_minutes in (5,15,30,60)),
 add column categories jsonb not null default '{"messages":true,"work":true,"calendar":true}',
 add column quiet_start smallint check(quiet_start between 0 and 23),
 add column quiet_end smallint check(quiet_end between 0 and 23),
 add column timezone text not null default 'Africa/Accra',
 add constraint ceac_push_quiet_pair check((quiet_start is null)=(quiet_end is null) and (quiet_start is null or quiet_start<>quiet_end));
alter table public.ceac_push_jobs drop constraint ceac_push_jobs_source_kind_check;
alter table public.ceac_push_jobs add constraint ceac_push_jobs_source_kind_check
 check(source_kind in ('notice','work_due','work_overdue','meeting_reminder','personal_reminder','routine_reminder','calendar_reminder','test'));

create function public.ceac_push_routine_current(p_reminder uuid,p_profile uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.routine_reminder_deliveries r
 join public.work_items w on w.id=r.work_item_id and w.org_id=r.org_id
 join public.profiles p on p.id=p_profile and p.org_id=r.org_id and p.active
 cross join lateral private.routine_schedule_dates(array[w.id],r.scheduled_on,r.scheduled_on,r.org_id) d
 where r.id=p_reminder and r.for_profile_id=p_profile
 and private.routine_date_assignee(r.operation_id,r.scheduled_on)=p_profile
 and w.status not in ('completed','cancelled','self_certified','in_review')
 and d.state in ('scheduled','unrecorded_past') and d.due_at=r.due_at);
$$;
revoke all on function public.ceac_push_routine_current(uuid,uuid) from public,anon,authenticated;
grant execute on function public.ceac_push_routine_current(uuid,uuid) to service_role;

create function public.ceac_push_work_recipient(p_work uuid,p_profile uuid,p_event text)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.work_items w join public.profiles p on p.id=p_profile and p.org_id=w.org_id and p.active
 where w.id=p_work and w.visibility<>'private' and case when p_event='work_submitted'
 then w.status='in_review' and private.ceac_responsible_reviewer_id(w.id)=p_profile
 else w.assignee_id=p_profile end);
$$;
revoke all on function public.ceac_push_work_recipient(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.ceac_push_work_recipient(uuid,uuid,text) to service_role;

-- A device test is throttled and uses the same queue and real transport.
create function public.ceac_push_test(p_device uuid,p_profile uuid)
returns void language plpgsql security definer set search_path='' as $$
declare d public.ceac_push_subscriptions;
begin
 select * into strict d from public.ceac_push_subscriptions where id=p_device and profile_id=p_profile and revoked_at is null for update;
 if exists(select 1 from public.ceac_push_jobs where subscription_id=p_device and source_kind='test' and created_at>now()-interval '1 minute') then
 raise exception 'Please wait before another test.';end if;
 insert into public.ceac_push_jobs(org_id,profile_id,subscription_id,source_kind,source_id,source_key,expires_at)
 values(d.org_id,d.profile_id,d.id,'test',d.id,'test:'||gen_random_uuid(),now()+interval '10 minutes');
end $$;
revoke all on function public.ceac_push_test(uuid,uuid) from public,anon,authenticated;
grant execute on function public.ceac_push_test(uuid,uuid) to service_role;

-- Durable work decision notices share the existing feed and trigger push once.
alter table public.ceac_notification_events drop constraint ceac_notification_events_event_kind_check;
alter table public.ceac_notification_events add constraint ceac_notification_events_event_kind_check check(event_kind in
 ('case_opened','case_response','case_referred','case_resolved','memo_sent','memo_response','work_assigned',
 'policy_published','evidence_submitted','evidence_reviewed','exception_requested','exception_decided','support_request_opened',
 'work_submitted','work_returned','work_approved'));
create function private.ceac_work_status_notice() returns trigger language plpgsql security definer set search_path='' as $$
declare recipient uuid; kind text; source uuid;
begin
 if old.status is not distinct from new.status or new.visibility='private' then return new;end if;
 if new.status='in_review' then recipient:=private.ceac_responsible_reviewer_id(new.id);kind:='work_submitted';
 elsif new.status='returned' then recipient:=new.assignee_id;kind:='work_returned';
 elsif new.status='completed' then recipient:=new.assignee_id;kind:='work_approved';
 else return new;end if;
 -- One unique event per status transition, including subsequent resubmissions.
 source:=gen_random_uuid();
 perform private.ceac_emit_notification(new.org_id,recipient,'work_item',new.id,kind,source);
 return new;
end $$;
revoke all on function private.ceac_work_status_notice() from public,anon,authenticated;
create trigger ceac_work_status_notice after update of status on public.work_items for each row execute function private.ceac_work_status_notice();

-- Background delivery checks explicit profile authority without forging a user JWT.
create function private.ceac_profile_units(p_profile uuid,p_managed boolean default false)
returns setof uuid language sql stable security definer set search_path='' as $$
 select m.unit_id from public.unit_memberships m join public.profiles p on p.id=m.profile_id and p.org_id=m.org_id
 where p.id=p_profile and p.active and (not p_managed or m.role='manager');
$$;
create function private.ceac_profile_capability(p_profile uuid,p_capability text,p_unit uuid default null)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles p join public.capability_grants g on g.profile_id=p.id and g.org_id=p.org_id
 where p.id=p_profile and p.active and g.revoked_at is null and (g.expires_at is null or g.expires_at>now())
 and g.capability=p_capability and (g.scope_unit_id is null or g.scope_unit_id=p_unit));
$$;
create or replace function private.ceac_profile_room(p_room_id uuid,p_profile uuid)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select p_profile is not null and exists (
    select 1
    from public.rooms r
    where r.id=p_room_id
      and r.org_id=(select org_id from public.profiles where id=p_profile and active)
      and (
        (
          r.kind='unit'
          and exists(
            select 1
            from public.units u
            where u.id=r.unit_id
              and u.org_id=r.org_id
              and u.active
          )
          and (
            (select is_admin from public.profiles where id=p_profile and active)
            or (select is_exec from public.profiles where id=p_profile and active)
            or exists (
              select 1
              from public.unit_memberships um
              where um.profile_id=p_profile
                and um.unit_id=r.unit_id
                and um.org_id=r.org_id
            )
          )
        )
        or
        (
          r.kind='sub_team'
          and exists (
            select 1
            from public.sub_teams st
            where st.id=r.sub_team_id
              and st.unit_id=r.unit_id
              and st.org_id=r.org_id
              and st.active
              and (
                (select is_admin from public.profiles where id=p_profile and active)
                or (select is_exec from public.profiles where id=p_profile and active)
                or st.lead_id=p_profile
                or exists (
                  select 1
                  from public.sub_team_members stm
                  where stm.sub_team_id=st.id
                    and stm.profile_id=p_profile
                )
                or exists (
                  select 1
                  from public.unit_memberships um
                  where um.unit_id=st.unit_id
                    and um.profile_id=p_profile
                    and um.role='manager'
                )
              )
          )
        )
        or
        (
          r.kind='project'
          and exists (
            select 1
            from public.projects p
            where p.id=r.project_id
              and p.org_id=r.org_id
              and not public.operational_record_is_archived('projects',p.id,p.org_id)
              and (
                (select is_admin from public.profiles where id=p_profile and active)
                or
                (
                  not (select is_exec from public.profiles where id=p_profile and active)
                  and exists (
                    select 1
                    from public.unit_memberships um
                    where um.profile_id=p_profile
                      and um.org_id=r.org_id
                      and (
                        um.unit_id=p.lead_unit_id
                        or exists (
                          select 1
                          from public.project_units pu
                          where pu.project_id=p.id
                            and pu.unit_id=um.unit_id
                        )
                      )
                  )
                )
                or
                (
                  (select is_exec from public.profiles where id=p_profile and active)
                  and (
                    p.created_by=p_profile
                    or p.sponsor_profile_id=p_profile
                    or p.delivery_owner_id=p_profile
                    or exists (
                      select 1
                      from public.work_items w
                      where w.project_id=p.id
                        and w.org_id=p.org_id
                        and (
                          w.assignee_id=p_profile
                          or w.assigned_by=p_profile
                        )
                    )
                    or exists (
                      select 1
                      from public.unit_memberships um
                      where um.profile_id=p_profile
                        and um.org_id=r.org_id
                        and um.role='manager'
                        and (
                          um.unit_id=p.lead_unit_id
                          or exists (
                            select 1
                            from public.project_units pu
                            where pu.project_id=p.id
                              and pu.unit_id=um.unit_id
                          )
                        )
                    )
                  )
                )
              )
          )
        )
      )
  );
$$;

create function private.ceac_profile_case(p_employee uuid,p_profile uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.employee_roster er join public.profiles p on p.org_id=er.org_id and p.id=p_profile and p.active
 where er.id=p_employee and (er.profile_id=p_profile or p.is_admin or private.ceac_profile_capability(p_profile,'workforce.manage',null)
 or exists(select 1 from public.employee_unit_memberships em where em.employee_id=er.id and em.org_id=er.org_id and em.unit_id in(select private.ceac_profile_units(p_profile,true)))
 or(private.ceac_profile_capability(p_profile,'compliance.manage',null) and not(
 coalesce((select e.employment_type from public.employment_records e where e.profile_id=er.profile_id and e.org_id=er.org_id),er.employment_type)='volunteer'
 and coalesce((select e.working_pattern->>'kind' from public.employment_records e where e.profile_id=er.profile_id and e.org_id=er.org_id),'not_recorded') in('no_attendance','not_recorded')))));
$$;
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
 WHEN p_kind='work_item' THEN EXISTS (
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

revoke all on function private.ceac_profile_units(uuid,boolean),private.ceac_profile_capability(uuid,text,uuid),private.ceac_profile_room(uuid,uuid),private.ceac_profile_case(uuid,uuid) from public,anon,authenticated;
revoke all on function public.ceac_push_context_visible(text,uuid,uuid) from public,anon,authenticated;
grant execute on function public.ceac_push_context_visible(text,uuid,uuid) to service_role;

-- Preserve all existing context checks and extend work visibility to its actual reviewer.
alter function private.ceac_notification_context_visible(text,uuid) rename to ceac_notification_context_visible_before_completion;
create function private.ceac_notification_context_visible(p_kind text,p_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select case when p_kind='room' then public.app_can_access_room(p_id)
 when p_kind in ('meeting','leave','routine_occurrence') then public.ceac_push_context_visible(p_kind,p_id,auth.uid())
 when p_kind='work_item' then exists(select 1 from public.work_items w where w.id=p_id
 and w.org_id=public.app_org_id() and w.visibility<>'private'
 and (w.assignee_id=auth.uid() or public.app_responsible_reviewer_id(w.id)=auth.uid()))
 else private.ceac_notification_context_visible_before_completion(p_kind,p_id) end;
$$;
revoke all on function private.ceac_notification_context_visible(text,uuid) from public,anon,authenticated;

-- Unread retrieval no longer loses older notices behind the newest read records.
create or replace function public.my_ceac_notifications()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or public.app_org_id() is null or not public.app_stage2_universal_aal_allowed()
 or not exists(select 1 from public.profiles where id=auth.uid() and org_id=public.app_org_id() and active) then
 raise exception 'Account verification required.' using errcode='42501';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',n.id,'kind',n.event_kind,'context_kind',n.context_kind,
 'context_id',n.context_id,'target_work_id',(select r.work_item_id from public.operation_occurrences o join public.recurring_operations r on r.id=o.operation_id and r.org_id=o.org_id where n.context_kind='routine_occurrence' and o.id=n.context_id),'scheduled_on',(select o.occurred_on from public.operation_occurrences o where n.context_kind='routine_occurrence' and o.id=n.context_id),'created_at',n.created_at,'read_at',n.read_at) order by n.created_at desc,n.id desc),'[]'::jsonb)
 into result from (select * from public.ceac_notification_events n where n.org_id=public.app_org_id() and n.recipient_id=auth.uid()
 and n.read_at is null and private.ceac_notification_context_visible(n.context_kind,n.context_id) order by n.created_at desc limit 200) n;
 return result;
end $$;
create function public.my_ceac_notification_history(p_before timestamptz default null,p_before_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or public.app_org_id() is null or not public.app_stage2_universal_aal_allowed()
 or not exists(select 1 from public.profiles where id=auth.uid() and org_id=public.app_org_id() and active) then raise exception 'Account verification required.';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',n.id,'kind',n.event_kind,'context_kind',n.context_kind,'context_id',n.context_id,'target_work_id',(select r.work_item_id from public.operation_occurrences o join public.recurring_operations r on r.id=o.operation_id and r.org_id=o.org_id where n.context_kind='routine_occurrence' and o.id=n.context_id),'scheduled_on',(select o.occurred_on from public.operation_occurrences o where n.context_kind='routine_occurrence' and o.id=n.context_id),
 'created_at',n.created_at,'read_at',n.read_at) order by n.created_at desc,n.id desc),'[]'::jsonb) into result
 from(select * from public.ceac_notification_events n where n.org_id=public.app_org_id() and n.recipient_id=auth.uid()
 and (p_before is null or (n.created_at,n.id)<(p_before,coalesce(p_before_id,'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid))) and private.ceac_notification_context_visible(n.context_kind,n.context_id)
 order by n.created_at desc,n.id desc limit 40)n;return result;
end $$;
revoke all on function public.my_ceac_notification_history(timestamptz,uuid) from public,anon;
grant execute on function public.my_ceac_notification_history(timestamptz,uuid) to authenticated;

-- Faster, bounded dispatch; retain Vault-backed URL/token and inactive-device guard.
do $$ declare j record;begin
 for j in select jobid from cron.job where jobname like 'ceac-web-push-%' and jobname not like '%retention%' loop
 perform cron.alter_job(j.jobid,schedule:='* * * * *');end loop;
end $$;

create function public.set_memo_preview_privacy(p_id uuid,p_confidential boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.app_stage2_universal_aal_allowed() then raise exception 'Sign in first.';end if;
 update public.memos set confidential=p_confidential where id=p_id and org_id=public.app_org_id()
 and sender_id=auth.uid() and status in ('draft','changes_requested');
 if not found then raise exception 'Only your editable memo can be changed.';end if;
end $$;
revoke all on function public.set_memo_preview_privacy(uuid,boolean) from public,anon;
grant execute on function public.set_memo_preview_privacy(uuid,boolean) to authenticated;

alter table public.ceac_notification_events add column actor_id uuid references public.profiles(id) default auth.uid();
create index ceac_notification_unread on public.ceac_notification_events(org_id,recipient_id,created_at desc) where read_at is null;

-- Service role can obtain only a count for an active account, never its messages.
create function public.ceac_push_unread_count(p_profile uuid)
returns integer language sql stable security definer set search_path='' as $$
 select count(distinct (n.context_kind,n.context_id))::integer
 from public.ceac_notification_events n join public.profiles p on p.id=n.recipient_id and p.org_id=n.org_id and p.active
 where n.recipient_id=p_profile and n.read_at is null and public.ceac_push_context_visible(n.context_kind,n.context_id,p_profile) and (n.context_kind<>'room' or coalesce((select notification_level from public.room_notification_preferences pref where pref.room_id=n.context_id and pref.profile_id=p_profile),'mentions')<>'mute');
$$;
revoke all on function public.ceac_push_unread_count(uuid) from public,anon,authenticated;
grant execute on function public.ceac_push_unread_count(uuid) to service_role;

create function public.my_ceac_notification_snapshot()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare rows jsonb; total integer;
begin
 -- The original RPC performs active account, AAL and organisation checks.
 rows:=public.my_ceac_notifications();
 select count(distinct (n.context_kind,n.context_id)) into total from public.ceac_notification_events n
 where n.org_id=public.app_org_id() and n.recipient_id=auth.uid() and n.read_at is null
 and private.ceac_notification_context_visible(n.context_kind,n.context_id) and (n.context_kind<>'room' or coalesce((select notification_level from public.room_notification_preferences pref where pref.room_id=n.context_id and pref.profile_id=auth.uid()),'mentions')<>'mute');
 return jsonb_build_object('events',rows,'unreadCount',total);
end $$;
revoke all on function public.my_ceac_notification_snapshot() from public,anon;
grant execute on function public.my_ceac_notification_snapshot() to authenticated;

-- Coalesce queued Memo replies per device/thread before claiming deliveries.
create function private.ceac_coalesce_push_notices() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.source_kind='notice' then
  update public.ceac_push_jobs j set status='cancelled',failure_code='newer_thread_update'
  from public.ceac_notification_events old_notice,public.ceac_notification_events latest
  where latest.id=new.source_id and old_notice.id=j.source_id
  and old_notice.context_kind=latest.context_kind and latest.context_kind in ('memo','meeting','work_item','leave','room')
  and old_notice.context_id=latest.context_id and old_notice.recipient_id=latest.recipient_id
  and j.subscription_id=new.subscription_id and j.id<>new.id and j.status in ('pending','retry');
 end if;return new;
end $$;
revoke all on function private.ceac_coalesce_push_notices() from public,anon,authenticated;
create trigger ceac_coalesce_push_notices after insert on public.ceac_push_jobs
for each row execute function private.ceac_coalesce_push_notices();



alter table public.ceac_notification_events drop constraint ceac_notification_events_context_kind_check;
alter table public.ceac_notification_events add constraint ceac_notification_events_context_kind_check
 check(context_kind in ('compliance_case','memo','work_item','compliance_policy','compliance_evidence','compliance_exception','support_case','room','meeting','leave','routine_occurrence'));
alter table public.ceac_notification_events drop constraint ceac_notification_events_event_kind_check;
alter table public.ceac_notification_events add constraint ceac_notification_events_event_kind_check check(event_kind in
 ('case_opened','case_response','case_referred','case_resolved','memo_sent','memo_response','work_assigned',
 'policy_published','evidence_submitted','evidence_reviewed','exception_requested','exception_decided','support_request_opened',
 'work_submitted','work_returned','work_approved','routine_reviewed','room_mention','meeting_invited','meeting_changed','meeting_cancelled','leave_requested','leave_decided'));

create function private.ceac_leave_notice() returns trigger language plpgsql security definer set search_path='' as $$
declare recipient uuid;
begin
 if tg_op='INSERT' then
  for recipient in select id from public.profiles p where p.org_id=new.org_id and p.active and p.is_admin
   and private.ceac_profile_capability(p.id,'workforce.manage',null) loop
   perform private.ceac_emit_notification(new.org_id,recipient,'leave',new.id,'leave_requested',new.id);
  end loop;
 elsif old.status is distinct from new.status and new.status in ('approved','rejected','declined','cancelled') then
  perform private.ceac_emit_notification(new.org_id,new.profile_id,'leave',new.id,'leave_decided',gen_random_uuid());
 end if;return new;
end $$;
revoke all on function private.ceac_leave_notice() from public,anon,authenticated;
create trigger ceac_leave_notice after insert or update of status on public.leave_requests for each row execute function private.ceac_leave_notice();

create function private.ceac_meeting_notice() returns trigger language plpgsql security definer set search_path='' as $$
declare m public.meeting_sessions; recipient uuid; kind text;
begin
 if tg_table_name='meeting_participants' then
  select * into m from public.meeting_sessions where id=new.meeting_id;
  if found and m.created_by is distinct from new.profile_id then
   perform private.ceac_emit_notification(m.org_id,new.profile_id,'meeting',m.id,'meeting_invited',gen_random_uuid());end if;
 else
  if old.starts_at is not distinct from new.starts_at and old.status is not distinct from new.status and old.title is not distinct from new.title then return new;end if;
  kind:=case when new.status ilike '%cancel%' then 'meeting_cancelled' else 'meeting_changed' end;
  for recipient in select profile_id from public.meeting_participants where meeting_id=new.id loop
   perform private.ceac_emit_notification(new.org_id,recipient,'meeting',new.id,kind,gen_random_uuid());end loop;
 end if;return new;
end $$;
revoke all on function private.ceac_meeting_notice() from public,anon,authenticated;
create trigger ceac_meeting_invitation after insert on public.meeting_participants for each row execute function private.ceac_meeting_notice();
create trigger ceac_meeting_update after update of starts_at,status,title on public.meeting_sessions for each row execute function private.ceac_meeting_notice();

create function private.ceac_room_mention_notice() returns trigger language plpgsql security definer set search_path='' as $$
declare m public.room_messages;
begin
 select * into m from public.room_messages where id=new.message_id;
 if found and m.author_id is distinct from new.profile_id and private.ceac_profile_room(m.room_id,new.profile_id)
 and coalesce((select notification_level from public.room_notification_preferences where room_id=m.room_id and profile_id=new.profile_id),'mentions')<>'mute' then
 perform private.ceac_emit_notification(m.org_id,new.profile_id,'room',m.room_id,'room_mention',m.id);end if;
 return new;
end $$;
revoke all on function private.ceac_room_mention_notice() from public,anon,authenticated;
create trigger ceac_room_mention_notice after insert on public.room_mentions for each row execute function private.ceac_room_mention_notice();
create function private.ceac_room_notice_read() returns trigger language plpgsql security definer set search_path='' as $$
begin
 update public.ceac_notification_events set read_at=new.last_read_at where recipient_id=new.profile_id and context_kind='room'
 and context_id=new.room_id and created_at<=new.last_read_at and read_at is null;return new;
end $$;
revoke all on function private.ceac_room_notice_read() from public,anon,authenticated;
create trigger ceac_room_notice_read after insert or update of last_read_at on public.room_reads for each row execute function private.ceac_room_notice_read();

create or replace function public.ceac_enqueue_push_reminders()
 returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare n integer:=0; added integer;
begin
 insert into public.ceac_push_jobs(org_id,profile_id,subscription_id,source_kind,source_id,source_key,source_due_at,expires_at)
 select w.org_id,w.assignee_id,s.id,'work_due',w.id,
   'work:'||w.id::text||':due:'||to_char(w.due_at at time zone 'UTC','YYYYMMDDHH24MISS'),
   w.due_at,now()+interval '2 hours'
 from public.work_items w join public.ceac_push_subscriptions s
 on s.org_id=w.org_id and s.profile_id=w.assignee_id and s.revoked_at is null
 join public.profiles p on p.id=s.profile_id and p.active
 where w.kind <> 'routine' and w.status in ('not_started','in_progress','assigned')
   and (case when (w.due_at at time zone 'Africa/Accra')::time=time '00:00:00' then public.ceac_push_work_alert_at(w.due_at,'due') else w.due_at-make_interval(mins=>s.reminder_minutes) end) > now()-interval '1 hour' and (case when (w.due_at at time zone 'Africa/Accra')::time=time '00:00:00' then public.ceac_push_work_alert_at(w.due_at,'due') else w.due_at-make_interval(mins=>s.reminder_minutes) end) <= now()
 and not exists(select 1 from public.ceac_push_jobs existing where existing.subscription_id=s.id and existing.source_kind='work_due' and existing.source_id=w.id and existing.source_due_at is not distinct from w.due_at)
 limit 200
 on conflict(subscription_id,source_key) do nothing;
 get diagnostics added=row_count;n:=n+added;
 insert into public.ceac_push_jobs(org_id,profile_id,subscription_id,source_kind,source_id,source_key,source_due_at,expires_at)
 select w.org_id,w.assignee_id,s.id,'work_overdue',w.id,
   'work:'||w.id::text||':late:'||to_char(w.due_at at time zone 'UTC','YYYYMMDDHH24MISS'),
   w.due_at,now()+interval '2 hours'
 from public.work_items w join public.ceac_push_subscriptions s
 on s.org_id=w.org_id and s.profile_id=w.assignee_id and s.revoked_at is null
 join public.profiles p on p.id=s.profile_id and p.active
 where w.kind <> 'routine' and w.status in ('not_started','in_progress','assigned')
   and public.ceac_push_work_alert_at(w.due_at,'overdue') > now()-interval '1 hour' and public.ceac_push_work_alert_at(w.due_at,'overdue') <= now()
 and not exists(select 1 from public.ceac_push_jobs existing where existing.subscription_id=s.id and existing.source_kind='work_overdue' and existing.source_id=w.id and existing.source_due_at is not distinct from w.due_at)
 limit 200
 on conflict(subscription_id,source_key) do nothing;
 get diagnostics added=row_count;n:=n+added;
 insert into public.ceac_push_jobs(org_id,profile_id,subscription_id,source_kind,source_id,source_key,source_due_at,expires_at)
 select m.org_id,mp.profile_id,s.id,'meeting_reminder',m.id,
   'meeting:'||m.id::text||':'||s.reminder_minutes::text||':'||to_char(m.starts_at at time zone 'UTC','YYYYMMDDHH24MISS'),
   m.starts_at,m.starts_at+interval '1 hour'
 from public.meeting_sessions m join public.meeting_participants mp on mp.meeting_id=m.id
 join public.ceac_push_subscriptions s on s.org_id=m.org_id and s.profile_id=mp.profile_id and s.revoked_at is null
 join public.profiles p on p.id=s.profile_id and p.active
 where coalesce(m.status,'') not ilike '%cancel%' and m.starts_at-make_interval(mins=>s.reminder_minutes)>now()-interval '1 hour'
   and m.starts_at-make_interval(mins=>s.reminder_minutes)<=now() and m.starts_at>now()
 and not exists(select 1 from public.ceac_push_jobs existing where existing.subscription_id=s.id and existing.source_kind='meeting_reminder' and existing.source_id=m.id and existing.source_due_at is not distinct from m.starts_at)
 limit 200
 on conflict(subscription_id,source_key) do nothing;
 get diagnostics added=row_count;n:=n+added;
 insert into public.ceac_push_jobs(org_id,profile_id,subscription_id,source_kind,source_id,source_key,source_due_at,expires_at)
 select r.org_id,r.profile_id,s.id,'personal_reminder',r.id,
   'reminder:'||r.id::text||':'||to_char(r.remind_at at time zone 'UTC','YYYYMMDDHH24MISS'),r.remind_at,r.remind_at+interval '1 hour'
 from public.personal_reminders r join public.ceac_push_subscriptions s
 on s.org_id=r.org_id and s.profile_id=r.profile_id and s.revoked_at is null
 join public.profiles p on p.id=s.profile_id and p.active
 where r.seen_at is null and r.remind_at>now()-interval '1 hour' and r.remind_at<=now()
 and not exists(select 1 from public.ceac_push_jobs existing where existing.subscription_id=s.id and existing.source_kind='personal_reminder' and existing.source_id=r.id and existing.source_due_at is not distinct from r.remind_at)
 limit 200
 on conflict(subscription_id,source_key) do nothing;
 get diagnostics added=row_count;n:=n+added;
 insert into public.ceac_push_jobs(org_id,profile_id,subscription_id,source_kind,source_id,source_key,source_due_at,expires_at)
 select d.org_id,d.for_profile_id,s.id,'routine_reminder',d.id,'routine:'||d.id::text,
   d.due_at,now()+interval '2 hours'
 from public.routine_reminder_deliveries d join public.ceac_push_subscriptions s
 on s.org_id=d.org_id and s.profile_id=d.for_profile_id and s.revoked_at is null
 join public.profiles p on p.id=s.profile_id and p.active
 where d.delivered_at>=now()-interval '10 minutes' and d.delivered_at<=now()
 and not exists(select 1 from public.ceac_push_jobs existing where existing.subscription_id=s.id and existing.source_kind='routine_reminder' and existing.source_id=d.id and existing.source_due_at is not distinct from d.due_at)
 limit 200
 on conflict(subscription_id,source_key) do nothing;
 get diagnostics added=row_count;n:=n+added;
 insert into public.ceac_push_jobs(org_id,profile_id,subscription_id,source_kind,source_id,source_key,source_due_at,expires_at)
 select e.org_id,e.profile_id,s.id,'calendar_reminder',e.id,
   'calendar:'||e.id::text||':'||to_char(e.reminder_at at time zone 'UTC','YYYYMMDDHH24MISS'),
   e.reminder_at,now()+interval '1 hour'
 from public.personal_calendar_events e join public.ceac_push_subscriptions s
 on s.org_id=e.org_id and s.profile_id=e.profile_id and s.revoked_at is null
 join public.profiles p on p.id=s.profile_id and p.active
 where e.reminder_at is not null and e.reminder_at>now()-interval '1 hour'
 and e.reminder_at<=now()
 and not exists(select 1 from public.ceac_push_jobs existing where existing.subscription_id=s.id and existing.source_kind='calendar_reminder' and existing.source_id=e.id and existing.source_due_at is not distinct from e.reminder_at)
 limit 200
 on conflict(subscription_id,source_key) do nothing;
 get diagnostics added=row_count;n:=n+added;
 return n;
end $$;

-- Reading clears the selected conversation's notices through that update only.
-- Work status/approval records are never changed by a read receipt.
create or replace function public.mark_ceac_notification_read(p_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare n public.ceac_notification_events;
begin
 if auth.uid() is null or not public.app_stage2_universal_aal_allowed() or not exists(
 select 1 from public.profiles p where p.id=auth.uid() and p.org_id=public.app_org_id() and p.active) then raise exception 'Account verification required.';end if;
 select * into n from public.ceac_notification_events where id=p_id and org_id=public.app_org_id() and recipient_id=auth.uid();
 if not found or not private.ceac_notification_context_visible(n.context_kind,n.context_id) then raise exception 'This update is no longer available.';end if;
 update public.ceac_notification_events set read_at=coalesce(read_at,clock_timestamp())
 where org_id=n.org_id and recipient_id=auth.uid() and context_kind=n.context_kind and context_id=n.context_id and (created_at,id)<=(n.created_at,n.id);
end $$;

create function private.ceac_routine_review_notice() returns trigger language plpgsql security definer set search_path='' as $$
declare occurrence public.operation_occurrences; recipient uuid;
begin
 select * into occurrence from public.operation_occurrences where id=new.occurrence_id and org_id=new.org_id;
 if not found then return new;end if;
 recipient:=coalesce(private.routine_date_assignee(occurrence.operation_id,occurrence.occurred_on),occurrence.recorded_by);
 if recipient is distinct from new.reviewer_id then perform private.ceac_emit_notification(new.org_id,recipient,'routine_occurrence',occurrence.id,'routine_reviewed',new.id);end if;
 return new;
end $$;
revoke all on function private.ceac_routine_review_notice() from public,anon,authenticated;
create trigger ceac_routine_review_notice after insert on public.routine_occurrence_reviews for each row execute function private.ceac_routine_review_notice();

-- Wake the existing worker after a committed notice/test; cron remains recovery.
-- pg_net sends only after commit. A queue failure must never fail business work.
create function private.ceac_wake_push_worker() returns trigger
language plpgsql security definer set search_path='' as $$
declare url text; token text;
begin
 if current_setting('ceac.push_wake_queued',true)='yes' then return null;end if;
 if not exists(select 1 from public.ceac_push_jobs where status='pending' and source_kind in ('notice','test')) then return null;end if;
 select decrypted_secret into url from vault.decrypted_secrets where name='ceac_web_push_url';
 select decrypted_secret into token from vault.decrypted_secrets where name='ceac_web_push_worker_token';
 if url is null or token is null then return null;end if;
 perform set_config('ceac.push_wake_queued','yes',true);
 perform net.http_post(url:=url,headers:=jsonb_build_object('Content-Type','application/json','x-ceac-push-worker',token),body:='{}'::jsonb,timeout_milliseconds:=20000);
 return null;
exception when others then return null;
end $$;
revoke all on function private.ceac_wake_push_worker() from public,anon,authenticated;
create trigger ceac_wake_push_worker after insert on public.ceac_push_jobs for each statement execute function private.ceac_wake_push_worker();

-- A claim outlives the bounded Edge worker, preventing timeout overlap.
create or replace function public.ceac_claim_push_jobs(p_limit integer default 10)
returns setof public.ceac_push_jobs
language sql security definer set search_path=public,pg_temp as $$
 with claimed as (
   select id from public.ceac_push_jobs
   where next_attempt_at<=now() and expires_at>now() and attempts<8
    and (status in ('pending','retry') or (status='sending' and lease_until<now()))
   order by created_at,id for update skip locked
   limit least(greatest(p_limit,1),20)
 )
 update public.ceac_push_jobs j set status='sending',attempts=j.attempts+1,
   lease_token=gen_random_uuid(),lease_until=now()+interval '3 minutes'
 from claimed where j.id=claimed.id returning j.*
$$;
