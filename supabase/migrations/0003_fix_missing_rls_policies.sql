-- Zaptrix — Sprint 7: políticas RLS que faltavam na 0001
-- Sem estas, vários INSERTs falham silenciosamente (RLS bloqueia sem erro visível na UI):
--   - workspaces: não havia INSERT -> self-serve onboarding não conseguia criar workspace
--   - workspace_members: não havia INSERT -> ninguém conseguia se auto-vincular nem adicionar atendentes
--   - ai_profiles: não havia INSERT -> configuração de IA nunca salvava na primeira vez
-- 2026-09-09

-- workspaces: usuário pode criar seu próprio workspace (self-serve) ou platform admin cria para qualquer owner
CREATE POLICY "Users can create their own workspace"
  ON workspaces FOR INSERT
  WITH CHECK (owner_user_id = auth.uid() OR is_platform_admin());

-- workspaces: owner/admin do próprio workspace pode editar os dados da empresa (não só platform admin)
CREATE POLICY "Workspace owner/admin can update their workspace"
  ON workspaces FOR UPDATE
  USING (is_workspace_member(id, array['owner','admin']))
  WITH CHECK (is_workspace_member(id, array['owner','admin']));

-- workspace_members: usuário pode se auto-inserir como owner do workspace que ele acabou de criar
-- OU owner/admin existente pode adicionar novos membros (admin/atendente) ao workspace
-- OU platform admin pode inserir qualquer membership
CREATE POLICY "Users bootstrap own membership or owner/admin adds members"
  ON workspace_members FOR INSERT
  WITH CHECK (
    is_platform_admin()
    OR (
      user_id = auth.uid()
      AND role = 'owner'
      AND EXISTS (SELECT 1 FROM workspaces WHERE id = workspace_id AND owner_user_id = auth.uid())
    )
    OR is_workspace_member(workspace_id, array['owner','admin'])
  );

-- workspace_members: owner/admin pode remover membros (nunca remove a si mesmo se for o único owner — a UI já bloqueia remover 'owner')
CREATE POLICY "Owner/admin can remove members"
  ON workspace_members FOR DELETE
  USING (is_workspace_member(workspace_id, array['owner','admin']));

-- contacts: owner/admin/atendente podem remover contatos (limpeza de cadastro)
CREATE POLICY "Workspace members can delete contacts"
  ON contacts FOR DELETE
  USING (is_workspace_member(workspace_id));

-- conversations: workspace member pode criar conversa (ex: iniciar atendimento manual para um contato)
CREATE POLICY "Workspace members can create conversations"
  ON conversations FOR INSERT
  WITH CHECK (is_workspace_member(workspace_id));

-- knowledge_entries: owner/admin pode deletar entradas da base de conhecimento
CREATE POLICY "Owner/admin can delete knowledge"
  ON knowledge_entries FOR DELETE
  USING (is_workspace_member(workspace_id, array['owner','admin']));

-- ai_profiles: owner/admin pode criar o perfil de IA (faltava — só existia UPDATE)
CREATE POLICY "Owner/admin can create AI profile"
  ON ai_profiles FOR INSERT
  WITH CHECK (is_workspace_member(workspace_id, array['owner','admin']));

-- llm_credentials: owner/admin pode remover credenciais de LLM
CREATE POLICY "Owner/admin can delete credentials"
  ON llm_credentials FOR DELETE
  USING (is_workspace_member(workspace_id, array['owner','admin']));

-- whatsapp_connections: owner/admin pode remover conexões
CREATE POLICY "Owner/admin can delete connections"
  ON whatsapp_connections FOR DELETE
  USING (is_workspace_member(workspace_id, array['owner','admin']));
