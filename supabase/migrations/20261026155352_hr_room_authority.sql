-- Owner-authorised HR department/sub-team/project communication.
-- Preserve Executive contextual project rules and ordinary membership limits.
-- No identities, memberships, messages or permission grants are rewritten.
create or replace function public.app_can_access_room(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.rooms r
    where r.id=p_room_id
      and r.org_id=public.app_org_id()
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
            public.app_is_admin()
            or public.app_is_exec()
            or exists (
              select 1
              from public.unit_memberships um
              where um.profile_id=auth.uid()
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
                public.app_is_admin()
                or public.app_is_exec()
                or st.lead_id=auth.uid()
                or exists (
                  select 1
                  from public.sub_team_members stm
                  where stm.sub_team_id=st.id
                    and stm.profile_id=auth.uid()
                )
                or exists (
                  select 1
                  from public.unit_memberships um
                  where um.unit_id=st.unit_id
                    and um.profile_id=auth.uid()
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
                public.app_is_admin()
                or
                (
                  not public.app_is_exec()
                  and exists (
                    select 1
                    from public.unit_memberships um
                    where um.profile_id=auth.uid()
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
                  public.app_is_exec()
                  and (
                    p.created_by=auth.uid()
                    or p.sponsor_profile_id=auth.uid()
                    or p.delivery_owner_id=auth.uid()
                    or exists (
                      select 1
                      from public.work_items w
                      where w.project_id=p.id
                        and w.org_id=p.org_id
                        and (
                          w.assignee_id=auth.uid()
                          or w.assigned_by=auth.uid()
                        )
                    )
                    or exists (
                      select 1
                      from public.unit_memberships um
                      where um.profile_id=auth.uid()
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

revoke all on function public.app_can_access_room(uuid) from public,anon;
grant execute on function public.app_can_access_room(uuid) to authenticated,service_role;

-- Room members can reply to HR by a real mention without inventing membership.
CREATE OR REPLACE FUNCTION public.send_room_message(p_room_id uuid, p_body text, p_reply_to_id uuid DEFAULT NULL::uuid, p_refs jsonb DEFAULT '[]'::jsonb, p_mention_ids uuid[] DEFAULT '{}'::uuid[])
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  r public.rooms;
  v_id uuid:=gen_random_uuid();
  j jsonb;
  v_type text;
  v_object uuid;
  v_mention uuid;
begin
  if auth.uid() is null then
    raise exception 'Sign in to send a Room message.' using errcode='42501';
  end if;

  select * into r from public.rooms where id=p_room_id;
  if r.id is null or not public.app_can_access_room(r.id) then
    raise exception 'That Room is not available to you.' using errcode='42501';
  end if;

  if r.kind='unit' and not exists (
    select 1 from public.units u
    where u.id=r.unit_id and u.org_id=r.org_id and u.active
  ) then
    raise exception 'This Unit Room is not active.';
  end if;

  if r.kind='sub_team' and not exists (
    select 1 from public.sub_teams st
    where st.id=r.sub_team_id
      and st.unit_id=r.unit_id
      and st.org_id=r.org_id
      and st.active
  ) then
    raise exception 'This Sub-team Room is not active.';
  end if;

  if r.kind='project' and not exists (
    select 1 from public.projects p
    where p.id=r.project_id and p.org_id=r.org_id and p.status in ('planned','active')
  ) then
    raise exception 'This Project Room is read-only because the project is not active.';
  end if;

  if nullif(btrim(coalesce(p_body,'')),'') is null then
    raise exception 'Write a message before sending.';
  end if;
  if length(btrim(p_body))>8000 then
    raise exception 'Room messages can be up to 8000 characters.';
  end if;

  if p_reply_to_id is not null and not exists (
    select 1 from public.room_messages m
    where m.id=p_reply_to_id and m.room_id=r.id
  ) then
    raise exception 'That reply target is not in this Room.';
  end if;

  insert into public.room_messages(id,room_id,org_id,author_id,body,reply_to_id)
  values(v_id,r.id,r.org_id,auth.uid(),btrim(p_body),p_reply_to_id);

  for j in select * from jsonb_array_elements(coalesce(p_refs,'[]'::jsonb)) loop
    v_type:=j->>'object_type';
    v_object:=nullif(j->>'object_id','')::uuid;

    if v_type='work_item' then
      if v_object is null
         or not public.app_can_see_item(v_object)
         or not exists (
           select 1 from public.work_items w
           where w.id=v_object
             and (
               (r.kind='unit' and w.unit_id=r.unit_id)
               or (r.kind='sub_team' and w.sub_team_id=r.sub_team_id)
               or (r.kind='project' and w.project_id=r.project_id)
             )
         )
      then raise exception 'That work item cannot be referenced in this Room.'; end if;

    elsif v_type='project' then
      if v_object is null or not exists (
        select 1 from public.projects p
        where p.id=v_object
          and p.org_id=r.org_id
          and (
            (r.kind='project' and p.id=r.project_id)
            or (
              r.kind in ('unit','sub_team')
              and (
                p.lead_unit_id=r.unit_id
                or exists(
                  select 1 from public.project_units pu
                  where pu.project_id=p.id and pu.unit_id=r.unit_id
                )
              )
            )
          )
      ) then raise exception 'That project cannot be referenced in this Room.'; end if;

    elsif v_type='objective' then
      if v_object is null or not exists (
        select 1 from public.objectives o
        where o.id=v_object
          and o.org_id=r.org_id
          and (
            (r.kind='project' and o.project_id=r.project_id)
            or (r.kind in ('unit','sub_team') and o.unit_id=r.unit_id)
          )
      ) then raise exception 'That objective cannot be referenced in this Room.'; end if;

    elsif v_type='blocker' then
      if v_object is null or not exists (
        select 1 from public.blockers b
        join public.work_items w on w.id=b.work_item_id
        where b.id=v_object
          and b.org_id=r.org_id
          and public.app_can_see_item(w.id)
          and (
            (r.kind='project' and w.project_id=r.project_id)
            or (r.kind='unit' and w.unit_id=r.unit_id)
            or (r.kind='sub_team' and w.sub_team_id=r.sub_team_id)
          )
      ) then raise exception 'That dependency cannot be referenced in this Room.'; end if;

    else
      raise exception 'Unsupported Room reference type.';
    end if;

    insert into public.room_message_refs(message_id,object_type,object_id,label)
    values(v_id,v_type,v_object,nullif(btrim(coalesce(j->>'label','')),''))
    on conflict do nothing;
  end loop;

  foreach v_mention in array coalesce(p_mention_ids,'{}'::uuid[]) loop
    if not exists (
      select 1
      from public.profiles p
      where p.id=v_mention
        and p.org_id=r.org_id
        and p.active
        and (
          p.is_admin
          or (p.is_exec and r.kind in ('unit','sub_team'))
          or (
            r.kind='unit'
            and exists (
              select 1 from public.unit_memberships um
              where um.profile_id=p.id and um.unit_id=r.unit_id and um.org_id=r.org_id
            )
          )
          or
          (
            r.kind='sub_team'
            and (
              exists (
                select 1 from public.sub_team_members stm
                where stm.profile_id=p.id and stm.sub_team_id=r.sub_team_id
              )
              or exists (
                select 1
                from public.sub_teams st
                where st.id=r.sub_team_id and st.lead_id=p.id
              )
              or exists (
                select 1 from public.unit_memberships um
                where um.profile_id=p.id
                  and um.unit_id=r.unit_id
                  and um.role='manager'
              )
            )
          )
          or
          (
            r.kind='project'
            and exists (
              select 1
              from public.unit_memberships um
              join public.projects pr on pr.id=r.project_id
              where um.profile_id=p.id
                and um.org_id=r.org_id
                and (
                  um.unit_id=pr.lead_unit_id
                  or exists (
                    select 1 from public.project_units pu
                    where pu.project_id=pr.id and pu.unit_id=um.unit_id
                  )
                )
            )
          )
        )
    ) then
      raise exception 'A mentioned person is not part of this Room.';
    end if;

    insert into public.room_mentions(message_id,profile_id)
    values(v_id,v_mention)
    on conflict do nothing;
  end loop;

  return v_id;
end;
$function$;

revoke all on function public.send_room_message(uuid,text,uuid,jsonb,uuid[]) from public,anon;
grant execute on function public.send_room_message(uuid,text,uuid,jsonb,uuid[]) to authenticated,service_role;
