-- Zaptrix — mesmo problema do RETURNING: o usuário precisa poder ver sua
-- própria linha de membership mesmo antes de "is_workspace_member" enxergar
-- outras linhas (ela é a primeira sendo criada no bootstrap).
-- 2026-09-09

DROP POLICY IF EXISTS "Users can view members of their workspace" ON workspace_members;

CREATE POLICY "Users can view members of their workspace"
  ON workspace_members FOR SELECT
  USING (
    user_id = auth.uid() OR
    is_workspace_member(workspace_id) OR
    is_platform_admin()
  );
