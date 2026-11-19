-- Prevent drafts with already-expired availability dates, independent of frontend version.
-- Existing drafts remain unchanged and can be corrected by the author.
CREATE OR REPLACE FUNCTION public.create_announcement(p_title text, p_body text, p_priority text DEFAULT 'normal'::text, p_requires_acknowledgement boolean DEFAULT false, p_expires_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_all_org boolean DEFAULT true, p_unit_ids uuid[] DEFAULT '{}'::uuid[], p_roles text[] DEFAULT '{}'::text[])
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_id uuid;
  v_unit uuid;
  v_role text;
  v_scope text;
begin
  if not public.app_can_publish_announcements() then
    raise exception 'You are not allowed to publish announcements.' using errcode='42501';
  end if;
  if ('audience_volunteers'=any(coalesce(p_roles,'{}'::text[])) and 'audience_both'=any(coalesce(p_roles,'{}'::text[]))) then
    raise exception 'Choose one announcement audience.';
  end if;
  v_scope := case when 'audience_volunteers'=any(coalesce(p_roles,'{}'::text[])) then 'volunteers' when 'audience_both'=any(coalesce(p_roles,'{}'::text[])) then 'both' else 'staff' end;
  if not (public.app_is_admin() or public.app_is_exec() or public.app_has_capability('post_announcement',null)) then
    if p_all_org or coalesce(cardinality(p_unit_ids),0)=0
      or exists(select 1 from unnest(coalesce(p_unit_ids,'{}'::uuid[])) requested(id)
        where requested.id not in(select public.app_managed_units()))
      or exists(select 1 from unnest(coalesce(p_roles,'{}'::text[])) requested(role)
        where requested.role not in ('audience_volunteers','audience_both')) then
      raise exception 'Unit heads may announce only to their managed departments.' using errcode='42501';
    end if;
  end if;
  if p_expires_at is not null and p_expires_at<=now() then
    raise exception 'The expiry has already passed. Choose a future time or leave the expiry blank.' using errcode='22023';
  end if;
  if nullif(btrim(p_title),'') is null or nullif(btrim(p_body),'') is null then
    raise exception 'Add a title and message.';
  end if;
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
    where requested.role not in ('staff','sub_team_lead','manager','admin','exec','audience_volunteers','audience_both')
  ) then raise exception 'Choose a valid audience role.'; end if;

  insert into public.announcements(org_id,author_id,title,body,priority,requires_acknowledgement,expires_at)
  values(public.app_org_id(),auth.uid(),btrim(p_title),btrim(p_body),p_priority,p_requires_acknowledgement,p_expires_at)
  returning id into v_id;
  update public.announcements set audience_scope=v_scope where id=v_id;

  if p_all_org then
    insert into public.announcement_audiences(announcement_id,audience_type)
    values(v_id,'organisation');
  end if;
  foreach v_unit in array coalesce(p_unit_ids,'{}'::uuid[]) loop
    insert into public.announcement_audiences(announcement_id,audience_type,unit_id)
    values(v_id,'unit',v_unit) on conflict do nothing;
  end loop;
  foreach v_role in array coalesce(p_roles,'{}'::text[]) loop
    if v_role in ('audience_volunteers','audience_both') then continue; end if;
    insert into public.announcement_audiences(announcement_id,audience_type,audience_role)
    values(v_id,'role',v_role) on conflict do nothing;
  end loop;

  return v_id;
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
  v_scope text;
begin
  if not public.app_can_publish_announcements() then
    raise exception 'You are not allowed to edit announcements.' using errcode='42501';
  end if;
  select * into a from private.content_live_announcements where id=p_announcement_id for update;
  if a.id is null or a.org_id<>public.app_org_id() then raise exception 'That announcement is not available.'; end if;
  if a.status<>'draft' then raise exception 'Only a draft announcement can be edited.'; end if;
  if not (public.app_is_admin() or public.app_is_exec() or public.app_has_capability('post_announcement',null)) then
    if a.author_id is distinct from auth.uid() or not exists(
      select 1 from public.announcement_audiences aa
      where aa.announcement_id=a.id and aa.audience_type='unit'
        and aa.unit_id in(select public.app_managed_units())
    ) or exists(
      select 1 from public.announcement_audiences aa
      where aa.announcement_id=a.id
        and (aa.audience_type<>'unit' or aa.unit_id not in(select public.app_managed_units()))
    ) then
      raise exception 'Unit heads may manage only their own department announcements.' using errcode='42501';
    end if;
  end if;
  if not (public.app_is_admin() or public.app_is_exec() or public.app_has_capability('post_announcement',null)) then
    if p_all_org or coalesce(cardinality(p_unit_ids),0)=0
      or exists(select 1 from unnest(coalesce(p_unit_ids,'{}'::uuid[])) requested(id)
        where requested.id not in(select public.app_managed_units()))
      or exists(select 1 from unnest(coalesce(p_roles,'{}'::text[])) requested(role)
        where requested.role not in ('audience_volunteers','audience_both')) then
      raise exception 'Unit heads may announce only to their managed departments.' using errcode='42501';
    end if;
  end if;
  if ('audience_volunteers'=any(coalesce(p_roles,'{}'::text[])) and 'audience_both'=any(coalesce(p_roles,'{}'::text[]))) then
    raise exception 'Choose one announcement audience.';
  end if;
  v_scope := case when 'audience_volunteers'=any(coalesce(p_roles,'{}'::text[])) then 'volunteers' when 'audience_both'=any(coalesce(p_roles,'{}'::text[])) then 'both' else 'staff' end;
  if p_expires_at is not null and p_expires_at<=now() then
    raise exception 'The expiry has already passed. Choose a future time or leave the expiry blank.' using errcode='22023';
  end if;
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
    where requested.role not in ('staff','sub_team_lead','manager','admin','exec','audience_volunteers','audience_both')
  ) then raise exception 'Choose a valid audience role.'; end if;

  update public.announcements
  set title=btrim(p_title),body=btrim(p_body),priority=p_priority,
      requires_acknowledgement=p_requires_acknowledgement,
      expires_at=p_expires_at,audience_scope=v_scope,updated_at=now()
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
    if v_role in ('audience_volunteers','audience_both') then continue; end if;
    insert into public.announcement_audiences(announcement_id,audience_type,audience_role)
    values(a.id,'role',v_role) on conflict do nothing;
  end loop;
end;
$function$;
