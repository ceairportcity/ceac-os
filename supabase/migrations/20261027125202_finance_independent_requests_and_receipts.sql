-- CLI-generated forward-only correction: independent Administration requests
-- and optional expense receipts in the existing private operational file system.
-- Existing currency thresholds, Manager forms and ledger values stay intact.
alter table public.finance_requests add column independent_path text[]
 check(independent_path is null or independent_path=array['finance','exec']::text[]);

-- Pending Administration requests without an earlier Administration decision
-- can follow the independent path without rewriting any recorded decision.
update public.finance_requests r set independent_path=array['finance','exec']
 where r.state='submitted' and not public.finance_record_is_demo('finance_requests',r.id,r.org_id) and exists(select 1 from public.profiles p
   where p.id=r.requested_by and p.org_id=r.org_id and p.is_admin)
 and not exists(select 1 from public.finance_request_decisions d
   where d.request_id=r.id and d.authority='admin');

create function public.guard_finance_request_independence()
returns trigger language plpgsql security invoker set search_path='' as $guard$
begin
 if current_user not in ('authenticated','anon') then return new; end if;
 if tg_op='INSERT' then
  if auth.uid() is null or public.app_org_id() is null
    or not public.app_stage2_universal_aal_allowed()
    or new.requested_by is distinct from auth.uid()
    or new.org_id is distinct from public.app_org_id()
    or new.unit_id not in(select public.app_managed_units())
    or not exists(select 1 from public.units u where u.id=new.unit_id and u.org_id=new.org_id and u.active) then
   raise exception 'Choose a department you currently head.' using errcode='42501';
  end if;
  if new.state<>'submitted' or new.decided_at is not null or new.fulfilled_spend_id is not null then
   raise exception 'A new funds request must await its independent decision.' using errcode='42501';
  end if;
  if new.project_id is not null and not exists(select 1 from public.projects p
    where p.id=new.project_id and p.org_id=new.org_id
     and (p.lead_unit_id=new.unit_id or exists(select 1 from public.project_units pu where pu.project_id=p.id and pu.unit_id=new.unit_id))) then
   raise exception 'Choose a project linked to that department.' using errcode='42501';
  end if;
  new.independent_path:=case when public.app_is_admin() then array['finance','exec']::text[] else null end;
 elsif new.independent_path is distinct from old.independent_path then
  raise exception 'The independent decision path cannot be changed.' using errcode='42501';
 end if;
 return new;
end $guard$;
revoke all on function public.guard_finance_request_independence() from public,anon,authenticated;
create trigger finance_request_independence before insert or update on public.finance_requests
 for each row execute function public.guard_finance_request_independence();

create or replace function decide_finance_request(
  p_request_id uuid, p_decision text, p_note text default null
) returns text
language plpgsql security definer set search_path = public as $$
declare
  r record; v_path text[]; v_stage int; v_needed text; v_mine text;
