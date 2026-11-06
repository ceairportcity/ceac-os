-- Shared operational oversight, separate from private diary and final completion.
-- One active migration owner: work-oversight-20261106. No historical backfill.
create table private.work_reporting_lines (
 id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organisations(id),
 profile_id uuid not null references public.profiles(id), supervisor_id uuid not null references public.profiles(id),
 recorded_by uuid not null references public.profiles(id), recorded_at timestamptz not null default clock_timestamp(),
 check(profile_id<>supervisor_id)
);
create index work_reporting_person on private.work_reporting_lines(org_id,profile_id,recorded_at desc,id desc);
create table private.work_oversight_entries (
 id uuid primary key, org_id uuid not null references public.organisations(id),
 work_item_id uuid not null references public.work_items(id), actor_id uuid not null references public.profiles(id),
 kind text not null check(kind in ('update','milestone','decision','attention','follow_up','feedback','accepted','changes_requested','answered')),
 note text not null check(length(btrim(note)) between 1 and 4000),
 recipient_id uuid references public.profiles(id), reply_to uuid references private.work_oversight_entries(id),
 recorded_at timestamptz not null default clock_timestamp()
);
create index work_oversight_history on private.work_oversight_entries(org_id,work_item_id,recorded_at desc,id desc);
create unique index work_oversight_one_resolution on private.work_oversight_entries(reply_to) where kind in ('accepted','changes_requested','answered');
alter table private.work_reporting_lines enable row level security;
alter table private.work_oversight_entries enable row level security;
revoke all on private.work_reporting_lines,private.work_oversight_entries from public,anon,authenticated;

create function private.work_named_supervisor(p_org uuid,p_person uuid) returns uuid
language sql stable security definer set search_path='' as $$
 select case when exists(select 1 from public.unit_memberships m where m.org_id=p_org and m.profile_id=p_person and m.role='manager')
 then (select l.supervisor_id from (select * from private.work_reporting_lines where org_id=p_org and profile_id=p_person order by recorded_at desc,id desc limit 1) l
 join public.profiles supervisor on supervisor.id=l.supervisor_id and supervisor.org_id=l.org_id and supervisor.active and supervisor.is_exec)
 else (select r.manager_profile_id from public.employee_roster r join public.profiles supervisor on supervisor.id=r.manager_profile_id and supervisor.org_id=r.org_id and supervisor.active
 where r.org_id=p_org and r.profile_id=p_person and r.manager_profile_id<>p_person order by r.id limit 1) end;
$$;
revoke all on function private.work_named_supervisor(uuid,uuid) from public,anon,authenticated;

create function private.work_oversight_visible(p_work uuid,p_person uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.operational_live_work_items w
 join public.profiles p on p.id=p_person and p.org_id=w.org_id and p.active
 where w.id=p_work and w.visibility<>'private' and not w.confidential
 and (w.assignee_id=p_person or p.is_admin
 or private.work_named_supervisor(w.org_id,w.assignee_id)=p_person
 or private.ceac_responsible_reviewer_id(w.id)=p_person
 or exists(select 1 from public.unit_memberships m where m.org_id=w.org_id and m.unit_id=w.unit_id and m.profile_id=p_person and m.role='manager')));
$$;
revoke all on function private.work_oversight_visible(uuid,uuid) from public,anon,authenticated;

