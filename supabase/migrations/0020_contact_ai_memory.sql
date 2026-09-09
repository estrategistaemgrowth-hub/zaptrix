-- Zaptrix — memória de longo prazo da IA por contato (inspirado no conceito
-- do mem0, implementado nativamente: a própria IA resume o que aprendeu
-- sobre o cliente a cada resposta, sem depender de um serviço externo).
-- 2026-09-09

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS ai_memory text,
  ADD COLUMN IF NOT EXISTS ai_memory_updated_at timestamp with time zone;
