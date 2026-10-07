-- 104 — ERC4: protected HR subject model supports roster-only employees.
-- Adds employee-roster subject keys without removing linked-profile compatibility.

alter table hr_private.identifiers
  add column if not exists employee_id uuid references public.employee_roster(id) on delete restrict;
alter table hr_private.employment_terms
  add column if not exists employee_id uuid references public.employee_roster(id) on delete restrict;
alter table hr_private.compensation_history
  add column if not exists employee_id uuid references public.employee_roster(id) on delete restrict;
alter table hr_private.payment_details
  add column if not exists employee_id uuid references public.employee_roster(id) on delete restrict;
alter table hr_private.documents
  add column if not exists employee_id uuid references public.employee_roster(id) on delete restrict;
alter table hr_private.audit_events
  add column if not exists subject_employee_id uuid references public.employee_roster(id) on delete restrict;

alter table hr_private.identifiers alter column profile_id drop not null;
alter table hr_private.employment_terms alter column profile_id drop not null;
alter table hr_private.compensation_history alter column profile_id drop not null;
alter table hr_private.payment_details alter column profile_id drop not null;

update hr_private.identifiers t
set employee_id=er.id
from public.employee_roster er
where t.employee_id is null and t.profile_id=er.profile_id and t.org_id=er.org_id;

update hr_private.employment_terms t
set employee_id=er.id
from public.employee_roster er
where t.employee_id is null and t.profile_id=er.profile_id and t.org_id=er.org_id;

update hr_private.compensation_history t
set employee_id=er.id
from public.employee_roster er
where t.employee_id is null and t.profile_id=er.profile_id and t.org_id=er.org_id;

update hr_private.payment_details t
set employee_id=er.id
from public.employee_roster er
where t.employee_id is null and t.profile_id=er.profile_id and t.org_id=er.org_id;

update hr_private.documents t
set employee_id=er.id
from public.employee_roster er
where t.employee_id is null and t.profile_id=er.profile_id and t.org_id=er.org_id;

alter table hr_private.identifiers
  drop constraint if exists hr_identifiers_subject_check;
alter table hr_private.identifiers
  add constraint hr_identifiers_subject_check
  check(employee_id is not null or profile_id is not null);

alter table hr_private.employment_terms
  drop constraint if exists hr_employment_terms_subject_check;
alter table hr_private.employment_terms
  add constraint hr_employment_terms_subject_check
  check(employee_id is not null or profile_id is not null);

alter table hr_private.compensation_history
  drop constraint if exists hr_compensation_subject_check;
alter table hr_private.compensation_history
  add constraint hr_compensation_subject_check
  check(employee_id is not null or profile_id is not null);

alter table hr_private.payment_details
  drop constraint if exists hr_payment_subject_check;
alter table hr_private.payment_details
  add constraint hr_payment_subject_check
  check(employee_id is not null or profile_id is not null);

alter table hr_private.documents
  drop constraint if exists hr_documents_subject_check;
alter table hr_private.documents
  add constraint hr_documents_subject_check
  check(employee_id is not null or profile_id is not null);

create index if not exists hr_identifiers_employee_idx
  on hr_private.identifiers(org_id,employee_id,recorded_at desc)
  where employee_id is not null;
create index if not exists hr_terms_employee_idx
  on hr_private.employment_terms(org_id,employee_id,starts_on desc)
  where employee_id is not null;
create index if not exists hr_comp_employee_idx
  on hr_private.compensation_history(org_id,employee_id,effective_on desc)
  where employee_id is not null;
create index if not exists hr_payment_employee_idx
  on hr_private.payment_details(org_id,employee_id,recorded_at desc)
  where employee_id is not null;
create index if not exists hr_documents_employee_idx
  on hr_private.documents(org_id,employee_id,created_at desc)
  where employee_id is not null;
create index if not exists hr_audit_employee_created_idx
  on hr_private.audit_events(subject_employee_id,created_at desc)
  where subject_employee_id is not null;

