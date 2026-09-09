-- Zaptrix — cadastro público de lojista (link de assinatura + link de teste
-- grátis): a página de planos precisa ser visível SEM sessão (visitante
-- decidindo se assina), então o catálogo de planos passa a ser público.
-- 2026-09-09

DROP POLICY IF EXISTS "plans_select_authenticated" ON plans;

CREATE POLICY "plans_select_public"
  ON plans FOR SELECT
  USING (true);
