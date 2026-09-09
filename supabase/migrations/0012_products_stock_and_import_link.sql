-- Zaptrix — Sprint 8: estoque em produtos (essencial para e-commerce:
-- a IA não deve oferecer produto sem estoque) + vínculo do produto com
-- a importação que o criou (rastreabilidade de import por planilha)
-- 2026-09-09

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS stock_quantity integer,
  ADD COLUMN IF NOT EXISTS external_id text;

CREATE INDEX IF NOT EXISTS idx_products_workspace_external_id ON products(workspace_id, external_id);

-- Full-text search simples em nome+descrição+categoria, para a IA localizar
-- produtos relevantes durante o atendimento
ALTER TABLE products ADD COLUMN IF NOT EXISTS search_text text
  GENERATED ALWAYS AS (
    coalesce(name, '') || ' ' || coalesce(category, '') || ' ' || coalesce(description, '')
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_products_search ON products USING GIN (to_tsvector('portuguese', search_text));
