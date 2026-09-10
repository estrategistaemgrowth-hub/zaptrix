-- Zaptrix — um agente de IA por número de WhatsApp (Construtor de Agente).
-- 2026-09-10
--
-- Até aqui ai_profiles tinha UNIQUE(workspace_id): 1 agente só por workspace,
-- não importava quantos números de WhatsApp o lojista tivesse. Agora que dá
-- pra contratar instâncias extras (0033/0035), faz sentido o lojista poder
-- configurar um agente diferente por número (ex: "Suporte" no número A,
-- "Vendas" no número B) — cada um com persona, tom, tópicos e regras
-- próprios.
--
-- whatsapp_connection_id NULL = agente "padrão" do workspace, usado quando um
-- número não tem agente próprio configurado (cobre 100% do caso de 1 número
-- só, sem mudar nada pro lojista que nunca vai mexer nisso).

ALTER TABLE ai_profiles DROP CONSTRAINT IF EXISTS ai_profiles_workspace_id_key;

ALTER TABLE ai_profiles
  ADD COLUMN IF NOT EXISTS whatsapp_connection_id uuid REFERENCES whatsapp_connections(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS label text;

COMMENT ON COLUMN ai_profiles.whatsapp_connection_id IS 'Número de WhatsApp que este agente atende — NULL é o agente padrão do workspace (fallback pra número sem agente próprio).';
COMMENT ON COLUMN ai_profiles.label IS 'Nome interno do agente pra identificar a aba (ex: "Suporte", "Vendas") — nunca aparece pro cliente final (isso é agent_name).';

-- No máximo 1 agente por número específico, e no máximo 1 agente padrão
-- (whatsapp_connection_id NULL) por workspace.
CREATE UNIQUE INDEX IF NOT EXISTS ai_profiles_workspace_connection_unique
  ON ai_profiles(workspace_id, whatsapp_connection_id)
  WHERE whatsapp_connection_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ai_profiles_workspace_default_unique
  ON ai_profiles(workspace_id)
  WHERE whatsapp_connection_id IS NULL;
