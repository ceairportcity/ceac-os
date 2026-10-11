-- CEAC OS: authenticated-executable SECURITY DEFINER surface inventory.
-- Read-only heuristics ONLY: matching text is not proof of authorisation,
-- and a missing auth.uid() call is not proof of a vulnerability.
-- Review the definition and every transitive helper under synthetic roles.
SELECT
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS arguments,
  has_function_privilege('anon',p.oid,'EXECUTE') AS anon_can_execute,
  has_function_privilege('authenticated',p.oid,'EXECUTE') AS signed_in_can_execute,
  EXISTS (
    SELECT 1 FROM unnest(coalesce(p.proconfig,'{}'::text[])) AS config(setting)
    WHERE config.setting LIKE 'search_path=%'
  ) AS configured_search_path,
  position('auth.uid(' IN lower(pg_get_functiondef(p.oid)))>0 AS directly_mentions_auth_uid,
  (position('app_' IN lower(pg_get_functiondef(p.oid)))>0
    OR position('auth.role(' IN lower(pg_get_functiondef(p.oid)))>0) AS references_possible_authority_helpers
FROM pg_proc p
JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.prosecdef
  AND has_function_privilege('authenticated',p.oid,'EXECUTE')
ORDER BY directly_mentions_auth_uid ASC, function_name, arguments;
