-- Zaptrix — autoatendimento de compra de instância adicional de WhatsApp.
-- 2026-09-10
--
-- Até aqui, a única forma de liberar uma instância extra era o lojista falar
-- com o suporte e o super admin editar manualmente `extra_whatsapp_connections`
-- no painel master. Agora o próprio lojista pode comprar (R$39,90/mês,
-- cobrança PIX via Asaas, mesmo fluxo de autoatendimento de 0026/0027) direto
-- em Minha Assinatura.
--
-- `kind` diferencia o efeito que o webhook do Asaas aplica quando a fatura é
-- paga: 'subscription' reativa/empurra o vencimento da assinatura (comportamento
-- já existente); 'extra_whatsapp_instance' só incrementa o contador de
-- instâncias extras — não deve mexer em subscription_status/expires_at.

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'subscription'
    CHECK (kind IN ('subscription', 'extra_whatsapp_instance'));

-- Incremento atômico (evita race condition entre entregas concorrentes do
-- webhook do Asaas incrementando a mesma linha em paralelo).
CREATE OR REPLACE FUNCTION increment_extra_whatsapp_connections(p_workspace_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE workspaces
  SET extra_whatsapp_connections = extra_whatsapp_connections + 1
  WHERE id = p_workspace_id;
$$;
