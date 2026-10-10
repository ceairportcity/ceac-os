-- 068 — Protected HR foundation.
--
-- Establishes the secure data/file boundary before Admin & HR feature work.
-- No salary structure, statutory-rate model, payroll calculation, or employee
-- sensitive identifiers are added here because those require product decisions.

create schema if not exists hr_private;

revoke all on schema hr_private from public,anon,authenticated;
grant usage on schema hr_private to service_role;

create table if not exists hr_private.documents(
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete restrict,
  profile_id uuid references public.profiles(id) on delete restrict,
  document_type text not null,
  title text not null,
  storage_bucket text not null default 'ceac-hr-private',
  storage_path text not null unique,
  issued_on date,
  expires_on date,
  status text not null default 'active'
    check(status in ('active','archived','replaced')),
  replaces_document_id uuid references hr_private.documents(id) on delete restrict,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  archived_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

alter table hr_private.documents enable row level security;

create index if not exists hr_documents_org_profile_idx
  on hr_private.documents(org_id,profile_id);
create index if not exists hr_documents_expiry_idx
  on hr_private.documents(org_id,expires_on)
  where expires_on is not null and status='active';

create table if not exists hr_private.audit_events(
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete restrict,
  actor_id uuid references public.profiles(id) on delete restrict,
  action text not null,
  resource_type text not null,
  resource_id uuid,
  subject_profile_id uuid references public.profiles(id) on delete restrict,
  reason text,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table hr_private.audit_events enable row level security;

create index if not exists hr_audit_org_created_idx
  on hr_private.audit_events(org_id,created_at desc);
create index if not exists hr_audit_subject_created_idx
  on hr_private.audit_events(subject_profile_id,created_at desc)
  where subject_profile_id is not null;

create or replace function hr_private.reject_audit_mutation()
returns trigger
language plpgsql
set search_path=hr_private,public
as $$
begin
  raise exception 'HR audit history is append-only.' using errcode='42501';
end;
$$;

drop trigger if exists hr_audit_events_immutable on hr_private.audit_events;
create trigger hr_audit_events_immutable
before update or delete on hr_private.audit_events
for each row execute function hr_private.reject_audit_mutation();

revoke all on all tables in schema hr_private from public,anon,authenticated;
revoke all on all sequences in schema hr_private from public,anon,authenticated;
revoke all on all functions in schema hr_private from public,anon,authenticated;

grant select,insert,update on hr_private.documents to service_role;
grant select,insert on hr_private.audit_events to service_role;
grant execute on function hr_private.reject_audit_mutation() to service_role;

insert into storage.buckets(id,name,public)
values('ceac-hr-private','ceac-hr-private',false)
on conflict(id) do update
set public=false;