create function public.work_oversight_queue(p_offset integer default 0) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or public.app_org_id() is null or not public.app_stage2_universal_aal_allowed()
 or not exists(select 1 from public.profiles p where p.id=auth.uid() and p.org_id=public.app_org_id() and p.active)
 then raise exception 'Sign in with an active CEAC account.' using errcode='42501';end if;
 if p_offset is null or p_offset<0 or p_offset>100000 then raise exception 'Invalid page.' using errcode='22023';end if;
 with scoped as (
 select w.id,w.ref,w.title,w.kind,w.status,w.due_at,w.assignee_id,w.last_movement_at,p.full_name as assignee_name,u.name as unit_name,
 (select count(*) from private.work_oversight_entries e where e.work_item_id=w.id and e.org_id=w.org_id
 and e.kind in ('milestone','decision','attention') and not exists(select 1 from private.work_oversight_entries r where r.reply_to=e.id)) as pending_count,
 (select max(e.recorded_at) from private.work_oversight_entries e where e.work_item_id=w.id and e.org_id=w.org_id) as updated_at
 from private.operational_live_work_items w
 left join public.profiles p on p.id=w.assignee_id and p.org_id=w.org_id
 left join public.units u on u.id=w.unit_id and u.org_id=w.org_id
 where w.org_id=public.app_org_id() and w.status not in ('cancelled','completed','self_certified')
 and private.work_oversight_visible(w.id,auth.uid())
 ), page as (select * from scoped order by (pending_count>0) desc,coalesce(updated_at,last_movement_at) desc,id limit 50 offset p_offset)
 select jsonb_build_object('total',(select count(*) from scoped),'rows',coalesce((select jsonb_agg(to_jsonb(page) order by (pending_count>0) desc,coalesce(updated_at,last_movement_at) desc,id) from page),'[]'::jsonb)) into result;
 return result;
end $$;
revoke all on function public.work_oversight_queue(integer) from public,anon;
grant execute on function public.work_oversight_queue(integer) to authenticated;

create function public.work_oversight_context(p_work uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare w public.work_items; supervisor uuid; reviewer uuid; events jsonb; options jsonb; current_line uuid;
begin
 if auth.uid() is null or public.app_org_id() is null or not public.app_stage2_universal_aal_allowed()
 or not private.work_oversight_visible(p_work,auth.uid()) then raise exception 'This shared work is not available to your account.' using errcode='42501';end if;
 select * into strict w from public.work_items where id=p_work and org_id=public.app_org_id();
 current_line:=private.work_named_supervisor(w.org_id,w.assignee_id);
 reviewer:=private.ceac_responsible_reviewer_id(w.id);
 -- An unconfigured reporting line is never presented as a confirmed appointment.
 supervisor:=coalesce(current_line,reviewer,(select m.profile_id from public.unit_memberships m join public.profiles p on p.id=m.profile_id and p.org_id=m.org_id and p.active
 where m.org_id=w.org_id and m.unit_id=w.unit_id and m.role='manager' and m.profile_id<>w.assignee_id order by m.profile_id limit 1));
 select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'kind',e.kind,'note',e.note,'actor_id',e.actor_id,'actor_name',p.full_name,
 'recipient_id',e.recipient_id,'recipient_name',recipient.full_name,'reply_to',e.reply_to,'recorded_at',e.recorded_at,
 'resolved',exists(select 1 from private.work_oversight_entries r where r.reply_to=e.id)) order by e.recorded_at,e.id),'[]'::jsonb) into events
 from (select * from private.work_oversight_entries where work_item_id=w.id and org_id=w.org_id order by recorded_at desc,id desc limit 100) e
 left join public.profiles p on p.id=e.actor_id and p.org_id=e.org_id left join public.profiles recipient on recipient.id=e.recipient_id and recipient.org_id=e.org_id;
 if public.app_is_admin() and public.app_privileged_aal_allowed() then
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.full_name) order by p.full_name,p.id),'[]'::jsonb) into options
 from public.profiles p where p.org_id=w.org_id and p.active and p.id<>w.assignee_id
 and p.is_exec and exists(select 1 from public.unit_memberships m where m.org_id=w.org_id and m.profile_id=w.assignee_id and m.role='manager');
 end if;
 return jsonb_build_object('responsible_name',(select full_name from public.profiles where id=w.assignee_id and org_id=w.org_id),
 'supervisor_id',supervisor,'supervisor_name',(select full_name from public.profiles where id=supervisor and org_id=w.org_id),
 'named_supervisor_id',current_line,'reviewer_id',reviewer,'reviewer_name',(select full_name from public.profiles where id=reviewer and org_id=w.org_id),
 'coordinators',coalesce((select jsonb_agg(full_name order by full_name) from public.profiles where org_id=w.org_id and active and is_admin),'[]'::jsonb),
 'can_coordinate',public.app_is_admin() and public.app_privileged_aal_allowed(),
 'can_update',w.assignee_id=auth.uid(),'events',events,'supervisor_options',options,
 'open',w.status not in ('completed','self_certified','cancelled'));
