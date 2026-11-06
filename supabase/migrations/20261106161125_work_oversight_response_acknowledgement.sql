-- Resolve the request alert atomically with its independent response.
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
 if w.status in ('completed','cancelled','self_certified') then raise exception 'This work is closed. Open its full record to review the outcome.' using errcode='22023';end if;
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
revoke all on function public.add_work_oversight_entry(uuid,text,text,uuid,uuid) from public,anon;
grant execute on function public.add_work_oversight_entry(uuid,text,text,uuid,uuid) to authenticated;
