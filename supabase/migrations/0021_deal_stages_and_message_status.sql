-- Zaptrix — estágios de negócio no Kanban (funil de vendas: follow-up, ganho,
-- perdido) + tag "analisar conversa" para quando a IA não tem certeza do
-- desfecho, mais confirmação de entrega/leitura (ack) das mensagens enviadas.
-- 2026-09-09

-- ============================================================================
-- ENUM: conversation_status — estender além de 'open' | 'closed' | 'archived'
-- ============================================================================
-- ALTER TYPE ... ADD VALUE não pode ser usado na mesma transação em que o
-- valor novo é referenciado — por isso cada ADD VALUE fica isolado em seu
-- próprio statement, sem nenhuma outra instrução que use o enum na mesma
-- migration (mesma armadilha já resolvida em 0017_message_media.sql para o
-- enum message_type). 'closed' e 'archived' NÃO são removidos: continuam
-- existindo no enum, só deixam de ser colunas centrais do Kanban.

ALTER TYPE conversation_status ADD VALUE IF NOT EXISTS 'follow_up';
ALTER TYPE conversation_status ADD VALUE IF NOT EXISTS 'won';
ALTER TYPE conversation_status ADD VALUE IF NOT EXISTS 'lost';

-- ============================================================================
-- COLUNAS: conversations — tag "analisar conversa"
-- ============================================================================

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS needs_review boolean DEFAULT false;

COMMENT ON COLUMN conversations.needs_review IS 'true quando a IA não teve certeza se o negócio foi ganho/perdido (classificação INCERTO) — mostra a tag "Analisar conversa" no Kanban até um humano revisar (desmarcada automaticamente ao mover o card manualmente)';

-- ============================================================================
-- COLUNAS: messages — confirmação de entrega/leitura (ack do WhatsApp)
-- ============================================================================
-- external_message_id já existe desde 0001_create_zaptrix_schema.sql — não
-- recriado aqui, só documentado.

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS wa_status text DEFAULT 'sent';

COMMENT ON COLUMN messages.wa_status IS 'Status de entrega no WhatsApp da mensagem outbound: sent | delivered | read | failed. Atualizado via evento MESSAGES_UPDATE da Evolution API, casado pelo external_message_id.';
