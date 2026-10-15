-- 095 — Experience Stage 5: reusable project participant/payment register.
-- A camp, conference or family service remains a project. The register is a
-- project capability, not a separate event module.
--
-- Money paid by a participant is append-only here. Remittance between CEAC
-- units remains the existing two-sided internal_transfers contract, now with an
-- optional project/evidence link. Slots can be allocated only when the
-- participant is fully paid. No public portal is introduced; source_kind /
-- source_ref are the import seam for a later external source.

create table public.project_register_people (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete restrict,
  project_id uuid not null references public.projects(id) on delete restrict,
  unit_id uuid not null references public.units(id) on delete restrict,
  profile_id uuid references public.profiles(id) on delete set null,
  display_name text not null check (nullif(btrim(display_name),'') is not null),
  contact_ref text,
  amount_due_minor bigint not null default 0 check (amount_due_minor >= 0),
  currency text not null default 'GHS'
    check (currency = any (array['GHS','USD','GBP','EUR','NGN','ZAR','CAD'])),
  source_kind text not null default 'manual'
    check (source_kind = any (array['manual','import','api'])),
  source_ref text,
  note text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_by uuid not null references public.profiles(id) on delete restrict,
  updated_at timestamptz not null default now()
);

create unique index project_register_people_profile_uidx
  on public.project_register_people(project_id,profile_id)
  where profile_id is not null;
create unique index project_register_people_source_uidx
  on public.project_register_people(org_id,project_id,source_kind,source_ref)
  where source_ref is not null;
create index project_register_people_project_idx
  on public.project_register_people(project_id,unit_id,display_name);

create table public.project_register_payments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete restrict,
  project_id uuid not null references public.projects(id) on delete restrict,
  register_person_id uuid not null references public.project_register_people(id) on delete restrict,
  unit_id uuid not null references public.units(id) on delete restrict,
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null
    check (currency = any (array['GHS','USD','GBP','EUR','NGN','ZAR','CAD'])),
  paid_on date not null default current_date,
  evidence_ref text,
  source_kind text not null default 'manual'
    check (source_kind = any (array['manual','import','api'])),
  source_ref text,
  reverses_id uuid references public.project_register_payments(id) on delete restrict,
  entered_by uuid not null references public.profiles(id) on delete restrict,
  entered_at timestamptz not null default now()
);

create unique index project_register_payments_source_uidx
  on public.project_register_payments(org_id,project_id,source_kind,source_ref)
  where source_ref is not null;
create unique index project_register_payments_reversal_uidx
  on public.project_register_payments(reverses_id)
  where reverses_id is not null;
create index project_register_payments_person_idx
  on public.project_register_payments(register_person_id,paid_on,entered_at);

create table public.project_register_custody_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete restrict,
  project_id uuid not null references public.projects(id) on delete restrict,
  register_person_id uuid not null references public.project_register_people(id) on delete restrict,
  stage text not null check (nullif(btrim(stage),'') is not null),
  custodian_unit_id uuid references public.units(id) on delete restrict,
  note text,
  occurred_at timestamptz not null default now(),
  source_kind text not null default 'manual'
    check (source_kind = any (array['manual','import','api'])),
  source_ref text,
  recorded_by uuid not null references public.profiles(id) on delete restrict,
  recorded_at timestamptz not null default now()
);

create unique index project_register_custody_source_uidx
  on public.project_register_custody_events(org_id,project_id,source_kind,source_ref)
  where source_ref is not null;
create index project_register_custody_person_idx
  on public.project_register_custody_events(register_person_id,occurred_at desc);

create table public.project_slot_types (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete restrict,
  project_id uuid not null references public.projects(id) on delete restrict,
  label text not null check (nullif(btrim(label),'') is not null),
  capacity integer not null check (capacity > 0),
  active boolean not null default true,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_by uuid not null references public.profiles(id) on delete restrict,
  updated_at timestamptz not null default now(),
  unique(project_id,label)
);

