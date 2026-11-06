alter table public.ceac_push_subscriptions alter column categories set default '{"messages":true,"work":true,"calendar":true,"rooms":false}'::jsonb;
alter table public.ceac_notification_events drop constraint ceac_notification_events_event_kind_check;
alter table public.ceac_notification_events add constraint ceac_notification_events_event_kind_check check(event_kind in
 ('case_opened','case_response','case_referred','case_resolved','memo_sent','memo_response','work_assigned',
 'policy_published','evidence_submitted','evidence_reviewed','exception_requested','exception_decided','support_request_opened',
 'work_submitted','work_returned','work_approved','routine_reviewed','room_activity','room_mention','meeting_invited','meeting_changed','meeting_cancelled','leave_requested','leave_decided'));

-- Ordinary Room chatter stays quiet until a device explicitly opts in.
create function private.ceac_room_activity_notice() returns trigger language plpgsql security definer set search_path='' as $$
declare recipient uuid;
begin
 for recipient in select distinct p.id from public.profiles p join public.ceac_push_subscriptions s on s.profile_id=p.id and s.org_id=p.org_id and s.revoked_at is null
 where p.org_id=new.org_id and p.active and p.id<>new.author_id and s.categories->>'rooms'='true'
 and private.ceac_profile_room(new.room_id,p.id)
 and coalesce((select notification_level from public.room_notification_preferences pref where pref.profile_id=p.id and pref.room_id=new.room_id),case when p.is_admin or p.is_exec then 'mentions' else 'all' end)='all'
 loop perform private.ceac_emit_notification(new.org_id,recipient,'room',new.room_id,'room_activity',new.id);end loop;
 return new;
end $$;
revoke all on function private.ceac_room_activity_notice() from public,anon,authenticated;
create trigger ceac_room_activity_notice after insert on public.room_messages for each row execute function private.ceac_room_activity_notice();

create function public.ceac_push_room_message_current(p_message uuid,p_profile uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.room_messages m where m.id=p_message and private.ceac_profile_room(m.room_id,p_profile)
 and not exists(select 1 from private.room_message_removals r where r.message_id=m.id));
$$;
revoke all on function public.ceac_push_room_message_current(uuid,uuid) from public,anon,authenticated;
grant execute on function public.ceac_push_room_message_current(uuid,uuid) to service_role;
create function private.ceac_room_removed_notice() returns trigger language plpgsql security definer set search_path='' as $$
begin
 update public.ceac_notification_events set read_at=coalesce(read_at,clock_timestamp())
 where context_kind='room' and source_event_id=new.message_id;return new;
end $$;
revoke all on function private.ceac_room_removed_notice() from public,anon,authenticated;
create trigger ceac_room_removed_notice after insert on private.room_message_removals for each row execute function private.ceac_room_removed_notice();

-- Bind the sender's preview decision to the draft version they just saved.
revoke all on function public.set_memo_preview_privacy(uuid,boolean) from authenticated;
create function public.set_memo_preview_privacy(p_id uuid,p_confidential boolean,p_expected_updated_at timestamptz)
returns timestamptz language plpgsql security definer set search_path='' as $$
declare saved_at timestamptz;
begin
 if auth.uid() is null or not public.app_stage2_universal_aal_allowed() or not exists(select 1 from public.profiles p where p.id=auth.uid() and p.org_id=public.app_org_id() and p.active) then raise exception 'Sign in first.';end if;
 update public.memos set confidential=p_confidential,updated_at=clock_timestamp()
 where id=p_id and org_id=public.app_org_id() and sender_id=auth.uid() and status in ('draft','changes_requested')
 and updated_at=p_expected_updated_at returning updated_at into saved_at;
 if not found then raise exception 'Your memo changed. Reopen the draft before changing its notification preview.';end if;
 return saved_at;
end $$;
revoke all on function public.set_memo_preview_privacy(uuid,boolean,timestamptz) from public,anon;
grant execute on function public.set_memo_preview_privacy(uuid,boolean,timestamptz) to authenticated;
