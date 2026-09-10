-- Zaptrix — reverte 0037: o limite de números conta TODAS as instâncias
-- criadas (qualquer status), não só as ativas.
-- 2026-09-10
--
-- Modelo correto (esclarecido pelo usuário): "+ Conectar WhatsApp" cria uma
-- instância NOVA e conta contra o limite do plano — cada linha em
-- whatsapp_connections já É uma instância contratada, esteja conectada,
-- desconectada ou com erro. Reconectar uma instância desconectada é uma ação
-- por linha (botão "Conectar" na própria conexão, connectionId explícito em
-- app/api/whatsapp/connect/route.ts) que reaproveita a linha via UPDATE — não
-- passa pelo INSERT, então nunca aciona este trigger e nunca precisa de vaga
-- nova. A migração 0037 tinha excluído 'disconnected' da contagem por engano
-- (achando que reconectar = inserir de novo); volta ao count(*) simples.

CREATE OR REPLACE FUNCTION enforce_whatsapp_connection_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_extra integer;
  v_limit integer;
  v_count integer;
BEGIN
  SELECT extra_whatsapp_connections INTO v_extra FROM workspaces WHERE id = NEW.workspace_id;
  v_limit := 1 + COALESCE(v_extra, 0);

  SELECT count(*) INTO v_count FROM whatsapp_connections WHERE workspace_id = NEW.workspace_id;

  IF v_count >= v_limit THEN
    RAISE EXCEPTION 'Limite de % número(s) de WhatsApp atingido. Fale com o suporte para contratar uma instância adicional (R$39,90/mês).', v_limit;
  END IF;

  RETURN NEW;
END;
$$;
