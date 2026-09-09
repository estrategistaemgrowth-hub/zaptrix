-- Zaptrix — notas internas na conversa (nunca vazam para o WhatsApp do
-- cliente) + respostas rápidas (canned responses) reutilizáveis no composer.
-- 2026-09-09

-- ============================================================================
-- COLUNA: messages.is_internal_note
-- ============================================================================

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS is_internal_note boolean DEFAULT false;

COMMENT ON COLUMN messages.is_internal_note IS 'true quando a mensagem é uma nota interna do time (inserida direto na tabela, nunca enviada pela Evolution API) — visível só no painel, nunca no WhatsApp do cliente.';

-- ============================================================================
-- TABELA: quick_replies (respostas rápidas / canned responses)
-- ============================================================================

CREATE TABLE quick_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  shortcut text,
  title text NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

COMMENT ON TABLE quick_replies IS 'Respostas prontas (canned responses) que o atendente insere no composer do Atendimento com um clique — mesmo padrão do ícone de raio do Chatwoot/Jurix.';
COMMENT ON COLUMN quick_replies.shortcut IS 'Atalho curto opcional (ex: "/frete") — só exibido na lista, sem autocomplete implementado ainda.';

ALTER TABLE quick_replies ENABLE ROW LEVEL SECURITY;

-- Mesmo padrão de products/knowledge_entries (0001_create_zaptrix_schema.sql):
-- qualquer membro do workspace vê e usa; só owner/admin cria, edita e apaga.
CREATE POLICY "Workspace members can view quick replies"
  ON quick_replies FOR SELECT
  USING (is_workspace_member(workspace_id));

CREATE POLICY "Owner/admin can create quick replies"
  ON quick_replies FOR INSERT
  WITH CHECK (is_workspace_member(workspace_id, array['owner','admin']));

CREATE POLICY "Owner/admin can update quick replies"
  ON quick_replies FOR UPDATE
  USING (is_workspace_member(workspace_id, array['owner','admin']))
  WITH CHECK (is_workspace_member(workspace_id, array['owner','admin']));

CREATE POLICY "Owner/admin can delete quick replies"
  ON quick_replies FOR DELETE
  USING (is_workspace_member(workspace_id, array['owner','admin']));
