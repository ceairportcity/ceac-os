-- Allow unit managers to publish only to their managed departments, never organisation-wide.
-- Global publishers retain existing authority. Author draft policies remain account-scoped.
CREATE OR REPLACE FUNCTION public.app_can_publish_announcements()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select auth.uid() is not null and (
    public.app_is_admin()
    or public.app_is_exec()
    or public.app_has_capability('post_announcement',null)
    or exists(select 1 from public.app_managed_units())
  );
$function$;

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
  if a.status<>'draft' then raise exception 'Only a draft announcement can be published.'; end if;
  if not exists(select 1 from private.content_live_announcement_audiences where announcement_id=a.id) then raise exception 'Choose an audience before publishing.'; end if;
  if a.expires_at is not null and a.expires_at<=now() then raise exception 'The expiry must be in the future.'; end if;

  update public.announcements set status='published',published_at=now(),updated_at=now() where id=a.id;
  insert into public.activity_events(org_id,actor_id,verb,object_type,object_id,meta)
  values(a.org_id,auth.uid(),'announcement_published','announcement',a.id,
    jsonb_build_object('requires_acknowledgement',a.requires_acknowledgement));
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
  if a.status='closed' then raise exception 'That announcement is already closed.'; end if;
  update public.announcements set status='closed',updated_at=now() where id=a.id;
  insert into public.activity_events(org_id,actor_id,verb,object_type,object_id,meta)
  values(a.org_id,auth.uid(),'announcement_closed','announcement',a.id,'{}'::jsonb);
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

  if not (public.app_is_admin() or public.app_is_exec() or public.app_has_capability('post_announcement',null)) and not exists(
    select 1 from public.announcements a where a.id=p_announcement_id and a.author_id=auth.uid()
  ) then
    raise exception 'Unit heads may inspect counts only for their own announcements.' using errcode='42501';
  end if;
  return query
  with targets as (
    select distinct p.id
    from public.profiles p
    where p.org_id=public.app_org_id() and p.active
      and (case when exists(select 1 from public.employment_records er
        where er.profile_id=p.id and er.org_id=p.org_id and er.employment_status='active'
          and er.employment_type='volunteer')
        then exists(select 1 from public.announcements an where an.id=p_announcement_id and an.audience_scope in ('volunteers','both'))
        else exists(select 1 from public.announcements an where an.id=p_announcement_id and an.audience_scope in ('staff','both')) end)
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

alter policy announcements_read on public.announcements using
  ((org_id=public.app_org_id()) and (
    public.app_is_admin() or public.app_is_exec()
    or (author_id=auth.uid() and public.app_can_publish_announcements())
    or private.can_read_announcement(id)
  ));
alter policy announcement_audiences_read on public.announcement_audiences using
  (public.app_is_admin() or public.app_is_exec()
    or exists(select 1 from public.announcements a where a.id=announcement_id and a.author_id=auth.uid()
       and public.app_can_publish_announcements())
    or private.can_read_announcement(announcement_id));