create index project_slot_types_project_idx
  on public.project_slot_types(project_id,active,label);

create table public.project_slot_allocations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete restrict,
  project_id uuid not null references public.projects(id) on delete restrict,
  register_person_id uuid not null references public.project_register_people(id) on delete restrict,
  slot_type_id uuid not null references public.project_slot_types(id) on delete restrict,
  allocated_by uuid not null references public.profiles(id) on delete restrict,
  allocated_at timestamptz not null default now(),
  released_by uuid references public.profiles(id) on delete restrict,
  released_at timestamptz,
  release_reason text,
  check (
    (released_at is null and released_by is null and release_reason is null)
    or
    (released_at is not null and released_by is not null and nullif(btrim(release_reason),'') is not null)
  )
);

create unique index project_slot_allocations_active_person_uidx
  on public.project_slot_allocations(register_person_id)
  where released_at is null;
create index project_slot_allocations_slot_idx
  on public.project_slot_allocations(slot_type_id,released_at);

alter table public.internal_transfers
  add column project_id uuid references public.projects(id) on delete restrict,
  add column evidence_ref text;

create index internal_transfers_project_idx
  on public.internal_transfers(project_id,sent_on,state)
  where project_id is not null;

-- A register row belongs to the project's lead/participating-unit structure.
create or replace function public.guard_project_register_person()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare v_org uuid;
begin
  select p.org_id into v_org from public.projects p where p.id=new.project_id;
  if v_org is null or v_org is distinct from new.org_id then
    raise exception 'Register project does not belong to this organisation.';
  end if;
  if not exists (
    select 1 from public.projects p
    where p.id=new.project_id and (
      p.lead_unit_id=new.unit_id
      or exists (
        select 1 from public.project_units pu
        where pu.project_id=p.id and pu.unit_id=new.unit_id
      )
    )
  ) then
    raise exception 'Register unit is not part of this project.';
  end if;
  if tg_op='UPDATE' then
    if new.id is distinct from old.id
       or new.org_id is distinct from old.org_id
       or new.project_id is distinct from old.project_id
       or new.unit_id is distinct from old.unit_id
       or new.currency is distinct from old.currency
       or new.created_by is distinct from old.created_by
       or new.created_at is distinct from old.created_at then
      raise exception 'Register identity and ownership are immutable.';
    end if;
    new.updated_at:=now();
  end if;
  return new;
end;
$$;
revoke all on function public.guard_project_register_person() from public,anon,authenticated;

create trigger project_register_people_guard
before insert or update on public.project_register_people
for each row execute function public.guard_project_register_person();

create or replace function public.guard_project_register_payment()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_person public.project_register_people;
  v_original public.project_register_payments;
begin
  select * into v_person
  from public.project_register_people
  where id=new.register_person_id;

  if v_person.id is null
     or v_person.org_id is distinct from new.org_id
     or v_person.project_id is distinct from new.project_id
     or v_person.unit_id is distinct from new.unit_id
     or v_person.currency is distinct from new.currency then
    raise exception 'Payment must match the participant project, unit and currency.';
  end if;

  if new.reverses_id is not null then
    select * into v_original
    from public.project_register_payments
    where id=new.reverses_id;
    if v_original.id is null
       or v_original.reverses_id is not null
       or v_original.register_person_id is distinct from new.register_person_id
       or v_original.project_id is distinct from new.project_id
       or v_original.unit_id is distinct from new.unit_id
       or v_original.currency is distinct from new.currency
       or v_original.amount_minor is distinct from new.amount_minor then
      raise exception 'A payment reversal must exactly reverse one original payment.';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.guard_project_register_payment() from public,anon,authenticated;

create trigger project_register_payments_guard
before insert on public.project_register_payments
for each row execute function public.guard_project_register_payment();