end $$;
revoke all on function public.work_oversight_context(uuid) from public,anon;
grant execute on function public.work_oversight_context(uuid) to authenticated;

create function public.set_work_supervisor(p_work uuid,p_supervisor uuid,p_reason text) returns uuid
language plpgsql security definer set search_path='' as $$
declare w public.work_items; result uuid; candidates jsonb;
begin
 if auth.uid() is null or not public.app_is_admin() or not public.app_privileged_aal_allowed()
 or not public.app_stage2_universal_aal_allowed() or not private.work_oversight_visible(p_work,auth.uid())
 then raise exception 'Administration authority is required.' using errcode='42501';end if;
 if length(btrim(coalesce(p_reason,''))) not between 1 and 1000 then raise exception 'Explain this reporting change.' using errcode='22023';end if;
 -- Serialize reporting-line changes, preserve every earlier appointment.
 select * into strict w from public.work_items where id=p_work and org_id=public.app_org_id() for update;
 perform 1 from public.profiles where id=w.assignee_id and org_id=w.org_id for update;
 candidates:=public.work_oversight_context(w.id)->'supervisor_options';
 if not exists(select 1 from jsonb_array_elements(candidates) x where (x->>'id')::uuid=p_supervisor)
 then raise exception 'Choose an active authorised supervisor.' using errcode='42501';end if;
 if private.work_named_supervisor(w.org_id,w.assignee_id)=p_supervisor then return p_supervisor;end if;
 insert into private.work_reporting_lines(org_id,profile_id,supervisor_id,recorded_by) values(w.org_id,w.assignee_id,p_supervisor,auth.uid()) returning id into result;
 insert into public.activity_events(org_id,actor_id,verb,object_type,object_id,meta)
 values(w.org_id,auth.uid(),'work_supervisor_recorded','profile',w.assignee_id,jsonb_build_object('supervisor_id',p_supervisor,'reason',btrim(p_reason),'reporting_line_id',result));
 return p_supervisor;
end $$;
revoke all on function public.set_work_supervisor(uuid,uuid,text) from public,anon;
grant execute on function public.set_work_supervisor(uuid,uuid,text) to authenticated;

