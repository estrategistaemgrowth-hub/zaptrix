-- Zaptrix — roleta de atendimento (round-robin) e gatilhos de handoff IA->humano.
-- 2026-09-09

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS idx_conversations_assigned_to ON conversations(assigned_to);

-- Reaproveita ai_profiles (já é a tabela de configuração de comportamento da
-- IA por workspace) em vez de criar uma tabela nova só para isto.
ALTER TABLE ai_profiles
  ADD COLUMN IF NOT EXISTS handoff_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS handoff_trigger_rules text;

-- Round-robin: guarda o último atendente escolhido, para o próximo handoff
-- pegar o próximo da fila em vez de sortear/repetir sempre o primeiro.
ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS last_assigned_member_id uuid REFERENCES auth.users(id);
