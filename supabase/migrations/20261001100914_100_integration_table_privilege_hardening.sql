-- 100 — Stage 17 production hardening for Integration Gateway table privileges.
-- RLS protects row visibility, but TRUNCATE bypasses RLS entirely. Browser roles
-- must therefore retain SELECT only on authorised integration metadata tables.

revoke all on table
  public.integration_connectors,
  public.integration_subscriptions,
  public.integration_outbox,
  public.integration_provider_definitions,
  public.integration_connection_events,
  public.integration_delivery_attempts,
  public.integration_inbound_events
from anon, authenticated;

grant select on table
  public.integration_connectors,
  public.integration_subscriptions,
  public.integration_outbox,
  public.integration_provider_definitions,
  public.integration_connection_events,
  public.integration_delivery_attempts,
  public.integration_inbound_events
to authenticated;