create or replace function public.guard_project_register_custody()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare v_person public.project_register_people;
begin
  select * into v_person
  from public.project_register_people
  where id=new.register_person_id;
  if v_person.id is null
     or v_person.org_id is distinct from new.org_id
     or v_person.project_id is distinct from new.project_id then
    raise exception 'Custody event must match the participant project.';
  end if;
  if new.custodian_unit_id is not null and not exists (
    select 1 from public.units u
    where u.id=new.custodian_unit_id and u.org_id=new.org_id
  ) then
    raise exception 'Custodian unit is outside this organisation.';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_project_register_custody() from public,anon,authenticated;

create trigger project_register_custody_guard
before insert on public.project_register_custody_events
for each row execute function public.guard_project_register_custody();

create or replace function public.guard_project_slot_type()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if not exists (
    select 1 from public.projects p
    where p.id=new.project_id and p.org_id=new.org_id
  ) then
    raise exception 'Slot type project does not belong to this organisation.';
  end if;
  if tg_op='UPDATE' then
    if new.id is distinct from old.id
       or new.org_id is distinct from old.org_id
       or new.project_id is distinct from old.project_id
       or new.created_by is distinct from old.created_by
       or new.created_at is distinct from old.created_at then
      raise exception 'Slot inventory identity is immutable.';
    end if;
    new.updated_at:=now();
  end if;
  return new;
end;
$$;
revoke all on function public.guard_project_slot_type() from public,anon,authenticated;

create trigger project_slot_types_guard
before insert or update on public.project_slot_types
for each row execute function public.guard_project_slot_type();

create or replace function public.guard_project_slot_allocation()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_person public.project_register_people;
  v_slot public.project_slot_types;
  v_paid bigint;
  v_active integer;
begin
  if tg_op='INSERT' then
    select * into v_person
    from public.project_register_people
    where id=new.register_person_id;

    select * into v_slot
    from public.project_slot_types
    where id=new.slot_type_id
    for update;

    if v_person.id is null
       or v_slot.id is null
       or not v_slot.active
       or v_person.org_id is distinct from new.org_id
       or v_person.project_id is distinct from new.project_id
       or v_slot.org_id is distinct from new.org_id
       or v_slot.project_id is distinct from new.project_id then
      raise exception 'Slot allocation must match an active slot type and participant in the same project.';
    end if;

    select coalesce(sum(case when p.reverses_id is null then p.amount_minor else -p.amount_minor end),0)::bigint
      into v_paid
    from public.project_register_payments p
    where p.register_person_id=new.register_person_id
      and p.currency=v_person.currency;

    if v_paid < v_person.amount_due_minor then
      raise exception 'Full payment is required before a slot can be allocated.';
    end if;

    select count(*) into v_active
    from public.project_slot_allocations a
    where a.slot_type_id=new.slot_type_id
      and a.released_at is null;

    if v_active >= v_slot.capacity then
      raise exception 'No slot remains in this inventory.';
    end if;
  else
    if new.id is distinct from old.id
       or new.org_id is distinct from old.org_id
       or new.project_id is distinct from old.project_id
       or new.register_person_id is distinct from old.register_person_id
       or new.slot_type_id is distinct from old.slot_type_id
       or new.allocated_by is distinct from old.allocated_by
       or new.allocated_at is distinct from old.allocated_at then
      raise exception 'Slot allocation identity is immutable.';
    end if;
    if old.released_at is not null then
      raise exception 'A released slot allocation is immutable.';
    end if;
    if new.released_at is null
       or new.released_by is null
       or nullif(btrim(coalesce(new.release_reason,'')),'') is null then
      raise exception 'Releasing a slot requires who, when and why.';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.guard_project_slot_allocation() from public,anon,authenticated;

create trigger project_slot_allocations_guard
before insert or update on public.project_slot_allocations
for each row execute function public.guard_project_slot_allocation();

