-- Zaptrix — rastreia reabertura de conversa fechada/perdida/ganha quando o
-- mesmo cliente escreve de novo, em vez de criar um card duplicado.
-- 2026-09-09

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS reopened_count integer DEFAULT 0;
