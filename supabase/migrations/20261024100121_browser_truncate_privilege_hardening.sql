-- TRUNCATE bypasses row-level security. Neither browser role uses it.
-- Preserve ordinary row/RPC permissions, policies, ownership and service access.
REVOKE TRUNCATE ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon, authenticated;

-- CEAC migrations run as postgres. Prevent the platform's schema defaults
-- from reintroducing this permission on future application-owned tables.
-- Provider-owned supabase_admin defaults require provider authority and are
-- intentionally not changed by this application migration.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE TRUNCATE ON TABLES FROM PUBLIC, anon, authenticated;
