-- Zaptrix — base de conhecimento por URL (ex: página de FAQ/política de
-- troca do site do próprio lojista), além da entrada manual de texto.
-- 2026-09-09

ALTER TABLE knowledge_entries
  ADD COLUMN IF NOT EXISTS source_url text,
  ADD COLUMN IF NOT EXISTS source_fetched_at timestamp with time zone;

COMMENT ON COLUMN knowledge_entries.source_url IS 'Se preenchido, o conteúdo veio de uma URL (ex: página do site do lojista) em vez de texto digitado manualmente — permite "Atualizar" pra buscar de novo.';
COMMENT ON COLUMN knowledge_entries.source_fetched_at IS 'Última vez que o conteúdo foi buscado da source_url.';
