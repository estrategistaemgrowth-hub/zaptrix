-- Remove funções de debug temporárias usadas para diagnosticar o bug de RLS
DROP FUNCTION IF EXISTS debug_list_policies(text);
DROP FUNCTION IF EXISTS debug_whoami();
DROP FUNCTION IF EXISTS debug_policy_check(uuid);
DROP FUNCTION IF EXISTS debug_full_policies(text);
