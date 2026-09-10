-- Observabilidade da auto-revisão da resposta (reviewReply, ver
-- app/api/webhooks/whatsapp/route.ts): registra se a checagem corrigiu algo
-- no rascunho antes de enviar (grounding contra a Base de Conhecimento, tom,
-- tópicos proibidos ou regras de negócio). Nullable: null quando o turno
-- falhou antes de reviewReply rodar (status = 'failed').
ALTER TABLE ai_runs ADD COLUMN IF NOT EXISTS self_check_corrected boolean;