begin
  if auth.uid() is null or app_org_id() is null or not public.app_stage2_universal_aal_allowed()
     or not exists(select 1 from public.profiles actor where actor.id=auth.uid() and actor.active and actor.org_id=app_org_id()) then
    raise exception 'Sign in with an active organisation account.' using errcode='42501';
  end if;
  select * into r from finance_requests where id = p_request_id for update;
  if r is null then raise exception 'That request does not exist.'; end if;
  if r.org_id <> app_org_id() then raise exception 'That belongs to another organisation.'; end if;
  if r.state <> 'submitted' then raise exception 'That request is already %.', r.state; end if;
  if p_decision is null or p_decision not in ('approved','declined') then raise exception 'Decision must be approved or declined.'; end if;

  if r.requested_by=auth.uid() then
    raise exception 'A requester cannot decide their own funds request.' using errcode='42501';
  end if;
  if p_decision='declined' and nullif(btrim(p_note),'') is null then
    raise exception 'Record a reason before declining a funds request.' using errcode='22023';
  end if;
  v_path := coalesce(r.independent_path,finance_request_path(r.amount_minor, r.currency, r.org_id));
  select coalesce(max(stage), 0) + 1 into v_stage from finance_request_decisions where request_id = r.id;
  if v_stage > array_length(v_path, 1) then raise exception 'That request has all the decisions it needs.'; end if;
  v_needed := v_path[v_stage];

  -- Which authority is this caller acting as?
  v_mine := case
    when v_needed = 'admin'   and app_is_admin() then 'admin'
    when v_needed = 'exec'    and app_is_exec()  then 'exec'
    when v_needed = 'finance' and exists (
      select 1 from unit_memberships m join units u on u.id = m.unit_id
       where m.profile_id = auth.uid() and m.org_id=r.org_id and u.org_id=r.org_id and u.active and u.handles_finance) then 'finance'
    else null end;

  if v_mine is null then
    raise exception 'This request needs % at this stage.',
      case v_needed when 'admin' then 'Administration'
                    when 'finance' then 'Finance'
                    else 'the Group Pastor' end;
  end if;

  -- A person may not provide two decisions on the same request.
  if exists (select 1 from finance_request_decisions d
              where d.request_id = r.id and d.decider_id = auth.uid()) then
    raise exception 'You have already decided on this request.';
  end if;

  insert into finance_request_decisions (request_id, stage, authority, decider_id, decision, note)
  values (r.id, v_stage, v_mine, auth.uid(), p_decision, p_note);

  if p_decision = 'declined' then
    update finance_requests set state = 'declined', decided_at = now() where id = r.id;
    return 'declined';
  end if;

  if v_stage = array_length(v_path, 1) then
    update finance_requests set state = 'approved', decided_at = now() where id = r.id;
    return 'approved';
  end if;

  return 'awaiting ' || v_path[v_stage + 1];
end; $$;

