-- Zaptrix — Sprint 7: tags em contatos + suporte a contato criado manualmente
-- 2026-09-09

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS notes text;

-- phone deixa de ser obrigatório no momento do INSERT vindo do webhook (já é NOT NULL),
-- mas contato criado manualmente pelo atendente sempre informa telefone no form — nenhuma mudança de constraint necessária.

CREATE INDEX IF NOT EXISTS idx_contacts_tags ON contacts USING GIN (tags);
