-- Zaptrix — conexão desconectada não deveria ocupar vaga no limite de números.
-- 2026-09-10
--
-- enforce_whatsapp_connection_limit() (0033) contava TODAS as linhas de
-- whatsapp_connections, inclusive as com status 'disconnected' -- depois que
-- o lojista desconectava um número (logout, ou sessão que caiu sozinha na
-- Evolution API), a linha continuava ocupando a vaga pra sempre e o botão
-- "Conectar WhatsApp" ficava bloqueado com "limite atingido", mesmo o
-- workspace efetivamente usando 0 números. A API (app/api/whatsapp/connect/route.ts)
-- já passou a reaproveitar a linha desconectada em vez de inserir outra, mas
-- o trigger também precisa ignorar 'disconnected' na contagem pra não bloquear
-- o caso raro de inserir uma linha nova de verdade.

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

  SELECT count(*) INTO v_count
  FROM whatsapp_connections
  WHERE workspace_id = NEW.workspace_id
    AND status <> 'disconnected';

  IF v_count >= v_limit THEN
    RAISE EXCEPTION 'Limite de % número(s) de WhatsApp atingido. Fale com o suporte para contratar uma instância adicional (R$39,90/mês).', v_limit;
  END IF;

  RETURN NEW;
END;
$$;
