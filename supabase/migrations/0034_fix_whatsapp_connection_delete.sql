-- Corrige a exclusão de conexão de WhatsApp que ficava travada.
-- 2026-09-10
--
-- conversations.whatsapp_connection_id e webhook_events.connection_id foram
-- criadas em 0001 SEM "ON DELETE" (default do Postgres = NO ACTION), então
-- qualquer conexão que já tenha recebido 1 mensagem ou 1 webhook (ou seja,
-- qualquer conexão já usada de verdade) bloqueia DELETE FROM whatsapp_connections
-- com violação de FK — o botão de lixeira em Configurações parecia "não fazer
-- nada" porque a API retornava erro e o frontend não mostrava o erro.
--
-- A migração 0033 tentou consertar isso pra conversations com
-- "ADD COLUMN IF NOT EXISTS ... ON DELETE SET NULL", mas a coluna já existia
-- desde 0001 — IF NOT EXISTS pulou o ADD COLUMN inteiro (constraint incluída),
-- então a correção nunca chegou a ser aplicada.
--
-- Aqui: localiza a constraint FK de verdade (nome pode variar) e recria com
-- ON DELETE SET NULL — deletar a conexão não apaga conversas nem o histórico
-- de webhooks, só desvincula do número removido.

DO $$
DECLARE
  v_constraint_name text;
BEGIN
  SELECT con.conname INTO v_constraint_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY(con.conkey)
  WHERE rel.relname = 'conversations'
    AND con.contype = 'f'
    AND att.attname = 'whatsapp_connection_id'
  LIMIT 1;

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE conversations DROP CONSTRAINT %I', v_constraint_name);
  END IF;

  ALTER TABLE conversations
    ADD CONSTRAINT conversations_whatsapp_connection_id_fkey
    FOREIGN KEY (whatsapp_connection_id) REFERENCES whatsapp_connections(id) ON DELETE SET NULL;
END $$;

DO $$
DECLARE
  v_constraint_name text;
BEGIN
  SELECT con.conname INTO v_constraint_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY(con.conkey)
  WHERE rel.relname = 'webhook_events'
    AND con.contype = 'f'
    AND att.attname = 'connection_id'
  LIMIT 1;

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE webhook_events DROP CONSTRAINT %I', v_constraint_name);
  END IF;

  ALTER TABLE webhook_events
    ADD CONSTRAINT webhook_events_connection_id_fkey
    FOREIGN KEY (connection_id) REFERENCES whatsapp_connections(id) ON DELETE SET NULL;
END $$;