create unique index if not exists hr_identifiers_active_employee_uidx
  on hr_private.identifiers(org_id,employee_id,lower(identifier_type))
  where status='active' and employee_id is not null;

create or replace function public.hr_employee_protected_summary(p_employee_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_org uuid:=public.app_org_id();
  v_actor uuid:=auth.uid();
  v_profile uuid;
  v_result jsonb;
begin
  if v_actor is null or not public.app_has_capability('hr_private.access',null) then
    raise exception 'You do not have authority to access protected HR records.' using errcode='42501';
  end if;

  select er.profile_id into v_profile
  from public.employee_roster er
  where er.id=p_employee_id and er.org_id=v_org;

  if not found then
    raise exception 'That employee does not belong to your organisation.' using errcode='42501';
  end if;

  v_result:=jsonb_build_object(
    'identifiers',coalesce((
      select jsonb_agg(to_jsonb(x) order by x.recorded_at desc)
      from (
        select id,identifier_type,identifier_value,issued_on,expires_on,status,replaces_id,recorded_at
        from hr_private.identifiers
        where org_id=v_org
          and (employee_id=p_employee_id or (employee_id is null and profile_id=v_profile))
      ) x
    ),'[]'::jsonb),
    'employment_terms',coalesce((
      select jsonb_agg(to_jsonb(x) order by x.starts_on desc,x.recorded_at desc)
      from (
        select id,term_type,summary,starts_on,ends_on,status,replaces_id,recorded_at
        from hr_private.employment_terms
        where org_id=v_org
          and (employee_id=p_employee_id or (employee_id is null and profile_id=v_profile))
      ) x
    ),'[]'::jsonb),
    'compensation',coalesce((
      select jsonb_agg(to_jsonb(x) order by x.effective_on desc,x.recorded_at desc)
      from (
        select id,amount_minor,currency,basis_label,effective_on,ends_on,note,status,replaces_id,recorded_at
        from hr_private.compensation_history
        where org_id=v_org
          and (employee_id=p_employee_id or (employee_id is null and profile_id=v_profile))
      ) x
    ),'[]'::jsonb),
    'payment_details',coalesce((
      select jsonb_agg(to_jsonb(x) order by x.recorded_at desc)
      from (
        select id,payment_type,provider_name,account_name,account_reference,branch_reference,status,replaces_id,recorded_at
        from hr_private.payment_details
        where org_id=v_org
          and (employee_id=p_employee_id or (employee_id is null and profile_id=v_profile))
      ) x
    ),'[]'::jsonb),
    'documents',coalesce((
      select jsonb_agg(to_jsonb(x) order by x.created_at desc)
      from (
        select id,document_type,title,storage_bucket,storage_path,issued_on,expires_on,status,replaces_document_id,created_at
        from hr_private.documents
        where org_id=v_org
          and (employee_id=p_employee_id or (employee_id is null and profile_id=v_profile))
      ) x
    ),'[]'::jsonb)
  );

  insert into hr_private.audit_events(
    org_id,actor_id,action,resource_type,subject_profile_id,subject_employee_id,detail
  ) values (
    v_org,v_actor,'protected_hr_viewed','employee',v_profile,p_employee_id,
    jsonb_build_object('surface','protected_hr')
  );

  return v_result;
end;
$$;

revoke all on function public.hr_employee_protected_summary(uuid) from public,anon;
grant execute on function public.hr_employee_protected_summary(uuid) to authenticated,service_role;

create or replace function public.hr_employee_protected_record(
  p_employee_id uuid,
  p_record_type text,
  p_payload jsonb,
  p_replaces_id uuid default null,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_org uuid:=public.app_org_id();
  v_actor uuid:=auth.uid();
  v_profile uuid;
  v_id uuid;
  v_reason text:=nullif(btrim(coalesce(p_reason,'')),'');
  v_type text:=lower(btrim(coalesce(p_record_type,'')));
  v_currency text;
  v_amount bigint;
begin
  if v_actor is null or not public.app_has_capability('hr_private.access',null) then
    raise exception 'You do not have authority to change protected HR records.' using errcode='42501';
  end if;

  select er.profile_id into v_profile
  from public.employee_roster er
  where er.id=p_employee_id and er.org_id=v_org;

  if not found then
    raise exception 'That employee does not belong to your organisation.' using errcode='42501';
  end if;

  if v_reason is null or length(v_reason)<3 then
    raise exception 'A reason is required for protected HR changes.';
  end if;
  if jsonb_typeof(coalesce(p_payload,'{}'::jsonb))<>'object' then
    raise exception 'Protected HR record details must be an object.';
  end if;

  if v_type='identifier' then
    if nullif(btrim(coalesce(p_payload->>'identifier_type','')),'') is null
       or nullif(btrim(coalesce(p_payload->>'identifier_value','')),'') is null then
      raise exception 'Identifier type and value are required.';
    end if;
    if p_replaces_id is not null then
      update hr_private.identifiers
      set status='replaced'
      where id=p_replaces_id and org_id=v_org
        and (employee_id=p_employee_id or (employee_id is null and profile_id=v_profile))
        and status='active';
      if not found then raise exception 'The identifier being replaced was not found.' using errcode='42501'; end if;
    end if;
    insert into hr_private.identifiers(
      org_id,employee_id,profile_id,identifier_type,identifier_value,issued_on,expires_on,replaces_id,recorded_by
    ) values (
      v_org,p_employee_id,v_profile,btrim(p_payload->>'identifier_type'),btrim(p_payload->>'identifier_value'),
      nullif(p_payload->>'issued_on','')::date,nullif(p_payload->>'expires_on','')::date,p_replaces_id,v_actor
    ) returning id into v_id;

  elsif v_type='employment_term' then
    if nullif(btrim(coalesce(p_payload->>'term_type','')),'') is null
       or nullif(btrim(coalesce(p_payload->>'summary','')),'') is null
       or nullif(p_payload->>'starts_on','') is null then
      raise exception 'Employment term, summary and start date are required.';
    end if;
    if p_replaces_id is not null then
      update hr_private.employment_terms
      set status='replaced'
      where id=p_replaces_id and org_id=v_org
        and (employee_id=p_employee_id or (employee_id is null and profile_id=v_profile))
        and status='active';
      if not found then raise exception 'The employment term being replaced was not found.' using errcode='42501'; end if;
    end if;
    insert into hr_private.employment_terms(
      org_id,employee_id,profile_id,term_type,summary,starts_on,ends_on,replaces_id,recorded_by
    ) values (
      v_org,p_employee_id,v_profile,btrim(p_payload->>'term_type'),btrim(p_payload->>'summary'),
      (p_payload->>'starts_on')::date,nullif(p_payload->>'ends_on','')::date,p_replaces_id,v_actor
    ) returning id into v_id;

  elsif v_type='compensation' then
    v_currency:=upper(btrim(coalesce(p_payload->>'currency','')));
    begin
      v_amount:=(p_payload->>'amount_minor')::bigint;
    exception when others then
      raise exception 'Compensation amount must be recorded in the smallest currency unit.';
    end;

    if v_amount<0 or v_currency!~'^[A-Z]{3}$'
       or nullif(btrim(coalesce(p_payload->>'basis_label','')),'') is null
       or nullif(p_payload->>'effective_on','') is null then
      raise exception 'Compensation amount, currency, basis and effective date are required.';
    end if;
    if p_replaces_id is not null then
      update hr_private.compensation_history
      set status='replaced'
      where id=p_replaces_id and org_id=v_org
        and (employee_id=p_employee_id or (employee_id is null and profile_id=v_profile))
        and status='active';
      if not found then raise exception 'The compensation record being replaced was not found.' using errcode='42501'; end if;
    end if;
    insert into hr_private.compensation_history(
      org_id,employee_id,profile_id,amount_minor,currency,basis_label,effective_on,ends_on,note,replaces_id,recorded_by
    ) values (
      v_org,p_employee_id,v_profile,v_amount,v_currency,btrim(p_payload->>'basis_label'),
      (p_payload->>'effective_on')::date,nullif(p_payload->>'ends_on','')::date,
      nullif(btrim(coalesce(p_payload->>'note','')),''),p_replaces_id,v_actor
    ) returning id into v_id;

  elsif v_type='payment_detail' then
    if nullif(btrim(coalesce(p_payload->>'payment_type','')),'') is null
       or nullif(btrim(coalesce(p_payload->>'provider_name','')),'') is null
       or nullif(btrim(coalesce(p_payload->>'account_name','')),'') is null
       or nullif(btrim(coalesce(p_payload->>'account_reference','')),'') is null then
      raise exception 'Payment type, provider, account name and account reference are required.';
    end if;
    if p_replaces_id is not null then
      update hr_private.payment_details
      set status='replaced'
      where id=p_replaces_id and org_id=v_org
        and (employee_id=p_employee_id or (employee_id is null and profile_id=v_profile))
        and status='active';
      if not found then raise exception 'The payment detail being replaced was not found.' using errcode='42501'; end if;
    end if;
    insert into hr_private.payment_details(
      org_id,employee_id,profile_id,payment_type,provider_name,account_name,account_reference,branch_reference,replaces_id,recorded_by
    ) values (
      v_org,p_employee_id,v_profile,btrim(p_payload->>'payment_type'),btrim(p_payload->>'provider_name'),
      btrim(p_payload->>'account_name'),btrim(p_payload->>'account_reference'),
      nullif(btrim(coalesce(p_payload->>'branch_reference','')),''),p_replaces_id,v_actor
    ) returning id into v_id;

  elsif v_type='document' then
    if nullif(btrim(coalesce(p_payload->>'document_type','')),'') is null
       or nullif(btrim(coalesce(p_payload->>'title','')),'') is null
       or nullif(btrim(coalesce(p_payload->>'storage_path','')),'') is null then
      raise exception 'Document type, title and protected storage path are required.';
    end if;
    if split_part(p_payload->>'storage_path','/',1)<>v_org::text then
      raise exception 'Protected document path must belong to your organisation.' using errcode='42501';
    end if;
    if p_replaces_id is not null then
      update hr_private.documents
      set status='replaced',archived_at=now()
      where id=p_replaces_id and org_id=v_org
        and (employee_id=p_employee_id or (employee_id is null and profile_id=v_profile))
        and status='active';
      if not found then raise exception 'The document being replaced was not found.' using errcode='42501'; end if;
    end if;
    insert into hr_private.documents(
      org_id,employee_id,profile_id,document_type,title,storage_bucket,storage_path,issued_on,expires_on,status,
      replaces_document_id,created_by,metadata
    ) values (
      v_org,p_employee_id,v_profile,btrim(p_payload->>'document_type'),btrim(p_payload->>'title'),
      'ceac-hr-private',btrim(p_payload->>'storage_path'),nullif(p_payload->>'issued_on','')::date,
      nullif(p_payload->>'expires_on','')::date,'active',p_replaces_id,v_actor,'{}'::jsonb
    ) returning id into v_id;

  else
    raise exception 'Choose a supported protected HR record type.';
  end if;

  insert into hr_private.audit_events(
    org_id,actor_id,action,resource_type,resource_id,subject_profile_id,subject_employee_id,reason,detail
  ) values (
    v_org,v_actor,'protected_hr_recorded',v_type,v_id,v_profile,p_employee_id,v_reason,
    jsonb_build_object('replaces_id',p_replaces_id)
  );

  return v_id;
end;
$$;

revoke all on function public.hr_employee_protected_record(uuid,text,jsonb,uuid,text) from public,anon;
grant execute on function public.hr_employee_protected_record(uuid,text,jsonb,uuid,text) to authenticated,service_role;

comment on column hr_private.identifiers.employee_id is
  'Canonical employee-roster subject. profile_id is optional compatibility context.';
comment on column hr_private.compensation_history.employee_id is
  'Canonical employee-roster subject used by Payroll population.';
comment on column hr_private.payment_details.employee_id is
  'Canonical employee-roster subject used by Payroll population.';
