-- Zaptrix — product_imports tinha RLS habilitado na 0001 mas nenhuma policy
-- foi criada, então toda operação era bloqueada por padrão.
-- 2026-09-09

CREATE POLICY "Workspace members can view imports"
  ON product_imports FOR SELECT
  USING (is_workspace_member(workspace_id));

CREATE POLICY "Owner/admin can create imports"
  ON product_imports FOR INSERT
  WITH CHECK (is_workspace_member(workspace_id, array['owner','admin']));

CREATE POLICY "Owner/admin can update imports"
  ON product_imports FOR UPDATE
  USING (is_workspace_member(workspace_id, array['owner','admin']))
  WITH CHECK (is_workspace_member(workspace_id, array['owner','admin']));

-- Mesmo problema nas demais tabelas: RLS habilitado na 0001 sem nenhuma
-- policy. Escritas nelas acontecem via service_role (webhook, engine de IA),
-- que já bypassa RLS — aqui só garantimos que o workspace consiga LER seus
-- próprios dados (knowledge_chunks e ai_runs para auditoria/depuração,
-- product_recommendations/product_clicks para métricas futuras no dashboard).

CREATE POLICY "Workspace members can view knowledge chunks"
  ON knowledge_chunks FOR SELECT
  USING (is_workspace_member(workspace_id));

CREATE POLICY "Workspace members can view ai runs"
  ON ai_runs FOR SELECT
  USING (is_workspace_member(workspace_id));

CREATE POLICY "Workspace members can view product recommendations"
  ON product_recommendations FOR SELECT
  USING (is_workspace_member(workspace_id));

CREATE POLICY "Workspace members can view product clicks"
  ON product_clicks FOR SELECT
  USING (is_workspace_member(workspace_id));

CREATE POLICY "Owner/admin can view webhook events"
  ON webhook_events FOR SELECT
  USING (is_workspace_member(workspace_id, array['owner','admin']));
