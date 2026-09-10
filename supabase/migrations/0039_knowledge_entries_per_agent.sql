-- Zaptrix — Base de Conhecimento por agente (número de WhatsApp).
-- 2026-09-10
--
-- Mesmo padrão de ai_profiles.whatsapp_connection_id (0036): NULL significa
-- entrada "compartilhada", visível a todos os agentes do workspace. Toda
-- entrada já cadastrada vira compartilhada automaticamente (coluna nova
-- entra NULL por padrão) — workspace de 1 número só nunca muda de
-- comportamento. Sem índice único aqui: ao contrário de ai_profiles, um
-- agente pode ter quantas entradas específicas quiser.

ALTER TABLE knowledge_entries
  ADD COLUMN IF NOT EXISTS whatsapp_connection_id uuid REFERENCES whatsapp_connections(id) ON DELETE SET NULL;

COMMENT ON COLUMN knowledge_entries.whatsapp_connection_id IS 'Número de WhatsApp (agente) dono desta entrada — NULL é compartilhada com todos os agentes do workspace.';

CREATE INDEX IF NOT EXISTS idx_knowledge_entries_connection ON knowledge_entries(whatsapp_connection_id);