-- Keep the original two-sided transfer facts immutable when a receiver confirms
-- or disputes a transfer. The new project/evidence links are sender facts too.
create or replace function public.guard_internal_transfer_response()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  if new.id is distinct from old.id
     or new.org_id is distinct from old.org_id
     or new.from_unit_id is distinct from old.from_unit_id
     or new.to_unit_id is distinct from old.to_unit_id
     or new.amount_minor is distinct from old.amount_minor
     or new.sent_on is distinct from old.sent_on
     or new.purpose is distinct from old.purpose
     or new.sent_by is distinct from old.sent_by
     or new.sent_at is distinct from old.sent_at
     or new.reverses_id is distinct from old.reverses_id
     or new.currency is distinct from old.currency
     or new.project_id is distinct from old.project_id
     or new.evidence_ref is distinct from old.evidence_ref then
    raise exception 'Confirming a transfer cannot rewrite its recorded facts.';
  end if;

  if old.state='confirmed' and new.state is distinct from old.state then
    raise exception 'A confirmed transfer is final; use a reversing transfer for correction.';
  end if;

  if auth.uid() is not null and new.state is distinct from old.state then
    if new.responded_by is distinct from auth.uid() or new.responded_at is null then
      raise exception 'Transfer responses must be attributable to the signed-in user.';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.guard_internal_transfer_response() from public,anon,authenticated;

drop trigger if exists internal_transfer_response_guard on public.internal_transfers;
create trigger internal_transfer_response_guard
before update on public.internal_transfers
for each row execute function public.guard_internal_transfer_response();

create or replace function public.guard_internal_transfer_project()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if new.project_id is not null then
    if not exists (
      select 1 from public.projects p
      where p.id=new.project_id and p.org_id=new.org_id
    ) then
      raise exception 'Transfer project is outside this organisation.';
    end if;
    if new.from_unit_id is null or not exists (
      select 1 from public.projects p
      where p.id=new.project_id
        and (
          p.lead_unit_id=new.from_unit_id
          or exists (
            select 1 from public.project_units pu
            where pu.project_id=p.id and pu.unit_id=new.from_unit_id
          )
        )
    ) then
      raise exception 'A project remittance must originate from a unit in that project.';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.guard_internal_transfer_project() from public,anon,authenticated;

create trigger internal_transfer_project_guard
before insert on public.internal_transfers
for each row execute function public.guard_internal_transfer_project();

-- One reusable authority predicate prevents policy subqueries from becoming
-- ambiguous: project authority, or the manager of a unit that actually belongs
-- to the project.
create or replace function public.app_can_manage_project_register(
  p_project_id uuid,
  p_unit_id uuid
)
returns boolean
language sql
stable
security invoker
set search_path=public
as $$
  select
    public.app_can_manage_delivery_project(p_project_id)
    or (
      p_unit_id in (select public.app_managed_units())
      and exists (
        select 1
        from public.projects p
        where p.id=p_project_id
          and p.org_id=public.app_org_id()
          and (
            p.lead_unit_id=p_unit_id
            or exists (
              select 1 from public.project_units pu
              where pu.project_id=p.id and pu.unit_id=p_unit_id
            )
          )
      )
    );
$$;
revoke all on function public.app_can_manage_project_register(uuid,uuid) from public,anon;
grant execute on function public.app_can_manage_project_register(uuid,uuid) to authenticated;

-- RLS: visible project readers see the register. Writes belong either to the
-- project authority or the manager of the participant's own project unit.
alter table public.project_register_people enable row level security;
alter table public.project_register_payments enable row level security;
alter table public.project_register_custody_events enable row level security;
alter table public.project_slot_types enable row level security;
alter table public.project_slot_allocations enable row level security;

revoke all on public.project_register_people from anon;
revoke all on public.project_register_payments from anon;
revoke all on public.project_register_custody_events from anon;
revoke all on public.project_slot_types from anon;
revoke all on public.project_slot_allocations from anon;

grant select,insert,update on public.project_register_people to authenticated;
grant select,insert on public.project_register_payments to authenticated;
grant select,insert on public.project_register_custody_events to authenticated;
grant select,insert,update on public.project_slot_types to authenticated;
grant select,insert,update on public.project_slot_allocations to authenticated;

