-- 114 — S2 SECURITY DEFINER direct-exposure reduction.
--
-- Live semantic audit on 2026-10-06 confirmed:
-- - app_can_write_operational_context is an implementation helper used by
--   browser-facing SECURITY DEFINER RPCs and does not need direct browser EXECUTE.
-- - cancel_ministry_event and link_work_items have no current application,
--   Edge Function, RLS-policy, database-function, or SQL-gate caller.
--
-- Keep the functions for dependency-safe compatibility/history, but remove
-- direct authenticated PostgREST execution. SECURITY DEFINER callers keep owner
-- execution, and service_role remains available for controlled operations.

revoke execute on function public.app_can_write_operational_context(text,uuid)
  from public, anon, authenticated;
revoke execute on function public.cancel_ministry_event(uuid,text)
  from public, anon, authenticated;
revoke execute on function public.link_work_items(uuid,uuid,text)
  from public, anon, authenticated;

grant execute on function public.app_can_write_operational_context(text,uuid)
  to service_role;
grant execute on function public.cancel_ministry_event(uuid,text)
  to service_role;
grant execute on function public.link_work_items(uuid,uuid,text)
  to service_role;
