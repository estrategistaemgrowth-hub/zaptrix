-- Zaptrix — acesso privilegiado (cortesia/parceria, sem cobrança).
-- 2026-09-09

ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS is_complimentary boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN workspaces.is_complimentary IS
  'Acesso liberado sem cobrança (cortesia/parceria) — bypassa o bloqueio por '
  'vencimento de assinatura no middleware. Não afeta o bloqueio manual de '
  'status (suspenso/bloqueado), que continua sob controle do super admin.';
