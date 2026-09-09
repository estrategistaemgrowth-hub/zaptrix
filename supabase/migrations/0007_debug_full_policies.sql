CREATE OR REPLACE FUNCTION debug_full_policies(tbl text)
RETURNS TABLE(policyname text, permissive text, roles name[], cmd text, qual text, with_check text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT policyname, permissive, roles, cmd, qual, with_check
  FROM pg_policies
  WHERE tablename = tbl AND schemaname = 'public';
$$;
