-- Owner corrective: linked-account personal HR facts must be editable with
-- source readback and actor history. Never change Auth email, operational role,
-- employment authority or payroll. This is NOT a duplicate employee table.
create table public.employee_linked_contact_change_events(
 id uuid primary key default gen_random_uuid(),
 org_id uuid not null references public.organisations(id) on delete restrict,
 profile_id uuid not null references public.profiles(id) on delete restrict,
 actor_id uuid not null references public.profiles(id) on delete restrict,
 recorded_at timestamptz not null default clock_timestamp(),
 reason text not null check(length(btrim(reason)) between 8 and 2000),
 before_record jsonb not null,
 after_record jsonb not null
);
create index employee_linked_contact_change_history_idx
 on public.employee_linked_contact_change_events(org_id,profile_id,recorded_at desc,id desc);
alter table public.employee_linked_contact_change_events enable row level security;
revoke all on public.employee_linked_contact_change_events from public,anon,authenticated;
grant select on public.employee_linked_contact_change_events to authenticated;
create policy employee_linked_contact_change_hr_read on public.employee_linked_contact_change_events
 for select to authenticated using(
  org_id=public.app_org_id() and public.app_is_admin()
  and public.app_stage2_universal_aal_allowed()
 );
comment on table public.employee_linked_contact_change_events is
 'Append-only linked employee official name/contact HR edits; separate from Auth, role grants and self-updated personal details.';

create function public.admin_record_linked_person_contact(
 p_profile_id uuid,
 p_expected_full_name text,
 p_expected_preferred_name text,
 p_expected_phone text,
 p_full_name text,
 p_preferred_name text,
 p_phone text,
 p_reason text
) returns jsonb
language plpgsql security definer set search_path=''
as $hrlinked$
declare
 v_org uuid:=public.app_org_id();
 v_original public.profiles%rowtype;
 v_name text:=btrim(coalesce(p_full_name,''));
 v_preferred text:=nullif(btrim(coalesce(p_preferred_name,'')),'');
 v_phone text:=nullif(btrim(coalesce(p_phone,'')),'');
begin
 if auth.uid() is null or v_org is null or not public.app_is_admin()
   or not public.app_stage2_universal_aal_allowed() then
  raise exception 'Only authorised HR can record employee personal details.' using errcode='42501';
 end if;
 if p_profile_id is null or length(v_name) not between 2 and 180
  or length(coalesce(v_preferred,''))>180
  or length(coalesce(v_phone,''))>40
  or (v_phone is not null and length(v_phone)<4)
  or length(btrim(coalesce(p_reason,''))) not between 8 and 2000 then
  raise exception 'Enter a verified employee name, contact and reason.' using errcode='22023';
 end if;
 select * into v_original from public.profiles
 where id=p_profile_id and org_id=v_org for update;
 if not found then
  raise exception 'Employee account is outside authorised HR scope.' using errcode='42501';
 end if;
 if v_original.full_name is distinct from p_expected_full_name
   or v_original.preferred_name is distinct from nullif(btrim(coalesce(p_expected_preferred_name,'')),'')
   or v_original.phone is distinct from nullif(btrim(coalesce(p_expected_phone,'')),'') then
  raise exception 'Employee details changed. Reload before recording a correction.' using errcode='40001';
 end if;
 if v_original.full_name is not distinct from v_name
  and v_original.preferred_name is not distinct from v_preferred
  and v_original.phone is not distinct from v_phone then
  raise exception 'No verified employee detail has changed.' using errcode='22023';
 end if;
 update public.profiles set full_name=v_name, preferred_name=v_preferred, phone=v_phone
 where id=p_profile_id and org_id=v_org;
 insert into public.employee_linked_contact_change_events(
  org_id,profile_id,actor_id,reason,before_record,after_record
 ) values(
  v_org,p_profile_id,auth.uid(),btrim(p_reason),
  jsonb_build_object('full_name',v_original.full_name,'preferred_name',v_original.preferred_name,
    'phone',v_original.phone),
  jsonb_build_object('full_name',v_name,'preferred_name',v_preferred,'phone',v_phone)
 );
 return jsonb_build_object('profile_id',p_profile_id,'full_name',v_name,
    'preferred_name',v_preferred,'phone',v_phone);
end;
$hrlinked$;

revoke all on function public.admin_record_linked_person_contact(
 uuid,text,text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.admin_record_linked_person_contact(
 uuid,text,text,text,text,text,text,text) to authenticated;
comment on function public.admin_record_linked_person_contact(
 uuid,text,text,text,text,text,text,text) is
 'Tenant-checked HR-only exact-before-edit official name and contact update, audited; no Auth email, salary, access or role change.';
