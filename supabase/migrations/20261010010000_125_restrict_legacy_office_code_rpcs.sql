-- Security hardening: retire authenticated execution on two superseded
-- Phase 6 office-code entry points. Their historical definitions and data
-- remain intact. The active attendance flow uses separately authorised RPCs.
-- This migration makes no change to existing function-count ceilings.
revoke execute on function public.attendance_create_office_code(uuid,integer) from public,anon,authenticated;
revoke execute on function public.attendance_verify_office_code(uuid,text) from public,anon,authenticated;