create or replace function fulfil_finance_request(
  p_request_id uuid, p_spent_on date default null, p_source_note text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare r record; v_spend uuid;
begin
  if auth.uid() is null or app_org_id() is null or not public.app_stage2_universal_aal_allowed() then
    raise exception 'Sign in with an active organisation account.' using errcode='42501';
  end if;
  select * into r from finance_requests where id = p_request_id for update;
  if r is null then raise exception 'That request does not exist.'; end if;
  if r.org_id <> app_org_id() then raise exception 'That belongs to another organisation.'; end if;
  if r.state <> 'approved' then raise exception 'Only an approved request can be paid out.'; end if;

  if not (app_is_admin() or exists (
      select 1 from unit_memberships m join units u on u.id = m.unit_id
       where m.profile_id = auth.uid() and m.org_id=r.org_id and u.org_id=r.org_id and u.active and u.handles_finance)) then
    raise exception 'Only Finance or Administration can pay out a request.';
  end if;

  insert into spend_lines (org_id, unit_id, project_id, spent_on, description,
                           amount_minor, currency, source_note, entered_by)
  values (r.org_id, r.unit_id, r.project_id,
          coalesce(p_spent_on, current_date), r.title,
          r.amount_minor, r.currency,
          coalesce(p_source_note, 'Approved request'), auth.uid())
  returning id into v_spend;

  update finance_requests
     set state = 'fulfilled', fulfilled_spend_id = v_spend
   where id = r.id;
  return v_spend;
end; $$;

-- Invoker predicate preserves spend RLS; no new browser definer endpoint.
create function public.app_can_attach_spend_receipt(p_spend_id uuid)
returns boolean language sql stable security invoker set search_path='' as $receipt$
 select auth.uid() is not null and public.app_stage2_universal_aal_allowed()
 and exists(select 1 from public.profiles actor where actor.id=auth.uid() and actor.org_id=public.app_org_id() and actor.active)
 and exists(select 1 from public.spend_lines s where s.id=p_spend_id and s.org_id=public.app_org_id()
  and not public.finance_record_is_demo('spend_lines',s.id,s.org_id)
  and (public.app_is_admin() or exists(select 1 from public.unit_memberships m join public.units u on u.id=m.unit_id
    where m.profile_id=auth.uid() and m.org_id=s.org_id and u.org_id=s.org_id and u.id=s.unit_id and u.active and u.handles_finance)));
$receipt$;
revoke all on function public.app_can_attach_spend_receipt(uuid) from public,anon;
grant execute on function public.app_can_attach_spend_receipt(uuid) to authenticated,service_role;

alter table public.operational_file_links drop constraint operational_file_links_context_type_check,
 drop constraint operational_file_links_relation_check, drop constraint operational_file_links_context_relation_check;
alter table public.operational_file_links
 add constraint operational_file_links_context_type_check check(context_type in(
 'work_item','project','room_message','announcement','employee_photo','employee_document','support_case','routine_date_progress','spend_line')),
 add constraint operational_file_links_relation_check check(relation in(
 'assignment_source','project_file','room_media','announcement_attachment','employee_photo','employee_document','support_evidence','routine_evidence','expense_receipt')),
 add constraint operational_file_links_context_relation_check check(
 (context_type='work_item' and relation='assignment_source') or (context_type='project' and relation='project_file')
 or (context_type='room_message' and relation='room_media') or (context_type='announcement' and relation='announcement_attachment')
 or (context_type='employee_photo' and relation='employee_photo') or (context_type='employee_document' and relation='employee_document')
 or (context_type='support_case' and relation='support_evidence') or (context_type='routine_date_progress' and relation='routine_evidence')
 or (context_type='spend_line' and relation='expense_receipt'));

CREATE OR REPLACE FUNCTION public.app_can_read_operational_context(p_context_type text, p_context_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select auth.uid() is not null and case p_context_type
    when 'work_item' then public.app_can_see_item(p_context_id)
    when 'project' then p_context_id in (select public.app_visible_projects())
    when 'room_message' then exists(
      select 1 from public.room_messages rm
      where rm.id=p_context_id
        and rm.org_id=public.app_org_id()
        and public.app_can_access_room(rm.room_id)
    )
    when 'announcement' then exists(
      select 1 from private.content_live_announcements a
      where a.id=p_context_id
        and a.org_id=public.app_org_id()
        and (
          public.app_is_admin()
          or public.app_is_exec()
          or a.author_id=auth.uid()
          or public.app_can_read_announcement(a.id)
        )
    )
    when 'employee_photo' then exists(
      select 1 from public.employee_roster e
      where e.id=p_context_id and e.org_id=public.app_org_id()
    )
    when 'employee_document' then (
      public.app_is_admin()
      and exists(
        select 1 from public.employee_roster e
        where e.id=p_context_id and e.org_id=public.app_org_id()
      )
    )
    when 'routine_date_progress' then (
      public.app_stage2_universal_aal_allowed()
      and exists(select 1 from public.profiles actor where actor.id=auth.uid() and actor.org_id=public.app_org_id() and actor.active)
      and exists(select 1 from public.routine_date_progress p
        join public.recurring_operations r on r.id=p.operation_id and r.org_id=p.org_id
        join public.work_items w on w.id=r.work_item_id and w.org_id=r.org_id
        where p.id=p_context_id and p.org_id=public.app_org_id()
          and w.visibility='unit' and not w.confidential and public.app_can_see_item(w.id))
    )
    when 'support_case' then public.app_can_read_support_case(p_context_id)
    when 'spend_line' then (public.app_stage2_universal_aal_allowed() and exists(
      select 1 from public.spend_lines s where s.id=p_context_id and s.org_id=public.app_org_id()
       and not public.finance_record_is_demo('spend_lines',s.id,s.org_id)
       and (public.app_is_admin() or public.app_is_exec() or s.unit_id in(select public.app_managed_units())
        or exists(select 1 from public.unit_memberships m join public.units u on u.id=m.unit_id
         where m.profile_id=auth.uid() and m.org_id=s.org_id and u.org_id=s.org_id and u.active and u.handles_finance))))
    else false
  end;
$function$;

CREATE OR REPLACE FUNCTION public.app_can_write_operational_context(p_context_type text, p_context_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select auth.uid() is not null and case p_context_type
    when 'work_item' then exists(
      select 1 from public.work_items w
      where w.id=p_context_id
        and w.org_id=public.app_org_id()
        and (
          w.assigned_by=auth.uid()
          or public.app_can_review_item(w.id)
          or public.app_is_admin()
          or public.app_is_exec()
        )
    )
    when 'project' then (
      public.app_is_admin()
      or public.app_is_exec()
      or public.app_can_manage_delivery_project(p_context_id)
    )
    when 'room_message' then exists(
      select 1 from public.room_messages rm
      where rm.id=p_context_id
        and rm.org_id=public.app_org_id()
        and rm.author_id=auth.uid()
        and public.app_can_access_room(rm.room_id)
    )
    when 'announcement' then exists(
      select 1 from private.content_live_announcements a
      where a.id=p_context_id
        and a.org_id=public.app_org_id()
        and public.app_can_publish_announcements()
    )
    when 'employee_photo' then (
      public.app_is_admin()
      and exists(
        select 1 from public.employee_roster e
        where e.id=p_context_id and e.org_id=public.app_org_id()
      )
    )
    when 'employee_document' then (
      public.app_is_admin()
      and exists(
        select 1 from public.employee_roster e
        where e.id=p_context_id and e.org_id=public.app_org_id()
      )
    )
    when 'routine_date_progress' then (
      public.app_stage2_universal_aal_allowed()
      and exists(select 1 from public.profiles actor where actor.id=auth.uid() and actor.org_id=public.app_org_id() and actor.active)
      and exists(select 1 from public.routine_date_progress p
        join public.recurring_operations r on r.id=p.operation_id and r.org_id=p.org_id
        join public.work_items w on w.id=r.work_item_id and w.org_id=r.org_id
        join public.units u on u.id=r.unit_id and u.org_id=r.org_id and u.active
        where p.id=p_context_id and p.org_id=public.app_org_id() and p.actor_id=auth.uid()
          and r.active and r.paused_at is null and w.kind='routine'
          and w.visibility='unit' and not w.confidential and public.app_can_see_item(w.id)
          and private.routine_date_can_record(r.id,p.scheduled_on))
    )
    when 'support_case' then public.app_can_write_support_case(p_context_id)
    when 'spend_line' then public.app_can_attach_spend_receipt(p_context_id)
    else false
  end;
$function$;

create or replace function public.register_operational_file(
  p_context_type text,
  p_context_id uuid,
  p_relation text,
  p_filename text,
  p_mime_type text,
  p_size_bytes bigint
)
returns table(file_id uuid,storage_path text,storage_bucket text)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_org uuid:=public.app_org_id();
  v_id uuid:=gen_random_uuid();
  v_filename text:=btrim(coalesce(p_filename,''));
  v_mime text:=lower(btrim(coalesce(p_mime_type,'')));
  v_safe text;
begin
  if auth.uid() is null or v_org is null then
    raise exception 'Sign in to attach a file.' using errcode='42501';
  end if;
  if not public.app_can_write_operational_context(p_context_type,p_context_id) then
    raise exception 'You cannot attach a file to that record.' using errcode='42501';
  end if;

  if p_context_type='work_item' and p_relation<>'assignment_source'
     or p_context_type='project' and p_relation<>'project_file'
     or p_context_type='room_message' and p_relation<>'room_media'
     or p_context_type='announcement' and p_relation<>'announcement_attachment'
     or p_context_type='employee_photo' and p_relation<>'employee_photo'
     or p_context_type='employee_document' and p_relation<>'employee_document'
     or p_context_type='support_case' and p_relation<>'support_evidence'
     or p_context_type='routine_date_progress' and p_relation<>'routine_evidence'
     or p_context_type='spend_line' and p_relation<>'expense_receipt'
     or p_context_type not in ('work_item','project','room_message','announcement','employee_photo','employee_document','support_case','routine_date_progress','spend_line') then
    raise exception 'That file relation does not match its record.';
  end if;

  if length(v_filename)<1 or length(v_filename)>240 then
    raise exception 'File names must be between 1 and 240 characters.';
  end if;
  if p_size_bytes is null or p_size_bytes<1 or p_size_bytes>52428800 then
    raise exception 'Files can be up to 50 MB.';
  end if;
  if v_mime not in (
    'image/jpeg','image/png','image/webp','image/gif',
    'application/pdf','text/plain','text/csv',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'audio/mpeg','audio/mp4','audio/wav','audio/x-wav','audio/ogg',
    'video/mp4','video/webm'
  ) then
    raise exception 'That file type is not supported.';
  end if;
  if p_context_type='employee_photo'
     and v_mime not in ('image/jpeg','image/png','image/webp') then
    raise exception 'Employee photos must be JPEG, PNG or WebP images.';
  end if;

  v_safe:=regexp_replace(v_filename,'[^A-Za-z0-9._-]+','_','g');
  if v_safe='' then v_safe:='file'; end if;

  insert into public.operational_files(
    id,org_id,filename,mime_type,size_bytes,storage_path,uploaded_by
  ) values(
    v_id,v_org,v_filename,v_mime,p_size_bytes,
    case when p_context_type='spend_line' then v_org::text||'/expense-receipt/'||p_context_id::text||'/'||v_id::text||'/'||v_safe when p_context_type='routine_date_progress' then v_org::text||'/routine-date/'||p_context_id::text||'/'||v_id::text||'/'||v_safe else v_org::text||'/'||v_id::text||'/'||v_safe end,auth.uid()
  );

  insert into public.operational_file_links(
    org_id,file_id,context_type,context_id,relation,linked_by
  ) values(
    v_org,v_id,p_context_type,p_context_id,p_relation,auth.uid()
  );

  return query
    select v_id,
           (select f.storage_path from public.operational_files f where f.id=v_id),
           'ceac-operational-private'::text;
end;
$$;

create or replace function public.link_operational_file(
  p_file_id uuid,
  p_context_type text,
  p_context_id uuid,
  p_relation text
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_file public.operational_files;
  v_link uuid;
begin
  if auth.uid() is null then
    raise exception 'Sign in to link a file.' using errcode='42501';
  end if;

  select * into v_file
  from public.operational_files
  where id=p_file_id
    and org_id=public.app_org_id()
    and state='active';

  if v_file.id is null or not public.app_can_access_operational_file(v_file.id) then
    raise exception 'That file is not available to you.' using errcode='42501';
  end if;
  if not public.app_can_write_operational_context(p_context_type,p_context_id) then
    raise exception 'You cannot attach a file to that record.' using errcode='42501';
  end if;

  if p_context_type='work_item' and p_relation<>'assignment_source'
     or p_context_type='project' and p_relation<>'project_file'
     or p_context_type='room_message' and p_relation<>'room_media'
     or p_context_type='announcement' and p_relation<>'announcement_attachment'
     or p_context_type='employee_photo' and p_relation<>'employee_photo'
     or p_context_type='employee_document' and p_relation<>'employee_document'
     or p_context_type='support_case' and p_relation<>'support_evidence'
     or p_context_type='routine_date_progress' and p_relation<>'routine_evidence'
     or p_context_type='spend_line' and p_relation<>'expense_receipt'
     or p_context_type not in ('work_item','project','room_message','announcement','employee_photo','employee_document','support_case','routine_date_progress','spend_line') then
    raise exception 'That file relation does not match its record.';
  end if;
  if p_context_type='employee_photo'
     and v_file.mime_type not in ('image/jpeg','image/png','image/webp') then
    raise exception 'Employee photos must be JPEG, PNG or WebP images.';
  end if;

  if p_context_type='spend_line' and not exists(select 1 from public.operational_file_links l
    where l.file_id=v_file.id and l.org_id=v_file.org_id and l.context_type='spend_line'
     and l.context_id=p_context_id and l.relation='expense_receipt') then
    raise exception 'Upload a receipt for this expense.' using errcode='42501';
  end if;
  if exists(select 1 from public.operational_file_links l where l.file_id=v_file.id and l.context_type='spend_line'
    and (p_context_type<>'spend_line' or l.context_id<>p_context_id)) then
    raise exception 'An expense receipt stays with its recorded expense.' using errcode='42501';
  end if;

  -- Date evidence is bound to the exact attributable update at registration.
  -- It cannot be imported from a broader context or shared into another date.
  if p_context_type='routine_date_progress' and not exists(
    select 1 from public.operational_file_links l where l.file_id=v_file.id
      and l.org_id=v_file.org_id and l.context_type='routine_date_progress'
      and l.context_id=p_context_id and l.relation='routine_evidence'
  ) then raise exception 'Upload new evidence for this date update.' using errcode='42501'; end if;
  if exists(select 1 from public.operational_file_links l where l.file_id=v_file.id
    and l.context_type='routine_date_progress'
    and (p_context_type<>'routine_date_progress' or l.context_id<>p_context_id)) then
    raise exception 'Dated routine evidence stays with its original update.' using errcode='42501';
  end if;

  -- Never relink an employee or project attachment into a Support case:
  -- that would disclose a previously approved private document to a new audience.
  -- A support-origin file is already bound to its original case at registration.
  IF p_context_type='support_case' AND NOT EXISTS(
    SELECT 1 FROM public.operational_file_links existing
    WHERE existing.file_id=v_file.id
      AND existing.org_id=v_file.org_id
      AND existing.context_type='support_case'
      AND existing.context_id=p_context_id
      AND existing.relation='support_evidence'
  ) THEN
    RAISE EXCEPTION 'A Support case can use only evidence registered to that case.'
      USING ERRCODE='42501';
  END IF;
  -- Keep case-specific evidence inside the same Support case if a file is
  -- later shared through another context. Case evidence is not portable.
  IF EXISTS(SELECT 1 FROM public.operational_file_links other
    WHERE other.file_id=v_file.id AND other.context_type='support_case'
      AND (p_context_type<>'support_case' OR other.context_id<>p_context_id))
  THEN
    RAISE EXCEPTION 'Support evidence cannot be linked to another context.'
      USING ERRCODE='42501';
  END IF;

  insert into public.operational_file_links(
    org_id,file_id,context_type,context_id,relation,linked_by
  ) values(
    v_file.org_id,v_file.id,p_context_type,p_context_id,p_relation,auth.uid()
  )
  on conflict(file_id,context_type,context_id,relation) do nothing
  returning id into v_link;

  if v_link is null then
    select l.id into v_link
    from public.operational_file_links l
    where l.file_id=v_file.id
      and l.context_type=p_context_type
      and l.context_id=p_context_id
      and l.relation=p_relation;
  end if;

  return v_link;
end;
$$;

create or replace function public.finalize_operational_file(p_file_id uuid)
returns uuid
language plpgsql
security definer
set search_path=public,storage
as $$
declare
  v_file public.operational_files;
begin
  if auth.uid() is null then
    raise exception 'Sign in to finish the file upload.' using errcode='42501';
  end if;

  select * into v_file
  from public.operational_files
  where id=p_file_id
  for update;

  if v_file.id is null
     or v_file.org_id is distinct from public.app_org_id()
     or v_file.uploaded_by is distinct from auth.uid()
     or v_file.state<>'pending' then
    raise exception 'That pending file is not available to you.' using errcode='42501';
  end if;

  if exists(select 1 from public.operational_file_links l where l.file_id=v_file.id
    and l.context_type in ('routine_date_progress','spend_line')
    and not public.app_can_write_operational_context(l.context_type,l.context_id)) then
    raise exception 'Your authority for that dated evidence has changed.' using errcode='42501';
  end if;

  if not exists(
    select 1 from storage.objects o
    where o.bucket_id=v_file.storage_bucket
      and o.name=v_file.storage_path
  ) then
    raise exception 'The file upload is not present in private storage.';
  end if;

  update public.operational_files
  set state='active',finalised_at=now()
  where id=v_file.id;

  return v_file.id;
end;
$$;

-- A pending-owner Storage grant cannot outlive current receipt authority.
create policy expense_receipt_current_writer on storage.objects
 as restrictive for insert to authenticated with check (
 bucket_id<>'ceac-operational-private'
 or coalesce((storage.foldername(storage.objects.name))[2],'')<>'expense-receipt'
 or exists(select 1 from public.spend_lines s
   where s.id::text=(storage.foldername(storage.objects.name))[3]
     and public.app_can_attach_spend_receipt(s.id)));

-- CREATE OR REPLACE preserves the existing reviewed function ACLs.
-- No new authenticated SECURITY DEFINER signature is exposed.
