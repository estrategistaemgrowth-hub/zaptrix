-- Zaptrix — permite que o perfil de IA use a Base de Conhecimento e o
-- catálogo de Produtos como contexto ao responder clientes no WhatsApp.
-- 2026-09-09

ALTER TABLE ai_profiles
  ADD COLUMN IF NOT EXISTS use_knowledge_base boolean DEFAULT true;
