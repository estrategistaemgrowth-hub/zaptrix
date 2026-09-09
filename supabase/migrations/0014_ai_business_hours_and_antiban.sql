-- Zaptrix — Sprint 9: horário de atendimento da IA + proteções anti-ban do WhatsApp
-- 2026-09-09

ALTER TABLE ai_profiles
  ADD COLUMN IF NOT EXISTS business_hours_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS business_hours jsonb DEFAULT '{
    "monday":    {"enabled": true,  "start": "09:00", "end": "18:00"},
    "tuesday":   {"enabled": true,  "start": "09:00", "end": "18:00"},
    "wednesday": {"enabled": true,  "start": "09:00", "end": "18:00"},
    "thursday":  {"enabled": true,  "start": "09:00", "end": "18:00"},
    "friday":    {"enabled": true,  "start": "09:00", "end": "18:00"},
    "saturday":  {"enabled": false, "start": "09:00", "end": "13:00"},
    "sunday":    {"enabled": false, "start": "09:00", "end": "13:00"}
  }'::jsonb,
  ADD COLUMN IF NOT EXISTS out_of_hours_message text DEFAULT
    'Nosso atendimento automático está fora do horário de funcionamento. Retornaremos assim que possível!';

-- Proteções anti-ban: WhatsApp não-oficial (Evolution API / whatsapp-web.js) corre risco
-- real de banimento do número em caso de envio em rajada ou volume muito acima do normal
-- de uma conta pessoal/comercial. Delay entre mensagens e limite diário mitigam o risco.
ALTER TABLE whatsapp_connections
  ADD COLUMN IF NOT EXISTS min_delay_seconds integer DEFAULT 3,
  ADD COLUMN IF NOT EXISTS max_delay_seconds integer DEFAULT 8,
  ADD COLUMN IF NOT EXISTS daily_message_limit integer,
  ADD COLUMN IF NOT EXISTS warmup_mode boolean DEFAULT true;
