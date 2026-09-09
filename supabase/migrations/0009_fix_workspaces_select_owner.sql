-- Zaptrix — o owner_user_id sempre pode ver o próprio workspace, mesmo antes
-- de existir a linha em workspace_members (necessário para o RETURNING do
-- INSERT inicial funcionar, já que workspace_member é criado em uma segunda
-- chamada separada, logo depois).
-- 2026-09-09

DROP POLICY IF EXISTS "Users can view their workspace" ON workspaces;

CREATE POLICY "Users can view their workspace"
  ON workspaces FOR SELECT
  USING (
    is_platform_admin() OR
    owner_user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM workspace_members WHERE workspace_members.workspace_id = workspaces.id AND workspace_members.user_id = auth.uid())
  );
