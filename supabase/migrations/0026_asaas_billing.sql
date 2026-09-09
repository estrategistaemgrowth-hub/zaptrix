-- Zaptrix — integração real com Asaas (cobrança automática das assinaturas
-- dos lojistas, PIX/boleto/cartão) além do upload manual de fatura já existente.
-- 2026-09-09

ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS cpf_cnpj text,
  ADD COLUMN IF NOT EXISTS asaas_customer_id text;

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS asaas_payment_id text,
  ADD COLUMN IF NOT EXISTS asaas_invoice_url text,
  ADD COLUMN IF NOT EXISTS asaas_pix_payload text,
  ADD COLUMN IF NOT EXISTS asaas_pix_qrcode text;

CREATE INDEX IF NOT EXISTS idx_invoices_asaas_payment_id ON invoices(asaas_payment_id);
