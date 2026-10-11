-- 132 — Reproduce the production-safe execution ACL for the authority guard.
--
-- guard_last_authority() is a trigger-only SECURITY DEFINER function. The live
-- database already limits it to postgres/service_role, but canonical replay of
-- migrations 001-131 leaves the PostgreSQL default PUBLIC EXECUTE privilege in
-- place. Encode the safe live state so a clean rebuild cannot expose this
-- trigger entry point through PostgREST RPC.

REVOKE ALL ON FUNCTION public.guard_last_authority()
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.guard_last_authority()
  TO service_role;

COMMENT ON FUNCTION public.guard_last_authority() IS
  'Trigger-only last-authority invariant; direct browser execution is revoked.';
