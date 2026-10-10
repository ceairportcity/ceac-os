-- 099 — Stage 12: secure provider connections and integration runtime.
-- Extends Stage 1G. Provider secrets remain in Supabase Vault and are never
-- browser-readable. First provider definition: Telegram outbound notifications.

create extension if not exists supabase_vault with schema vault;
create extension if not exists pg_net with schema extensions;

create table public.integration_provider_definitions(
  provider_key text primary key,
  display_name text not null,
  description text not null,
  auth_kind text not null check(auth_kind in ('bot_token','oauth2','api_key','webhook_secret')),
  supported_capabilities text[] not null default '{}',
  supported_scopes text[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.integration_provider_definitions(
  provider_key,display_name,description,auth_kind,supported_capabilities,supported_scopes
) values (
  'telegram',
  'Telegram',
  'Send privacy-safe CEAC OS notifications to an approved Telegram chat.',
  'bot_token',
  array['send_notification']::text[],
  array['send_messages']::text[]
)
on conflict(provider_key) do update
set display_name=excluded.display_name,
    description=excluded.description,
    auth_kind=excluded.auth_kind,
    supported_capabilities=excluded.supported_capabilities,
    supported_scopes=excluded.supported_scopes,
    active=true;

alter table public.integration_connectors
  add column provider_key text,
  add column connection_state text not null default 'not_connected',
  add column connected_account_label text,
  add column connected_account_identifier text,
  add column granted_scopes text[] not null default '{}',
  add column advertised_capabilities text[] not null default '{}',
  add column connected_at timestamptz,
  add column disconnected_at timestamptz,
  add column state_changed_at timestamptz not null default now(),
  add column state_changed_by uuid references public.profiles(id) on delete restrict,
  add column last_health_at timestamptz,
  add column last_success_at timestamptz,
  add column last_error_category text,
  add column last_error_message text;

update public.integration_connectors
set provider_key=connector_key
where provider_key is null;

alter table public.integration_connectors
  alter column provider_key set not null,
  add constraint integration_connectors_state_check
    check(connection_state in (
      'not_connected','connecting','connected','needs_reconnect',
      'disabled','revoked','error'
    )),
  add constraint integration_connectors_error_message_check
    check(last_error_message is null or length(last_error_message)<=500);

create index integration_connectors_provider_state_idx
  on public.integration_connectors(org_id,provider_key,connection_state);

create table public.integration_connection_events(
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete restrict,
  connector_id uuid not null references public.integration_connectors(id) on delete restrict,
  provider_key text not null,
  action text not null,
  from_state text,
  to_state text not null,
  safe_detail text,
  error_category text,
  actor_id uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  check(from_state is null or from_state in (
    'not_connected','connecting','connected','needs_reconnect',
    'disabled','revoked','error'
  )),
  check(to_state in (
    'not_connected','connecting','connected','needs_reconnect',
    'disabled','revoked','error'
  )),
  check(safe_detail is null or length(safe_detail)<=800)
);

create index integration_connection_events_connector_idx
  on public.integration_connection_events(connector_id,created_at desc);

create table public.integration_delivery_attempts(
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete restrict,
  outbox_id uuid not null references public.integration_outbox(id) on delete restrict,
  connector_id uuid not null references public.integration_connectors(id) on delete restrict,
  attempt_number integer not null check(attempt_number>0),
  outcome text not null check(outcome in ('processing','delivered','retry','terminal_failure')),
  provider_status_code integer,
  error_category text,
  safe_message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  unique(outbox_id,attempt_number),
  check(safe_message is null or length(safe_message)<=800)
);

create index integration_delivery_attempts_connector_idx
  on public.integration_delivery_attempts(connector_id,started_at desc);

create table public.integration_inbound_events(
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete restrict,
  connector_id uuid not null references public.integration_connectors(id) on delete restrict,
  provider_key text not null,
  provider_event_id text not null,
  event_kind text not null,
  state text not null check(state in ('accepted','rejected')),
  safe_payload jsonb not null default '{}'::jsonb check(jsonb_typeof(safe_payload)='object'),
  reject_reason text,
  received_at timestamptz not null default now(),
  unique(org_id,provider_key,provider_event_id),
  check(reject_reason is null or length(reject_reason)<=800)
);

create index integration_inbound_events_connector_idx
  on public.integration_inbound_events(connector_id,received_at desc);

alter table public.integration_provider_definitions enable row level security;
alter table public.integration_connection_events enable row level security;
alter table public.integration_delivery_attempts enable row level security;
alter table public.integration_inbound_events enable row level security;

revoke all on public.integration_provider_definitions from anon;
revoke all on public.integration_connection_events from anon;
revoke all on public.integration_delivery_attempts from anon;
revoke all on public.integration_inbound_events from anon;

revoke insert,update,delete on public.integration_provider_definitions from authenticated;
revoke insert,update,delete on public.integration_connection_events from authenticated;
revoke insert,update,delete on public.integration_delivery_attempts from authenticated;
revoke insert,update,delete on public.integration_inbound_events from authenticated;

grant select on public.integration_provider_definitions to authenticated;
grant select on public.integration_connection_events to authenticated;
grant select on public.integration_delivery_attempts to authenticated;
grant select on public.integration_inbound_events to authenticated;

create policy integration_provider_definitions_read
on public.integration_provider_definitions
for select to authenticated
using(public.app_has_capability('integration.manage',null));

create policy integration_connection_events_read
on public.integration_connection_events
for select to authenticated
using(
  org_id=public.app_org_id()
  and public.app_has_capability('integration.manage',null)
);

create policy integration_delivery_attempts_read
on public.integration_delivery_attempts
for select to authenticated
using(
  org_id=public.app_org_id()
  and public.app_has_capability('integration.manage',null)
);

create policy integration_inbound_events_read
on public.integration_inbound_events
for select to authenticated
using(
  org_id=public.app_org_id()
  and public.app_has_capability('integration.manage',null)
);

-- Stage 12 hardens the Stage 1G configuration surface. Browser roles can read
-- authorised metadata but no longer write connectors/subscriptions directly.
revoke insert,update,delete on public.integration_connectors from authenticated;
revoke insert,update,delete on public.integration_subscriptions from authenticated;

drop policy if exists integration_connectors_insert on public.integration_connectors;
drop policy if exists integration_connectors_update on public.integration_connectors;
drop policy if exists integration_subscriptions_insert on public.integration_subscriptions;
drop policy if exists integration_subscriptions_update on public.integration_subscriptions;

create schema if not exists integration_private;
revoke all on schema integration_private from public,anon,authenticated;
revoke all on all tables in schema integration_private from public,anon,authenticated;
revoke all on all functions in schema integration_private from public,anon,authenticated;

create table integration_private.credential_refs(
  connector_id uuid primary key references public.integration_connectors(id) on delete cascade,
  org_id uuid not null references public.organisations(id) on delete restrict,
  provider_key text not null,
  secret_kind text not null,
  vault_secret_id uuid not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

revoke all on integration_private.credential_refs from public,anon,authenticated;

insert into public.platform_event_definitions(
  event_type,label,description,source_domain,payload_version
) values
  ('integration.connected','Integration connected','An external provider connection became usable.','integration',1),
  ('integration.reconnect_required','Integration reconnect required','An external provider connection requires administrator attention.','integration',1),
  ('integration.disconnected','Integration disconnected','An external provider connection was revoked or disconnected.','integration',1),
  ('integration.delivery_failed','Integration delivery failed','A provider delivery reached a terminal failure.','integration',1)
on conflict(event_type) do nothing;

create or replace function public.integration_service_upsert_connector(
  p_org_id uuid,
  p_provider_key text,
  p_display_name text,
  p_public_config jsonb,
  p_actor_id uuid
)
returns uuid
language plpgsql
security definer
set search_path=public,vault,integration_private
as $$
declare
  v_id uuid;
begin
  if not exists(
    select 1 from public.organisations o where o.id=p_org_id
  ) then raise exception 'Organisation not found.'; end if;

  if not exists(
    select 1 from public.profiles p
    where p.id=p_actor_id and p.org_id=p_org_id and p.active
  ) then raise exception 'Actor is not active in that organisation.'; end if;

  if not exists(
    select 1 from public.integration_provider_definitions d
    where d.provider_key=p_provider_key and d.active
  ) then raise exception 'Provider is not enabled in CEAC OS.'; end if;

  if jsonb_typeof(coalesce(p_public_config,'{}'::jsonb))<>'object' then
    raise exception 'Public integration configuration must be an object.';
  end if;

  insert into public.integration_connectors(
    org_id,connector_key,connector_type,display_name,enabled,public_config,
    provider_key,connection_state,created_by,updated_by,state_changed_by
  ) values (
    p_org_id,p_provider_key,'custom',btrim(p_display_name),false,
    coalesce(p_public_config,'{}'::jsonb),p_provider_key,'not_connected',
    p_actor_id,p_actor_id,p_actor_id
  )
  on conflict(org_id,connector_key) do update
  set display_name=excluded.display_name,
      public_config=excluded.public_config,
      provider_key=excluded.provider_key,
      updated_by=p_actor_id,
      updated_at=now()
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.integration_service_upsert_connector(uuid,text,text,jsonb,uuid)
  from public,anon,authenticated;
grant execute on function public.integration_service_upsert_connector(uuid,text,text,jsonb,uuid)
  to service_role;

create or replace function public.integration_service_store_secret(
  p_connector_id uuid,
  p_provider_key text,
  p_secret text,
  p_secret_kind text
)
returns uuid
language plpgsql
security definer
set search_path=public,vault,integration_private
as $$
declare
  v_connector public.integration_connectors;
  v_existing integration_private.credential_refs;
  v_secret_id uuid;
  v_name text;
begin
  if length(coalesce(p_secret,''))<8 then
    raise exception 'Provider credential is invalid.';
  end if;

  select * into v_connector
  from public.integration_connectors
  where id=p_connector_id;

  if v_connector.id is null or v_connector.provider_key<>p_provider_key then
    raise exception 'Connector/provider mismatch.';
  end if;

  v_name:='ceac:integration:'||p_connector_id::text||':'||p_secret_kind;

  select * into v_existing
  from integration_private.credential_refs
  where connector_id=p_connector_id
  for update;

  if v_existing.connector_id is null then
    select vault.create_secret(
      p_secret,v_name,'CEAC Stage 12 provider credential',null
    ) into v_secret_id;

    insert into integration_private.credential_refs(
      connector_id,org_id,provider_key,secret_kind,vault_secret_id
    ) values (
      p_connector_id,v_connector.org_id,p_provider_key,p_secret_kind,v_secret_id
    );
  else
    v_secret_id:=v_existing.vault_secret_id;
    perform vault.update_secret(
      v_secret_id,p_secret,v_name,'CEAC Stage 12 provider credential',null
    );
    update integration_private.credential_refs
    set provider_key=p_provider_key,
        secret_kind=p_secret_kind,
        updated_at=now()
    where connector_id=p_connector_id;
  end if;

  return v_secret_id;
end;
$$;

revoke all on function public.integration_service_store_secret(uuid,text,text,text)
  from public,anon,authenticated;
grant execute on function public.integration_service_store_secret(uuid,text,text,text)
  to service_role;

create or replace function public.integration_service_read_secret(
  p_connector_id uuid
)
returns text
language sql
security definer
set search_path=public,vault,integration_private
as $$
  select ds.decrypted_secret
  from integration_private.credential_refs cr
  join vault.decrypted_secrets ds on ds.id=cr.vault_secret_id
  where cr.connector_id=p_connector_id
  limit 1;
$$;

revoke all on function public.integration_service_read_secret(uuid)
  from public,anon,authenticated;
grant execute on function public.integration_service_read_secret(uuid)
  to service_role;

create or replace function public.integration_service_delete_secret(
  p_connector_id uuid
)
returns void
language plpgsql
security definer
set search_path=public,vault,integration_private
as $$
declare v_secret_id uuid;
begin
  select vault_secret_id into v_secret_id
  from integration_private.credential_refs
  where connector_id=p_connector_id
  for update;

  delete from integration_private.credential_refs
  where connector_id=p_connector_id;

  if v_secret_id is not null then
    delete from vault.secrets where id=v_secret_id;
  end if;
end;
$$;

revoke all on function public.integration_service_delete_secret(uuid)
  from public,anon,authenticated;
grant execute on function public.integration_service_delete_secret(uuid)
  to service_role;

create or replace function public.integration_service_transition_connection(
  p_connector_id uuid,
  p_to_state text,
  p_action text,
  p_actor_id uuid,
  p_account_label text default null,
  p_account_identifier text default null,
  p_scopes text[] default '{}',
  p_capabilities text[] default '{}',
  p_error_category text default null,
  p_safe_detail text default null
)
returns void
language plpgsql
security definer
set search_path=public,vault,integration_private
as $$
declare
  v_connector public.integration_connectors;
  v_provider public.integration_provider_definitions;
  v_allowed boolean:=false;
  v_event_type text;
begin
  select * into v_connector
  from public.integration_connectors
  where id=p_connector_id
  for update;
  if v_connector.id is null then raise exception 'Connector not found.'; end if;

  select * into v_provider
  from public.integration_provider_definitions
  where provider_key=v_connector.provider_key and active;
  if v_provider.provider_key is null then raise exception 'Provider is not active.'; end if;

  if p_actor_id is not null and not exists(
    select 1 from public.profiles p
    where p.id=p_actor_id and p.org_id=v_connector.org_id and p.active
  ) then raise exception 'Actor is not active in the connector organisation.'; end if;

  if p_to_state not in (
    'not_connected','connecting','connected','needs_reconnect',
    'disabled','revoked','error'
  ) then raise exception 'Unsupported integration connection state.'; end if;

  v_allowed:=case v_connector.connection_state
    when 'not_connected' then p_to_state in ('connecting','revoked')
    when 'connecting' then p_to_state in ('connected','error','needs_reconnect','not_connected','revoked')
    when 'connected' then p_to_state in ('connected','needs_reconnect','disabled','revoked','error')
    when 'needs_reconnect' then p_to_state in ('connecting','connected','disabled','revoked','error')
    when 'disabled' then p_to_state in ('connecting','connected','revoked')
    when 'revoked' then p_to_state in ('connecting')
    when 'error' then p_to_state in ('connecting','needs_reconnect','disabled','revoked')
    else false
  end;

  if not v_allowed then
    raise exception 'Invalid integration connection-state transition.';
  end if;

  if not coalesce(p_capabilities,'{}'::text[]) <@ v_provider.supported_capabilities then
    raise exception 'Provider capability set exceeds the approved provider definition.';
  end if;
  if not coalesce(p_scopes,'{}'::text[]) <@ v_provider.supported_scopes then
    raise exception 'Provider scope set exceeds the approved provider definition.';
  end if;
  if p_to_state='connected' and cardinality(coalesce(p_capabilities,'{}'::text[]))=0 then
    raise exception 'Connected providers must advertise at least one verified capability.';
  end if;

  update public.integration_connectors
  set connection_state=p_to_state,
      enabled=(p_to_state='connected'),
      connected_account_label=case
        when p_to_state='connected' then nullif(btrim(coalesce(p_account_label,'')),'')
        when p_to_state in ('revoked','not_connected') then null
        else connected_account_label
      end,
      connected_account_identifier=case
        when p_to_state='connected' then nullif(btrim(coalesce(p_account_identifier,'')),'')
        when p_to_state in ('revoked','not_connected') then null
        else connected_account_identifier
      end,
      granted_scopes=case when p_to_state='connected' then coalesce(p_scopes,'{}') else granted_scopes end,
      advertised_capabilities=case when p_to_state='connected' then coalesce(p_capabilities,'{}') else advertised_capabilities end,
      connected_at=case when p_to_state='connected' then coalesce(connected_at,now()) else connected_at end,
      disconnected_at=case when p_to_state in ('revoked','disabled') then now() else disconnected_at end,
      state_changed_at=now(),
      state_changed_by=p_actor_id,
      last_health_at=case when p_to_state='connected' then now() else last_health_at end,
      last_error_category=case when p_to_state='connected' then null else nullif(btrim(coalesce(p_error_category,'')),'') end,
      last_error_message=case
        when p_to_state='connected' then null
        else left(nullif(btrim(coalesce(p_safe_detail,'')),''),500)
      end,
      updated_by=coalesce(p_actor_id,updated_by),
      updated_at=now()
  where id=v_connector.id;

  insert into public.integration_connection_events(
    org_id,connector_id,provider_key,action,from_state,to_state,
    safe_detail,error_category,actor_id
  ) values (
    v_connector.org_id,v_connector.id,v_connector.provider_key,
    btrim(p_action),v_connector.connection_state,p_to_state,
    left(nullif(btrim(coalesce(p_safe_detail,'')),''),800),
    nullif(btrim(coalesce(p_error_category,'')),''),
    p_actor_id
  );

  v_event_type:=case
    when p_to_state='connected' and v_connector.connection_state<>'connected' then 'integration.connected'
    when p_to_state='needs_reconnect' then 'integration.reconnect_required'
    when p_to_state='revoked' then 'integration.disconnected'
    else null
  end;

  if v_event_type is not null then
    perform public.platform_emit_event(
      v_connector.org_id,v_event_type,p_actor_id,null,
      'integration_connector',v_connector.id,
      jsonb_build_object(
        'provider_key',v_connector.provider_key,
        'connection_state',p_to_state
      ),
      'integration-state:'||v_connector.id::text||':'||p_to_state||':'||extract(epoch from clock_timestamp())::text,
      null,null,now()
    );
  end if;
end;
$$;

revoke all on function public.integration_service_transition_connection(
  uuid,text,text,uuid,text,text,text[],text[],text,text
) from public,anon,authenticated;
grant execute on function public.integration_service_transition_connection(
  uuid,text,text,uuid,text,text,text[],text[],text,text
) to service_role;

create or replace function public.integration_service_set_subscription(
  p_connector_id uuid,
  p_event_type text,
  p_active boolean,
  p_actor_id uuid
)
returns uuid
language plpgsql
security definer
set search_path=public,vault,integration_private
as $$
declare
  v_connector public.integration_connectors;
  v_id uuid;
begin
  select * into v_connector
  from public.integration_connectors
  where id=p_connector_id;
  if v_connector.id is null then raise exception 'Connector not found.'; end if;
  if not exists(
    select 1 from public.profiles p
    where p.id=p_actor_id and p.org_id=v_connector.org_id and p.active
  ) then raise exception 'Actor is not active in that organisation.'; end if;
  if not exists(
    select 1 from public.platform_event_definitions d
    where d.event_type=p_event_type and d.active
  ) then raise exception 'Choose an active CEAC event type.'; end if;

  insert into public.integration_subscriptions(
    org_id,connector_id,event_type,active,created_by,updated_by
  ) values (
    v_connector.org_id,v_connector.id,p_event_type,p_active,p_actor_id,p_actor_id
  )
  on conflict(connector_id,event_type) do update
  set active=excluded.active,
      updated_by=p_actor_id,
      updated_at=now()
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.integration_service_set_subscription(uuid,text,boolean,uuid)
  from public,anon,authenticated;
grant execute on function public.integration_service_set_subscription(uuid,text,boolean,uuid)
  to service_role;

create or replace function public.integration_service_claim_outbox(
  p_limit integer default 10
)
returns table(
  attempt_id uuid,
  outbox_id uuid,
  connector_id uuid,
  event_id uuid,
  provider_key text,
  event_type text,
  event_label text,
  occurred_at timestamptz,
  public_config jsonb,
  attempt_number integer
)
language plpgsql
security definer
set search_path=public,vault,integration_private
as $$
declare v_row record;
begin
  for v_row in
    select
      o.id as outbox_id,
      o.connector_id,
      o.event_id,
      o.attempt_count,
      c.provider_key,
      c.public_config,
      e.event_type,
      d.label as event_label,
      e.occurred_at
    from public.integration_outbox o
    join public.integration_connectors c on c.id=o.connector_id
    join public.integration_subscriptions s on s.id=o.subscription_id
    join public.platform_events e on e.id=o.event_id
    join public.platform_event_definitions d on d.event_type=e.event_type
    where c.connection_state='connected'
      and c.enabled
      and s.active
      and (
        o.state='pending'
        or (o.state='failed' and o.next_attempt_at is not null and o.next_attempt_at<=now())
        or (o.state='processing' and o.updated_at<now()-interval '10 minutes')
      )
    order by o.queued_at
    for update of o skip locked
    limit greatest(1,least(coalesce(p_limit,10),50))
  loop
    update public.integration_outbox
    set state='processing',
        attempt_count=v_row.attempt_count+1,
        next_attempt_at=null,
        updated_at=now()
    where id=v_row.outbox_id;

    insert into public.integration_delivery_attempts(
      org_id,outbox_id,connector_id,attempt_number,outcome
    )
    select o.org_id,o.id,o.connector_id,o.attempt_count,'processing'
    from public.integration_outbox o
    where o.id=v_row.outbox_id
    returning id into attempt_id;

    outbox_id:=v_row.outbox_id;
    connector_id:=v_row.connector_id;
    event_id:=v_row.event_id;
    provider_key:=v_row.provider_key;
    event_type:=v_row.event_type;
    event_label:=v_row.event_label;
    occurred_at:=v_row.occurred_at;
    public_config:=v_row.public_config;
    attempt_number:=v_row.attempt_count+1;
    return next;
  end loop;
end;
$$;

revoke all on function public.integration_service_claim_outbox(integer)
  from public,anon,authenticated;
grant execute on function public.integration_service_claim_outbox(integer)
  to service_role;

create or replace function public.integration_service_finish_delivery(
  p_attempt_id uuid,
  p_outbox_id uuid,
  p_success boolean,
  p_retryable boolean,
  p_provider_status_code integer,
  p_error_category text,
  p_safe_message text
)
returns void
language plpgsql
security definer
set search_path=public,vault,integration_private
as $$
declare
  v_outbox public.integration_outbox;
  v_connector public.integration_connectors;
  v_terminal boolean;
  v_next timestamptz;
begin
  select * into v_outbox
  from public.integration_outbox
  where id=p_outbox_id
  for update;
  if v_outbox.id is null then raise exception 'Outbox item not found.'; end if;

  if not exists(
    select 1 from public.integration_delivery_attempts a
    where a.id=p_attempt_id
      and a.outbox_id=v_outbox.id
      and a.outcome='processing'
  ) then raise exception 'Delivery attempt is not active for that outbox item.'; end if;

  select * into v_connector
  from public.integration_connectors
  where id=v_outbox.connector_id
  for update;

  if p_success then
    update public.integration_delivery_attempts
    set outcome='delivered',
        provider_status_code=p_provider_status_code,
        error_category=null,
        safe_message=null,
        finished_at=now()
    where id=p_attempt_id;

    update public.integration_outbox
    set state='delivered',
        delivered_at=now(),
        next_attempt_at=null,
        last_error_category=null,
        last_error_message=null,
        updated_at=now()
    where id=v_outbox.id;

    update public.integration_connectors
    set last_health_at=now(),
        last_success_at=now(),
        last_error_category=null,
        last_error_message=null,
        updated_at=now()
    where id=v_connector.id;
    return;
  end if;

  v_terminal:=not coalesce(p_retryable,false) or v_outbox.attempt_count>=5;
  v_next:=case
    when v_terminal then null
    else now()+make_interval(mins=>least(60,(2^greatest(v_outbox.attempt_count,1))::integer))
  end;

  update public.integration_delivery_attempts
  set outcome=case when v_terminal then 'terminal_failure' else 'retry' end,
      provider_status_code=p_provider_status_code,
      error_category=nullif(btrim(coalesce(p_error_category,'')),''),
      safe_message=left(nullif(btrim(coalesce(p_safe_message,'')),''),800),
      finished_at=now()
  where id=p_attempt_id;

  update public.integration_outbox
  set state='failed',
      next_attempt_at=v_next,
      last_error_category=nullif(btrim(coalesce(p_error_category,'')),''),
      last_error_message=left(nullif(btrim(coalesce(p_safe_message,'')),''),500),
      updated_at=now()
  where id=v_outbox.id;

  update public.integration_connectors
  set last_health_at=now(),
      last_error_category=nullif(btrim(coalesce(p_error_category,'')),''),
      last_error_message=left(nullif(btrim(coalesce(p_safe_message,'')),''),500),
      updated_at=now()
  where id=v_connector.id;

  if p_error_category='auth' then
    perform public.integration_service_transition_connection(
      v_connector.id,'needs_reconnect','Provider authentication failed',null,
      null,null,v_connector.granted_scopes,v_connector.advertised_capabilities,
      'auth','Provider authentication was rejected.'
    );
  elsif v_terminal then
    perform public.platform_emit_event(
      v_outbox.org_id,'integration.delivery_failed',null,null,
      'integration_outbox',v_outbox.id,
      jsonb_build_object(
        'connector_id',v_outbox.connector_id,
        'error_category',nullif(btrim(coalesce(p_error_category,'')),'')
      ),
      'integration-terminal:'||v_outbox.id::text,null,null,now()
    );
  end if;
end;
$$;

revoke all on function public.integration_service_finish_delivery(
  uuid,uuid,boolean,boolean,integer,text,text
) from public,anon,authenticated;
grant execute on function public.integration_service_finish_delivery(
  uuid,uuid,boolean,boolean,integer,text,text
) to service_role;

create or replace function public.integration_service_record_inbound(
  p_connector_id uuid,
  p_provider_event_id text,
  p_event_kind text,
  p_state text,
  p_safe_payload jsonb,
  p_reject_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path=public,vault,integration_private
as $$
declare
  v_connector public.integration_connectors;
  v_id uuid;
begin
  select * into v_connector
  from public.integration_connectors
  where id=p_connector_id;
  if v_connector.id is null then raise exception 'Connector not found.'; end if;

  if length(btrim(coalesce(p_provider_event_id,'')))<1
     or length(btrim(coalesce(p_event_kind,'')))<1 then
    raise exception 'Provider event identity and kind are required.';
  end if;

  if p_state not in ('accepted','rejected') then
    raise exception 'Unsupported inbound event state.';
  end if;

  if jsonb_typeof(coalesce(p_safe_payload,'{}'::jsonb))<>'object' then
    raise exception 'Inbound safe payload must be an object.';
  end if;

  if coalesce(p_safe_payload,'{}'::jsonb)::text ~* '"(secret|token|password|api[_ -]?key|apikey|private[_ -]?key|credential)[^"]*"\s*:' then
    raise exception 'Inbound safe payload contains secret-like fields.';
  end if;

  insert into public.integration_inbound_events(
    org_id,connector_id,provider_key,provider_event_id,event_kind,state,
    safe_payload,reject_reason
  ) values (
    v_connector.org_id,v_connector.id,v_connector.provider_key,
    btrim(p_provider_event_id),btrim(p_event_kind),p_state,
    coalesce(p_safe_payload,'{}'::jsonb),
    left(nullif(btrim(coalesce(p_reject_reason,'')),''),800)
  )
  on conflict(org_id,provider_key,provider_event_id) do update
  set provider_event_id=excluded.provider_event_id
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.integration_service_record_inbound(
  uuid,text,text,text,jsonb,text
) from public,anon,authenticated;
grant execute on function public.integration_service_record_inbound(
  uuid,text,text,text,jsonb,text
) to service_role;

do $worker_secret$
begin
  if not exists(
    select 1 from vault.secrets where name='ceac_integration_worker_key'
  ) then
    perform vault.create_secret(
      gen_random_uuid()::text||gen_random_uuid()::text,
      'ceac_integration_worker_key',
      'CEAC Stage 12 Edge Function worker authentication',
      null
    );
  end if;
end
$worker_secret$;

create or replace function public.integration_service_verify_worker_key(
  p_key text
)
returns boolean
language sql
security definer
set search_path=public,vault,integration_private
as $$
  select exists(
    select 1
    from vault.decrypted_secrets
    where name='ceac_integration_worker_key'
      and decrypted_secret=p_key
  );
$$;

revoke all on function public.integration_service_verify_worker_key(text)
  from public,anon,authenticated;
grant execute on function public.integration_service_verify_worker_key(text)
  to service_role;

-- Existing Stage 1G event enqueue now requires a verified connected state.
create or replace function public.integration_enqueue_event()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  insert into public.integration_outbox(
    org_id,connector_id,subscription_id,event_id,state,queued_at,updated_at
  )
  select
    new.org_id,
    s.connector_id,
    s.id,
    new.id,
    'pending',
    now(),
    now()
  from public.integration_subscriptions s
  join public.integration_connectors c on c.id=s.connector_id
  where s.org_id=new.org_id
    and s.event_type=new.event_type
    and s.active
    and c.enabled
    and c.connection_state='connected'
    and 'send_notification'=any(c.advertised_capabilities)
    and c.org_id=new.org_id
  on conflict(subscription_id,event_id) do nothing;

  return new;
end;
$$;

revoke all on function public.integration_enqueue_event() from public,anon,authenticated;

create trigger audit_integration_connection_events
after insert on public.integration_connection_events
for each row execute function public.platform_audit_capture('integration_connection_event','id','actor_id');

create trigger audit_integration_delivery_attempts
after insert or update on public.integration_delivery_attempts
for each row execute function public.platform_audit_capture('integration_delivery_attempt','id','');

create trigger audit_integration_inbound_events
after insert on public.integration_inbound_events
for each row execute function public.platform_audit_capture('integration_inbound_event','id','');
