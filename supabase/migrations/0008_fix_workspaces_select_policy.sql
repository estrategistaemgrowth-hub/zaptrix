-- Zaptrix — corrige bug da 0001: a policy de SELECT em workspaces comparava
-- workspace_members.workspace_id com workspace_members.id (mesma tabela, sempre falso)
-- ao invés de comparar com workspaces.id (a tabela externa). Isso não só impedia
-- o SELECT direto de workspaces como também derrubava qualquer INSERT/UPDATE que
-- peça `.select()` — o RETURNING implícito é avaliado pela policy de SELECT.
-- 2026-09-09

DROP POLICY IF EXISTS "Users can view their workspace" ON workspaces;

CREATE POLICY "Users can view their workspace"
  ON workspaces FOR SELECT
  USING (
    is_platform_admin() OR
    EXISTS (SELECT 1 FROM workspace_members WHERE workspace_members.workspace_id = workspaces.id AND workspace_members.user_id = auth.uid())
  );
