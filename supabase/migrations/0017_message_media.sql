-- Zaptrix — suporte a mídia (imagem, áudio, vídeo, documento, figurinha) nas
-- mensagens do WhatsApp, nos dois sentidos, mais transcrição de áudio pra IA.
-- 2026-09-09

-- ============================================================================
-- ENUM: message_type — estender além de 'text'
-- ============================================================================
-- ALTER TYPE ... ADD VALUE não pode ser usado na mesma transação em que o
-- valor novo é referenciado — por isso cada ADD VALUE fica isolado em seu
-- próprio statement, sem nenhuma outra instrução que use o enum na mesma
-- migration (as colunas abaixo são apenas ADD COLUMN, não usam o enum).

ALTER TYPE message_type ADD VALUE IF NOT EXISTS 'image';
ALTER TYPE message_type ADD VALUE IF NOT EXISTS 'audio';
ALTER TYPE message_type ADD VALUE IF NOT EXISTS 'video';
ALTER TYPE message_type ADD VALUE IF NOT EXISTS 'document';
ALTER TYPE message_type ADD VALUE IF NOT EXISTS 'sticker';

-- ============================================================================
-- COLUNAS: messages — dados de mídia e transcrição
-- ============================================================================

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS media_url text,
  ADD COLUMN IF NOT EXISTS media_mime_type text,
  ADD COLUMN IF NOT EXISTS media_caption text,
  ADD COLUMN IF NOT EXISTS transcript text;

COMMENT ON COLUMN messages.media_url IS 'URL pública (Supabase Storage, bucket message-media) do arquivo de mídia enviado/recebido';
COMMENT ON COLUMN messages.media_mime_type IS 'MIME type do arquivo de mídia (ex: image/jpeg, audio/ogg)';
COMMENT ON COLUMN messages.media_caption IS 'Legenda enviada junto com a mídia (imagem/vídeo/documento)';
COMMENT ON COLUMN messages.transcript IS 'Texto transcrito de mensagem de áudio (via Groq/OpenAI Whisper), usado como contexto para a IA';

-- ============================================================================
-- STORAGE: bucket message-media
-- ============================================================================
-- Mesmo padrão de 0015_product_images_storage.sql: bucket público para
-- leitura (a Evolution API/WhatsApp precisa acessar a URL pra enviar ao
-- cliente), escrita restrita por pasta workspace_id.

INSERT INTO storage.buckets (id, name, public)
VALUES ('message-media', 'message-media', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Message media is publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'message-media');

CREATE POLICY "Workspace members can upload message media"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'message-media'
    AND is_workspace_member(((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "Workspace members can delete their message media"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'message-media'
    AND is_workspace_member(((storage.foldername(name))[1])::uuid)
  );