create policy project_register_people_read
on public.project_register_people for select to authenticated
using (org_id=public.app_org_id() and project_id in (select public.app_visible_projects()));

create policy project_register_people_insert
on public.project_register_people for insert to authenticated
with check (
  org_id=public.app_org_id()
  and created_by=auth.uid()
  and updated_by=auth.uid()
  and public.app_can_manage_project_register(project_id,unit_id)
);

create policy project_register_people_update
on public.project_register_people for update to authenticated
using (
  org_id=public.app_org_id()
  and public.app_can_manage_project_register(project_id,unit_id)
)
with check (
  org_id=public.app_org_id()
  and updated_by=auth.uid()
  and public.app_can_manage_project_register(project_id,unit_id)
);

create policy project_register_payments_read
on public.project_register_payments for select to authenticated
using (org_id=public.app_org_id() and project_id in (select public.app_visible_projects()));

create policy project_register_payments_insert
on public.project_register_payments for insert to authenticated
with check (
  org_id=public.app_org_id()
  and entered_by=auth.uid()
  and exists (
    select 1 from public.project_register_people rp
    where rp.id=register_person_id
      and public.app_can_manage_project_register(rp.project_id,rp.unit_id)
  )
);

create policy project_register_custody_read
on public.project_register_custody_events for select to authenticated
using (org_id=public.app_org_id() and project_id in (select public.app_visible_projects()));

create policy project_register_custody_insert
on public.project_register_custody_events for insert to authenticated
with check (
  org_id=public.app_org_id()
  and recorded_by=auth.uid()
  and exists (
    select 1 from public.project_register_people rp
    where rp.id=register_person_id
      and public.app_can_manage_project_register(rp.project_id,rp.unit_id)
  )
);

create policy project_slot_types_read
on public.project_slot_types for select to authenticated
using (org_id=public.app_org_id() and project_id in (select public.app_visible_projects()));

create policy project_slot_types_insert
on public.project_slot_types for insert to authenticated
with check (
  org_id=public.app_org_id()
  and created_by=auth.uid()
  and updated_by=auth.uid()
  and public.app_can_manage_delivery_project(project_id)
);

create policy project_slot_types_update
on public.project_slot_types for update to authenticated
using (org_id=public.app_org_id() and public.app_can_manage_delivery_project(project_id))
with check (
  org_id=public.app_org_id()
  and updated_by=auth.uid()
  and public.app_can_manage_delivery_project(project_id)
);

create policy project_slot_allocations_read
on public.project_slot_allocations for select to authenticated
using (org_id=public.app_org_id() and project_id in (select public.app_visible_projects()));

create policy project_slot_allocations_insert
on public.project_slot_allocations for insert to authenticated
with check (
  org_id=public.app_org_id()
  and allocated_by=auth.uid()
  and exists (
    select 1 from public.project_register_people rp
    where rp.id=register_person_id
      and public.app_can_manage_project_register(rp.project_id,rp.unit_id)
  )
);

create policy project_slot_allocations_update
on public.project_slot_allocations for update to authenticated
using (
  org_id=public.app_org_id()
  and exists (
    select 1 from public.project_register_people rp
    where rp.id=register_person_id
      and public.app_can_manage_project_register(rp.project_id,rp.unit_id)
  )
)
with check (
  org_id=public.app_org_id()
  and released_by=auth.uid()
  and exists (
    select 1 from public.project_register_people rp
    where rp.id=register_person_id
      and public.app_can_manage_project_register(rp.project_id,rp.unit_id)
  )
);

-- Payment and custody ledgers are append-only. Slot allocations can only be
-- released; participant and slot inventory edits are guarded above.
revoke update,delete on public.project_register_payments from authenticated;
revoke update,delete on public.project_register_custody_events from authenticated;
revoke delete on public.project_register_people from authenticated;
revoke delete on public.project_slot_types from authenticated;
revoke delete on public.project_slot_allocations from authenticated;
