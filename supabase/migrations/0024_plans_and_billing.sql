-- Zaptrix — Sprint "Super Admin": planos de assinatura, vencimento e faturas.
-- 2026-09-09

-- ============================================================================
-- PLANOS (catálogo fixo, 3 linhas seedadas abaixo)
-- ============================================================================

CREATE TABLE plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  price_cents integer NOT NULL,
  product_limit integer NOT NULL,
  member_limit integer NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

INSERT INTO plans (name, price_cents, product_limit, member_limit) VALUES
  ('Básico', 6990, 100, 3),
  ('Profissional', 9790, 500, 5),
  ('Enterprise', 15000, 1000, 10);

ALTER TABLE plans ENABLE ROW LEVEL SECURITY;

-- Qualquer usuário autenticado pode ler o catálogo de planos (precisa aparecer
-- no seletor do painel master e na tela "Minha Assinatura" do lojista).
CREATE POLICY "plans_select_authenticated"
  ON plans FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Só super admin gerencia o catálogo de planos.
CREATE POLICY "plans_write_platform_admin"
  ON plans FOR ALL
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

-- ============================================================================
-- WORKSPACES: plano, status de assinatura e vencimento
-- ============================================================================

ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS plan_id uuid REFERENCES plans(id),
  ADD COLUMN IF NOT EXISTS subscription_status text NOT NULL DEFAULT 'trial',
  ADD COLUMN IF NOT EXISTS subscription_expires_at timestamp with time zone;

ALTER TABLE workspaces
  ADD CONSTRAINT workspaces_subscription_status_check
  CHECK (subscription_status IN ('trial', 'active', 'overdue', 'canceled'));

-- ============================================================================
-- FATURAS
-- ============================================================================

CREATE TABLE invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  amount_cents integer NOT NULL,
  due_date date NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue')),
  file_url text,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX idx_invoices_workspace_id ON invoices(workspace_id);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Lojista enxerga as próprias faturas (somente leitura); super admin faz tudo.
CREATE POLICY "invoices_select_own_workspace_or_platform_admin"
  ON invoices FOR SELECT
  USING (is_workspace_member(workspace_id) OR is_platform_admin());

CREATE POLICY "invoices_write_platform_admin"
  ON invoices FOR INSERT
  WITH CHECK (is_platform_admin());

CREATE POLICY "invoices_update_platform_admin"
  ON invoices FOR UPDATE
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

CREATE POLICY "invoices_delete_platform_admin"
  ON invoices FOR DELETE
  USING (is_platform_admin());

-- Bucket de Storage para os arquivos de fatura — privado (diferente de
-- product-images/message-media, que são públicos): é documento financeiro.
INSERT INTO storage.buckets (id, name, public)
VALUES ('invoices', 'invoices', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "invoices_storage_read"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'invoices'
    AND (is_platform_admin() OR is_workspace_member(((storage.foldername(name))[1])::uuid))
  );

CREATE POLICY "invoices_storage_write"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'invoices' AND is_platform_admin());

CREATE POLICY "invoices_storage_delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'invoices' AND is_platform_admin());

-- ============================================================================
-- PLATFORM_ADMINS: faltava policy de escrita (só existia SELECT da própria
-- linha) — sem isso, promover um novo super admin exigia SQL manual sempre.
-- ============================================================================

CREATE POLICY "platform_admins_insert_by_platform_admin"
  ON platform_admins FOR INSERT
  WITH CHECK (is_platform_admin());

CREATE POLICY "platform_admins_delete_by_platform_admin"
  ON platform_admins FOR DELETE
  USING (is_platform_admin());

-- ============================================================================
-- LIMITES DE PLANO — reforçados por trigger no banco, não só na UI, para que
-- nenhum caminho de código (incluindo importação de planilha) consiga passar
-- do limite contratado. Workspace sem plan_id definido não é bloqueado.
-- ============================================================================

CREATE OR REPLACE FUNCTION enforce_product_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer;
  v_count integer;
BEGIN
  SELECT p.product_limit INTO v_limit
  FROM workspaces w
  JOIN plans p ON p.id = w.plan_id
  WHERE w.id = NEW.workspace_id;

  IF v_limit IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO v_count FROM products WHERE workspace_id = NEW.workspace_id;

  IF v_count >= v_limit THEN
    RAISE EXCEPTION 'Limite de % produtos do plano atingido. Fale com o suporte para fazer upgrade.', v_limit;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_product_limit
  BEFORE INSERT ON products
  FOR EACH ROW
  EXECUTE FUNCTION enforce_product_limit();

CREATE OR REPLACE FUNCTION enforce_member_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer;
  v_count integer;
BEGIN
  SELECT p.member_limit INTO v_limit
  FROM workspaces w
  JOIN plans p ON p.id = w.plan_id
  WHERE w.id = NEW.workspace_id;

  IF v_limit IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO v_count FROM workspace_members WHERE workspace_id = NEW.workspace_id;

  IF v_count >= v_limit THEN
    RAISE EXCEPTION 'Limite de % usuários/atendentes do plano atingido. Fale com o suporte para fazer upgrade.', v_limit;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_member_limit
  BEFORE INSERT ON workspace_members
  FOR EACH ROW
  EXECUTE FUNCTION enforce_member_limit();
