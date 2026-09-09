-- Zaptrix — variações de produto (tamanho/cor), seguindo as colunas
-- "Tamanho" e "Cor" do export padrão de e-commerce (cada variação já
-- vem como uma linha própria na planilha, com seu SKU/estoque/preço)
-- 2026-09-09

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS variant_size text,
  ADD COLUMN IF NOT EXISTS variant_color text;

CREATE INDEX IF NOT EXISTS idx_products_variants ON products(workspace_id, variant_size, variant_color);
