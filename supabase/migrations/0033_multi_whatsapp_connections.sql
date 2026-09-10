-- Zaptrix — múltiplas instâncias de WhatsApp por workspace (add-on pago) +
-- roleta de atendimento configurável por número.
-- 2026-09-10
--
-- Modelo de negócio: cada workspace tem direito a 1 conexão de WhatsApp por
-- padrão; instâncias extras são um add-on pago (R$39,90/mês cada), liberado
-- manualmente pelo super admin no painel master (mesmo padrão manual já usado
-- pra plano/vencimento — nenhuma automação de cobrança recorrente existe
-- hoje, então o valor extra entra como mais uma linha na fatura que o admin
-- já sobe manualmente).

ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS extra_whatsapp_connections integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN workspaces.extra_whatsapp_connections IS 'Instâncias de WhatsApp adicionais contratadas além da 1ª gratuita — cada uma R$39,90/mês, liberado manualmente pelo super admin.';

-- ============================================================================
-- LIMITE DE CONEXÕES — reforçado por trigger, mesmo padrão de
-- enforce_product_limit/enforce_member_limit (0024_plans_and_billing.sql).
-- ============================================================================

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

CREATE TRIGGER trg_enforce_whatsapp_connection_limit
  BEFORE INSERT ON whatsapp_connections
  FOR EACH ROW
  EXECUTE FUNCTION enforce_whatsapp_connection_limit();

-- ============================================================================
-- CONVERSATIONS: qual conexão/número recebeu a conversa — necessário pra
-- separar por aba/filtro no Atendimento quando há mais de 1 número.
-- ============================================================================

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS whatsapp_connection_id uuid REFERENCES whatsapp_connections(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_conversations_whatsapp_connection ON conversations(whatsapp_connection_id);

COMMENT ON COLUMN conversations.whatsapp_connection_id IS 'Conexão de WhatsApp por onde essa conversa chegou — nulo em conversas antigas (de antes de suportar múltiplos números), tratadas como "número principal".';

-- ============================================================================
-- ROLETA POR NÚMERO: quais atendentes participam do rodízio de cada conexão.
-- Tabela vazia pra uma conexão = round-robin continua igual a hoje (todos os
-- atendentes/admins do workspace, sem filtro por número) — só passa a
-- restringir quando o lojista de fato configurar.
-- ============================================================================

CREATE TABLE connection_attendants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES whatsapp_connections(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(connection_id, user_id)
);

COMMENT ON TABLE connection_attendants IS 'Mapeamento de quais atendentes/admins participam da roleta de cada número de WhatsApp — permite "vários números para vários atendentes" ou "1 número por atendente" conforme o lojista configurar.';

CREATE INDEX idx_connection_attendants_connection ON connection_attendants(connection_id);
CREATE INDEX idx_connection_attendants_user ON connection_attendants(user_id);

ALTER TABLE connection_attendants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "connection_attendants_select_workspace_member"
  ON connection_attendants FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM whatsapp_connections wc
      WHERE wc.id = connection_attendants.connection_id
        AND is_workspace_member(wc.workspace_id)
    )
  );

CREATE POLICY "connection_attendants_write_owner_admin"
  ON connection_attendants FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM whatsapp_connections wc
      WHERE wc.id = connection_attendants.connection_id
        AND is_workspace_member(wc.workspace_id, array['owner','admin'])
    )
  );

CREATE POLICY "connection_attendants_delete_owner_admin"
  ON connection_attendants FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM whatsapp_connections wc
      WHERE wc.id = connection_attendants.connection_id
        AND is_workspace_member(wc.workspace_id, array['owner','admin'])
    )
  );