create function public.add_work_oversight_entry(p_work uuid,p_kind text,p_note text,p_request_id uuid,p_reply_to uuid default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare w public.work_items; recipient uuid; parent private.work_oversight_entries; prior private.work_oversight_entries; context jsonb; result uuid;
begin
 if auth.uid() is null or public.app_org_id() is null or not public.app_stage2_universal_aal_allowed()
 or not private.work_oversight_visible(p_work,auth.uid()) then raise exception 'This shared work is not available to your account.' using errcode='42501';end if;
 if p_request_id is null or p_kind is null or p_kind not in ('update','milestone','decision','attention','follow_up','feedback','accepted','changes_requested','answered')
 or length(btrim(coalesce(p_note,''))) not between 1 and 4000 then raise exception 'Add a short work message.' using errcode='22023';end if;
 select * into strict w from public.work_items where id=p_work and org_id=public.app_org_id() for update;
 -- An immutable client request ID makes a network retry safe, without accepting a changed request.
 select * into prior from private.work_oversight_entries where id=p_request_id;
 if found then
 if prior.actor_id=auth.uid() and prior.work_item_id=p_work and prior.kind=p_kind and prior.note=btrim(p_note) and prior.reply_to is not distinct from p_reply_to then return prior.id;end if;
 raise exception 'This request identifier has already been used.' using errcode='22023';end if;
 if w.status in ('completed','cancelled','self_certified') then raise exception 'This work is closed. Open its full record to review the outcome.' using errcode='22023';end if;
 context:=public.work_oversight_context(w.id);
 if p_kind in ('accepted','changes_requested','answered') then
 select * into parent from private.work_oversight_entries where id=p_reply_to and work_item_id=w.id and org_id=w.org_id;
 if parent.id is null or parent.kind not in ('milestone','decision','attention') or parent.actor_id=auth.uid() or parent.recipient_id is distinct from auth.uid()
 or not public.app_privileged_aal_allowed() then raise exception 'Only the named independent recipient can decide this request.' using errcode='42501';end if;
 if p_kind in ('accepted','changes_requested') and parent.kind<>'milestone' or p_kind='answered' and parent.kind='milestone'
 then raise exception 'Choose the correct response for this request.' using errcode='22023';end if;
 if exists(select 1 from private.work_oversight_entries where reply_to=parent.id) then raise exception 'This request already has a response. Refresh the work.' using errcode='22023';end if;
 recipient:=parent.actor_id;
 else
 if p_reply_to is not null then raise exception 'Unexpected reply reference.' using errcode='22023';end if;
 if p_kind in ('update','milestone','decision') and w.assignee_id is distinct from auth.uid() then raise exception 'Only the responsible person can publish progress or request a decision.' using errcode='42501';end if;
 if p_kind in ('attention','follow_up') and not ((context->>'can_coordinate')::boolean or auth.uid()=(context->>'supervisor_id')::uuid or auth.uid()=(context->>'reviewer_id')::uuid)
 then raise exception 'A supervisor or Administration must send this follow-up.' using errcode='42501';end if;
 if p_kind in ('attention','milestone','decision') then
 recipient:=case when p_kind='milestone' then coalesce((context->>'reviewer_id')::uuid,(context->>'supervisor_id')::uuid) else coalesce((context->>'supervisor_id')::uuid,(context->>'reviewer_id')::uuid) end;
 if recipient is null or recipient=auth.uid() then raise exception 'An independent supervisor must be recorded before this request can be sent.' using errcode='42501';end if;
 if exists(select 1 from private.work_oversight_entries e where e.work_item_id=w.id and e.kind=p_kind and e.recipient_id=recipient and not exists(select 1 from private.work_oversight_entries r where r.reply_to=e.id)) then raise exception 'An open request already exists. Follow the existing conversation.' using errcode='22023';end if;
 elsif p_kind='follow_up' then recipient:=w.assignee_id;
 elsif p_kind='feedback' then recipient:=case when w.assignee_id=auth.uid() then (context->>'supervisor_id')::uuid else w.assignee_id end;
 end if;
 if p_kind in ('follow_up','feedback') and exists(select 1 from private.work_oversight_entries e where e.work_item_id=w.id and e.actor_id=auth.uid() and e.kind=p_kind and e.recorded_at>clock_timestamp()-interval '10 minutes') then raise exception 'A recent message is already recorded. Allow time for a response.' using errcode='22023';end if;
 end if;
 insert into private.work_oversight_entries(id,org_id,work_item_id,actor_id,kind,note,recipient_id,reply_to)
 values(p_request_id,w.org_id,w.id,auth.uid(),p_kind,btrim(p_note),recipient,p_reply_to) returning id into result;
 insert into public.activity_events(org_id,actor_id,verb,object_type,object_id,meta)
 values(w.org_id,auth.uid(),'work_oversight_'||p_kind,'work_item',w.id,jsonb_build_object('entry_id',result,'reply_to',p_reply_to));
 -- Updates are visible without creating a notification or formal review submission.
 if recipient is distinct from auth.uid() and recipient is not null then
 perform private.ceac_emit_notification(w.org_id,recipient,'work_item',w.id,'work_oversight',result);
 end if;
 return result;
end $$;
revoke all on function public.add_work_oversight_entry(uuid,text,text,uuid,uuid) from public,anon;
grant execute on function public.add_work_oversight_entry(uuid,text,text,uuid,uuid) to authenticated;

-- Extend the existing notification transport, without exposing note text in previews.
alter table public.ceac_notification_events drop constraint ceac_notification_events_event_kind_check;
alter table public.ceac_notification_events add constraint ceac_notification_events_event_kind_check check(event_kind in
 ('case_opened','case_response','case_referred','case_resolved','memo_sent','memo_response','work_assigned',
 'policy_published','evidence_submitted','evidence_reviewed','exception_requested','exception_decided','support_request_opened',
 'work_submitted','work_returned','work_approved','routine_reviewed','room_activity','room_mention','meeting_invited','meeting_changed','meeting_cancelled','leave_requested','leave_decided','work_oversight'));
alter function private.ceac_notification_context_visible(text,uuid) rename to ceac_notification_context_visible_before_oversight;
create function private.ceac_notification_context_visible(p_kind text,p_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select private.ceac_notification_context_visible_before_oversight(p_kind,p_id)
 or (p_kind='work_item' and public.app_stage2_universal_aal_allowed() and private.work_oversight_visible(p_id,auth.uid()));
$$;
revoke all on function private.ceac_notification_context_visible(text,uuid) from public,anon,authenticated;
-- Current actor scope is rechecked by the device dispatcher before sending.
create or replace function public.ceac_push_work_recipient(p_work uuid,p_profile uuid,p_event text) returns boolean
language sql stable security definer set search_path='' as $$
 select case when p_event='work_oversight' then private.work_oversight_visible(p_work,p_profile)
 else exists(select 1 from public.work_items w join public.profiles p on p.id=p_profile and p.org_id=w.org_id and p.active
 where w.id=p_work and w.visibility<>'private' and case when p_event='work_submitted'
 then w.status='in_review' and private.ceac_responsible_reviewer_id(w.id)=p_profile else w.assignee_id=p_profile end) end;
$$;
revoke all on function public.ceac_push_work_recipient(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.ceac_push_work_recipient(uuid,uuid,text) to service_role;

create function public.work_recorded_supervisor(p_work uuid) returns uuid
language plpgsql stable security definer set search_path='' as $$
declare w public.work_items;
begin
 if auth.uid() is null or public.app_org_id() is null or not public.app_stage2_universal_aal_allowed()
 or not exists(select 1 from public.profiles p where p.id=auth.uid() and p.org_id=public.app_org_id() and p.active)
 or not public.app_can_see_item(p_work) then return null;end if;
 select * into w from public.work_items where id=p_work and org_id=public.app_org_id() and visibility<>'private' and not confidential;
 if w.id is null then return null;end if;
 return private.work_named_supervisor(w.org_id,w.assignee_id);
end $$;
revoke all on function public.work_recorded_supervisor(uuid) from public,anon;
grant execute on function public.work_recorded_supervisor(uuid) to authenticated;

-- No change without a verified HR reporting line; recorded assigning Admin keeps final review.
alter function private.ceac_responsible_reviewer_id(uuid) rename to ceac_responsible_reviewer_before_oversight;
create function private.ceac_responsible_reviewer_id(item_id uuid) returns uuid
language sql stable security definer set search_path='' as $$
 select case when w.visibility<>'private' and not w.confidential and w.kind in ('task','deliverable','meeting_outcome')
 and exists(select 1 from public.unit_memberships m where m.org_id=w.org_id and m.profile_id=w.assignee_id and m.role='manager')
 and not exists(select 1 from public.profiles p where p.id=w.assigned_by and p.org_id=w.org_id and p.active and p.is_admin and p.id<>w.assignee_id)
 then coalesce(private.work_named_supervisor(w.org_id,w.assignee_id),private.ceac_responsible_reviewer_before_oversight(w.id))
 else private.ceac_responsible_reviewer_before_oversight(w.id) end from public.work_items w where w.id=item_id;
$$;
revoke all on function private.ceac_responsible_reviewer_id(uuid) from public,anon,authenticated;

CREATE OR REPLACE FUNCTION public.app_responsible_reviewer_id(item_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
declare
  w public.work_items;
  v_reviewer uuid;
begin
  if auth.uid() is null or public.app_org_id() is null then
    return null;
  end if;
  if not public.app_can_see_item(item_id) then
    return null;
  end if;

  select * into w
  from public.work_items
  where id=item_id
    and org_id=public.app_org_id()
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

    if not w.confidential then
      v_reviewer:=public.work_recorded_supervisor(w.id);
      if v_reviewer is not null then return v_reviewer;end if;
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
