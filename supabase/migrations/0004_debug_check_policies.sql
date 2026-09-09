-- Debug temporário: função para inspecionar policies aplicadas (será removida)
CREATE OR REPLACE FUNCTION debug_list_policies(tbl text)
RETURNS TABLE(policyname text, cmd text, qual text, with_check text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT policyname, cmd, qual, with_check
  FROM pg_policies
  WHERE tablename = tbl AND schemaname = 'public';
$$;
