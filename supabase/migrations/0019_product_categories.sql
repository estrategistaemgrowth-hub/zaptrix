-- Zaptrix — categorias de produto como entidade de primeira classe
-- Hoje products.category é texto livre (sem gestão). Esta migração cria
-- a tabela categories e o vínculo products.category_id, mantendo a coluna
-- de texto existente para não quebrar import/filtros já em produção.
-- 2026-09-09

-- ============================================================================
-- TABLE: categories
-- ============================================================================

CREATE TABLE categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz DEFAULT now(),

  UNIQUE (workspace_id, name)
);

COMMENT ON TABLE categories IS 'Categorias de produto por workspace — geridas pelo lojista ou criadas automaticamente na importação de planilha';

-- ============================================================================
-- COLUMN: products.category_id (aditivo — products.category texto permanece)
-- ============================================================================

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES categories(id) ON DELETE SET NULL;

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_categories_workspace ON categories(workspace_id);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) — mesmo padrão usado em products (0001)
-- ============================================================================

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can view categories"
  ON categories FOR SELECT
  USING (is_workspace_member(workspace_id));

CREATE POLICY "Owner/admin can manage categories"
  ON categories FOR INSERT
  WITH CHECK (is_workspace_member(workspace_id, array['owner','admin']));

CREATE POLICY "Owner/admin can update categories"
  ON categories FOR UPDATE
  USING (is_workspace_member(workspace_id, array['owner','admin']));

CREATE POLICY "Owner/admin can delete categories"
  ON categories FOR DELETE
  USING (is_workspace_member(workspace_id, array['owner','admin']));

-- ============================================================================
-- BACKFILL — produtos já importados não podem ficar "sem categoria"
-- ============================================================================

INSERT INTO categories (workspace_id, name)
SELECT DISTINCT workspace_id, category
FROM products
WHERE category IS NOT NULL AND trim(category) != ''
ON CONFLICT (workspace_id, name) DO NOTHING;

UPDATE products p
SET category_id = c.id
FROM categories c
WHERE c.workspace_id = p.workspace_id AND c.name = p.category AND p.category_id IS NULL;
