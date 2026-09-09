-- Debug temporário
CREATE OR REPLACE FUNCTION debug_whoami()
RETURNS TABLE(uid uuid, role_name text)
LANGUAGE sql
STABLE
AS $$
  SELECT auth.uid(), current_setting('request.jwt.claim.role', true);
$$;
