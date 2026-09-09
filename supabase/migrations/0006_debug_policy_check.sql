-- Debug temporário
CREATE OR REPLACE FUNCTION debug_policy_check(test_owner_id uuid)
RETURNS TABLE(uid uuid, matches boolean, is_admin boolean, rls_enabled boolean, forced boolean)
LANGUAGE sql
STABLE
AS $$
  SELECT
    auth.uid(),
    (test_owner_id = auth.uid()),
    is_platform_admin(),
    (SELECT relrowsecurity FROM pg_class WHERE relname = 'workspaces'),
    (SELECT relforcerowsecurity FROM pg_class WHERE relname = 'workspaces');
$$;
