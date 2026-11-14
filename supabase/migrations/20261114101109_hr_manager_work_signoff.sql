-- HR can decide eligible manager submissions while the normal Executive route
-- remains in place. Record the acting role at decision time for later review.
alter table public.reviews add column reviewer_role text
  check (reviewer_role in ('administration', 'executive', 'reviewer'));

create function private.record_work_review_role()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  new.reviewer_role := case
    when public.app_is_exec() then 'executive'
    when public.app_is_admin() then 'administration'
    else 'reviewer'
  end;
  return new;
end;
$$;
revoke all on function private.record_work_review_role() from public,anon,authenticated;
create trigger record_work_review_role before insert on public.reviews
for each row execute function private.record_work_review_role();

create function private.work_has_hr_signoff(p_work uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists (
    select 1
    from public.submissions s
    join public.work_items w on w.id=s.work_item_id and w.org_id=s.org_id
    join public.reviews r on r.submission_id=s.id and r.org_id=s.org_id
    where s.work_item_id=p_work
      and exists (select 1 from public.unit_memberships m
                  where m.org_id=w.org_id and m.profile_id=w.assignee_id and m.role='manager')
      and r.decision='completed' and r.reviewer_role='administration'
      and s.id=(select id from public.submissions
                where work_item_id=p_work order by submitted_at desc,id desc limit 1)
  );
$$;
revoke all on function private.work_has_hr_signoff(uuid) from public,anon,authenticated;

create or replace function public.app_can_review_item(item_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists (
    select 1 from private.operational_live_work_items w
    where w.id=item_id and w.org_id=public.app_org_id()
      and w.kind in ('task','deliverable','meeting_outcome')
      and w.visibility<>'private'
      and w.assignee_id is distinct from auth.uid()
      and (
        (public.app_privileged_aal_allowed()
          and public.app_responsible_reviewer_id(w.id)=auth.uid())
        or (
          public.app_is_admin()
          and (
            not exists (select 1 from public.unit_memberships m
                        where m.org_id=w.org_id and m.profile_id=w.assignee_id and m.role='manager')
            or (w.status='in_review' and w.visibility='unit' and not w.confidential)
          )
        )
        or (
          public.app_is_exec() and w.status='completed' and w.visibility='unit' and not w.confidential
          and private.work_has_hr_signoff(w.id)
        )
      )
  );
$$;

create or replace function private.work_oversight_visible(p_work uuid,p_person uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.operational_live_work_items w
 join public.profiles p on p.id=p_person and p.org_id=w.org_id and p.active
 where w.id=p_work and w.visibility<>'private' and not w.confidential
 and (w.assignee_id=p_person or p.is_admin
 or (p.is_exec and w.status='completed' and private.work_has_hr_signoff(w.id))
 or private.work_named_supervisor(w.org_id,w.assignee_id)=p_person
 or private.ceac_responsible_reviewer_id(w.id)=p_person
 or exists(select 1 from public.unit_memberships m where m.org_id=w.org_id and m.unit_id=w.unit_id and m.profile_id=p_person and m.role='manager')));
$$;

create or replace function public.work_oversight_queue(p_offset integer default 0) returns jsonb
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
 where w.org_id=public.app_org_id() and (
   w.status not in ('cancelled','completed','self_certified')
   or (public.app_is_exec() and w.status='completed' and private.work_has_hr_signoff(w.id))
 )
 and private.work_oversight_visible(w.id,auth.uid())
 ), page as (select * from scoped order by (pending_count>0) desc,coalesce(updated_at,last_movement_at) desc,id limit 50 offset p_offset)
 select jsonb_build_object('total',(select count(*) from scoped),'rows',coalesce((select jsonb_agg(to_jsonb(page) order by (pending_count>0) desc,coalesce(updated_at,last_movement_at) desc,id) from page),'[]'::jsonb)) into result;
 return result;
end $$;

create or replace function public.add_work_oversight_entry(p_work uuid,p_kind text,p_note text,p_request_id uuid,p_reply_to uuid default null) returns uuid
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
 if w.status in ('completed','cancelled','self_certified')
 and not (w.status='completed' and p_kind='feedback' and p_reply_to is null
   and public.app_is_exec() and private.work_has_hr_signoff(w.id)) then raise exception 'This work is closed. Open its full record to review the outcome.' using errcode='22023';end if;
 context:=public.work_oversight_context(w.id);
 if p_kind in ('accepted','changes_requested','answered') then
 select * into parent from private.work_oversight_entries where id=p_reply_to and work_item_id=w.id and org_id=w.org_id;
 if parent.id is null or parent.kind not in ('milestone','decision','attention') or parent.actor_id=auth.uid() or parent.recipient_id is distinct from auth.uid()
 or not public.app_privileged_aal_allowed() then raise exception 'Only the named independent recipient can decide this request.' using errcode='42501';end if;
 if p_kind in ('accepted','changes_requested') and parent.kind<>'milestone' or p_kind='answered' and parent.kind='milestone'
 then raise exception 'Choose the correct response for this request.' using errcode='22023';end if;
 if exists(select 1 from private.work_oversight_entries where reply_to=parent.id) then raise exception 'This request already has a response. Refresh the work.' using errcode='22023';end if;
 -- A response acknowledges this exact request, leaving other unread activity intact.
 update public.ceac_notification_events set read_at=coalesce(read_at,clock_timestamp())
 where org_id=w.org_id and recipient_id=auth.uid() and context_kind='work_item'
 and context_id=w.id and event_kind='work_oversight' and source_event_id=parent.id;
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
