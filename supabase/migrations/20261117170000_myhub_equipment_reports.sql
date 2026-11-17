begin;

-- Staff may report equipment that is missing from My Hub. A report is a
-- factual claim, not an official asset or custody assignment until an
-- authorised HR asset manager verifies it.
create table public.asset_staff_reports (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete restrict,
  reporter_id uuid not null references public.profiles(id) on delete restrict,
  category text not null check (length(btrim(category)) between 2 and 80),
  manufacturer text check (manufacturer is null or length(manufacturer) <= 120),
  model text check (model is null or length(model) <= 120),
  serial_number text check (serial_number is null or length(serial_number) <= 120),
  reported_asset_tag text check (reported_asset_tag is null or length(reported_asset_tag) <= 80),
  current_location text check (current_location is null or length(current_location) <= 200),
  condition_note text check (condition_note is null or length(condition_note) <= 500),
  details text check (details is null or length(details) <= 1000),
  status text not null default 'pending' check (status in ('pending','recorded','declined')),
  asset_id uuid references public.asset_items(id) on delete restrict,
  reviewed_by uuid references public.profiles(id) on delete restrict,
  reviewed_at timestamptz,
  resolution_note text,
  created_at timestamptz not null default now(),
  constraint asset_staff_reports_review_consistency check (
    (status='pending' and asset_id is null and reviewed_at is null and reviewed_by is null and resolution_note is null)
    or (status='recorded' and asset_id is not null and reviewed_at is not null and reviewed_by is not null and length(btrim(resolution_note)) between 3 and 1000)
    or (status='declined' and asset_id is null and reviewed_at is not null and reviewed_by is not null and length(btrim(resolution_note)) between 3 and 1000)
  )
);
create index asset_staff_reports_owner_idx on public.asset_staff_reports(org_id,reporter_id,created_at desc);
create index asset_staff_reports_review_idx on public.asset_staff_reports(org_id,status,created_at desc);
alter table public.asset_staff_reports enable row level security;
revoke all on public.asset_staff_reports from public,anon,authenticated;
grant select on public.asset_staff_reports to authenticated;
create policy asset_staff_reports_read on public.asset_staff_reports for select to authenticated
using (
  org_id=public.app_org_id()
  and (reporter_id=auth.uid() or public.app_has_capability('asset.manage',null))
);

create or replace function public.asset_submit_staff_report(
  p_category text,
  p_manufacturer text default null,
  p_model text default null,
  p_serial_number text default null,
  p_asset_tag text default null,
  p_location text default null,
  p_condition_note text default null,
  p_details text default null
) returns uuid
language plpgsql security definer set search_path = ''
as $function$
declare
  v_actor uuid:=auth.uid();
  v_org uuid:=public.app_org_id();
  v_report_id uuid;
begin
  if v_actor is null or v_org is null
     or not public.app_stage2_universal_aal_allowed()
     or not exists(
       select 1 from public.profiles p
       where p.id=v_actor and p.org_id=v_org and p.active
     ) then
    raise exception 'Sign in with your authorised account to report equipment.' using errcode='42501';
  end if;
  if length(btrim(coalesce(p_category,''))) not between 2 and 80 then
    raise exception 'Enter an equipment type (2–80 characters).';
  end if;
  if length(coalesce(p_manufacturer,''))>120 or length(coalesce(p_model,''))>120
    or length(coalesce(p_serial_number,''))>120 or length(coalesce(p_asset_tag,''))>80
    or length(coalesce(p_location,''))>200 or length(coalesce(p_condition_note,''))>500
    or length(coalesce(p_details,''))>1000 then
    raise exception 'One or more equipment details are too long.';
  end if;
  if (select count(*) from public.asset_staff_reports r
      where r.org_id=v_org and r.reporter_id=v_actor and r.status='pending') >= 8 then
    raise exception 'You already have eight reports awaiting HR. Please contact HR before adding another.';
  end if;
  insert into public.asset_staff_reports (
    org_id,reporter_id,category,manufacturer,model,serial_number,
    reported_asset_tag,current_location,condition_note,details
  ) values (
    v_org,v_actor,btrim(p_category),
    nullif(btrim(coalesce(p_manufacturer,'')),''),
    nullif(btrim(coalesce(p_model,'')),''),
    nullif(btrim(coalesce(p_serial_number,'')),''),
    nullif(btrim(coalesce(p_asset_tag,'')),''),
    nullif(btrim(coalesce(p_location,'')),''),
    nullif(btrim(coalesce(p_condition_note,'')),''),
    nullif(btrim(coalesce(p_details,'')),'')
  ) returning id into v_report_id;
  return v_report_id;
