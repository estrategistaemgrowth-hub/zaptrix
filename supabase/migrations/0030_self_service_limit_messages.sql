-- Zaptrix — mensagens de limite de plano apontam pro autoatendimento.
-- 2026-09-09
--
-- Antes de existir /api/subscription/upgrade (autoatendimento de troca de
-- plano pelo próprio lojista), a única saída era "fale com o suporte". Agora
-- que o lojista pode resolver sozinho em Configurações > Minha Assinatura,
-- a mensagem do limite (que aparece na hora que ele tenta cadastrar produto/
-- membro além do plano) já indica o caminho certo.

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
    RAISE EXCEPTION 'Limite de % produtos do plano atingido. Faça upgrade em Configurações > Minha Assinatura.', v_limit;
  END IF;

  RETURN NEW;
END;
$$;

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
    RAISE EXCEPTION 'Limite de % usuários/atendentes do plano atingido. Faça upgrade em Configurações > Minha Assinatura.', v_limit;
  END IF;

  RETURN NEW;
END;
$$;
