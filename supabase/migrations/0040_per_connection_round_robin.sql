-- Zaptrix — roleta de atendimento por número, não mais global do workspace.
-- 2026-09-10
--
-- checkHumanHandoff() (app/api/webhooks/whatsapp/route.ts) usava
-- workspaces.last_assigned_member_id como ponteiro único do rodízio — com
-- mais de 1 número de WhatsApp fazendo handoff ao mesmo tempo, os dois
-- disputavam a mesma fila (round-robin injusto/imprevisível entre agentes
-- diferentes). Cada conexão agora tem seu próprio ponteiro.

ALTER TABLE whatsapp_connections
  ADD COLUMN IF NOT EXISTS last_assigned_member_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN whatsapp_connections.last_assigned_member_id IS 'Ponteiro do rodízio de atendimento (roleta) deste número especificamente — cada conexão tem sua própria fila, não compartilha com as outras.';