end;
$function$;
revoke all on function public.asset_submit_staff_report(text,text,text,text,text,text,text,text)
  from public,anon,authenticated;
grant execute on function public.asset_submit_staff_report(text,text,text,text,text,text,text,text)
  to authenticated,service_role;

-- Resolve with ONE transaction: register/assign together, link an already
-- inventoried item, or decline with a reason. No unverified staff claim can
-- directly write the official inventory.
create or replace function public.asset_resolve_staff_report(
  p_report_id uuid,
  p_action text,
  p_asset_code text,
  p_asset_id uuid,
  p_reason text
) returns uuid
language plpgsql security definer set search_path = ''
as $function$
declare
  v_actor uuid:=auth.uid();
  v_org uuid:=public.app_org_id();
  v_report public.asset_staff_reports;
  v_asset public.asset_items;
  v_asset_id uuid;
  v_note text:=btrim(coalesce(p_reason,''));
begin
  if v_actor is null or v_org is null
     or not public.app_has_capability('asset.manage',null)
     or not public.app_stage2_universal_aal_allowed() then
    raise exception 'Only authorised HR asset managers may verify equipment.' using errcode='42501';
  end if;
  if length(v_note) not between 3 and 1000 then
    raise exception 'Record a verification reason (3–1000 characters).';
  end if;
  if p_action not in ('register','assign_existing','decline') then
    raise exception 'Choose a supported equipment review action.';
  end if;

  select * into v_report from public.asset_staff_reports r
    where r.id=p_report_id and r.org_id=v_org for update;
  if v_report.id is null or v_report.status<>'pending' then
    raise exception 'That equipment report is no longer awaiting review.' using errcode='42501';
  end if;
  if not exists (
    select 1 from public.profiles p
    where p.id=v_report.reporter_id and p.org_id=v_org and p.active
  ) and p_action<>'decline' then
    raise exception 'This person is no longer active. Decline the report or contact HR.' using errcode='42501';
  end if;

  if p_action='register' then
    if length(btrim(coalesce(p_asset_code,''))) not between 2 and 80 then
      raise exception 'Enter a verified CEAC equipment tag.';
    end if;
    if p_asset_id is not null then
      raise exception 'Do not choose an existing asset when registering new equipment.';
    end if;
    v_asset_id:=public.asset_record_item(
      null,btrim(p_asset_code),v_report.category,v_report.manufacturer,
      v_report.model,v_report.serial_number,
      null,null,null,null,null,null,
      v_report.current_location,v_report.condition_note,
      'Recorded from verified staff equipment report '||v_report.id::text
    );
    perform public.asset_assign(
      v_asset_id,v_report.reporter_id,null,v_report.current_location,
      null,v_report.condition_note,'HR verified report: '||v_note
    );
  elsif p_action='assign_existing' then
    if p_asset_id is null then
      raise exception 'Choose the already registered equipment.';
    end if;
    select * into v_asset from public.asset_items a
      where a.id=p_asset_id and a.org_id=v_org for update;
    if v_asset.id is null or v_asset.current_status in ('repair','retired') then
      raise exception 'This equipment cannot currently be assigned.' using errcode='42501';
    end if;
    v_asset_id:=v_asset.id;
    if v_asset.current_assignee_profile_id is distinct from v_report.reporter_id
       or v_asset.current_status<>'assigned' then
      perform public.asset_assign(
        v_asset_id,v_report.reporter_id,null,
        coalesce(v_report.current_location,v_asset.current_location),
        null,coalesce(v_report.condition_note,v_asset.current_condition_note),
        'HR verified report: '||v_note
      );
    end if;
  end if;

  update public.asset_staff_reports
    set status=case when p_action='decline' then 'declined' else 'recorded' end,
        asset_id=v_asset_id,
        reviewed_by=v_actor,reviewed_at=now(),resolution_note=v_note
    where id=v_report.id;
  return v_asset_id;
end;
$function$;
revoke all on function public.asset_resolve_staff_report(uuid,text,text,uuid,text)
  from public,anon,authenticated;
grant execute on function public.asset_resolve_staff_report(uuid,text,text,uuid,text)
  to authenticated,service_role;

create trigger audit_asset_staff_reports
after insert or update on public.asset_staff_reports
for each row execute function public.platform_audit_capture('asset_staff_report','id','reporter_id');

commit;
