-- Zaptrix — correções da auditoria de segurança (Vibe Security Audit)
-- 2026-09-09
--
-- 1) bucket message-media deixa de ser público: hoje qualquer um com o path
--    (previsível: workspace_id/conversation_id/timestamp-arquivo) conseguia
--    ler foto/áudio/documento enviado por cliente final sem nenhuma checagem.
--    Vira privado + leitura só via signed URL, gerada no servidor no momento
--    do upload (mesmo padrão do bucket "invoices"). O envio pra Evolution API
--    nunca dependeu dessa URL pública — sendMediaMessage() já manda o base64
--    direto (ver lib/evolution-api.ts), então nada quebra no envio.
-- 2) tabela rate_limit_hits: contador simples em banco (funciona entre
--    instâncias serverless da Vercel, diferente de memória local) usado para
--    limitar /api/signup (por IP) e as chamadas de IA (por workspace).

UPDATE storage.buckets SET public = false WHERE id = 'message-media';

DROP POLICY IF EXISTS "Message media is publicly readable" ON storage.objects;

-- ============================================================================
-- TABELA: rate_limit_hits
-- ============================================================================

CREATE TABLE rate_limit_hits (
  id bigserial PRIMARY KEY,
  bucket text NOT NULL,
  identifier text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX rate_limit_hits_lookup_idx ON rate_limit_hits (bucket, identifier, created_at);

COMMENT ON TABLE rate_limit_hits IS 'Contador de rate limit (janela deslizante) — só acessado via service role (lib/rate-limit.ts), sem policy de RLS por design.';

ALTER TABLE rate_limit_hits ENABLE ROW LEVEL SECURITY;
-- Sem policies: nenhum client autenticado ou anônimo acessa direto, só o
-- service role (createAdminClient), mesmo padrão de webhook_events.
