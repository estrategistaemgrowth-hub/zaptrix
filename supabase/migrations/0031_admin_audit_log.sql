-- Zaptrix — log de auditoria das ações do super admin no painel master.
-- 2026-09-09

CREATE TABLE admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid REFERENCES auth.users(id),
  action text NOT NULL,
  target_workspace_id uuid REFERENCES workspaces(id) ON DELETE SET NULL,
  details jsonb,
  created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX idx_admin_audit_log_created_at ON admin_audit_log(created_at DESC);

COMMENT ON TABLE admin_audit_log IS 'Registro de ações do super admin (criar/editar lojista, faturas, planos) — só gravado via service role, lido só por platform_admin.';

ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_audit_log_select_platform_admin"
  ON admin_audit_log FOR SELECT
  USING (is_platform_admin());

-- Sem policy de INSERT/UPDATE/DELETE: só gravado via service role
-- (createAdminClient), dentro das próprias rotas /api/master/**, depois de
-- já validar is_platform_admin() no código.
