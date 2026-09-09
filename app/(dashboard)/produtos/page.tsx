'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ensureWorkspace } from '@/lib/workspace';
import { fetchAllRows } from '@/lib/fetch-all-rows';
import { readFileAsText, parseProductsCsv, ImportResult } from '@/lib/csv-import';
import { downloadCsv } from '@/lib/csv-export';
import { ProductDetailModal } from '@/components/product-detail-modal';
import { SkeletonCard, Skeleton } from '@/components/skeleton';
import { Plus, Trash2, Tag, Upload, Download, FileSpreadsheet, X, Loader2, Search, SlidersHorizontal, ExternalLink, LayoutGrid, List, PackageSearch, FolderOpen, ChevronDown, Pencil, Check } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  sku: string | null;
  description: string | null;
  price: number;
  promotional_price: number | null;
  category: string | null;
  category_id: string | null;
  tags: string[] | null;
  purchase_url: string | null;
  image_url: string | null;
  stock_quantity: number | null;
  variant_size: string | null;
  variant_color: string | null;
  active: boolean;
}

interface Category {
  id: string;
  name: string;
}

const BATCH_SIZE = 200;
const PAGE_SIZE = 200;

export default function ProdutosPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    description: '',
    price: '',
    promotional_price: '',
    category: '',
    category_id: '',
    tagsInput: '',
    purchase_url: '',
    image_url: '',
    variant_size: '',
    variant_color: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [importPreview, setImportPreview] = useState<{ result: ImportResult; fileName: string } | null>(null);
  const [importing, setImporting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [stockFilter, setStockFilter] = useState<'all' | 'in_stock' | 'out_of_stock'>('all');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [importProgress, setImportProgress] = useState(0);
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [newVariantType, setNewVariantType] = useState<'none' | 'simple_size' | 'simple_color' | 'composite'>('none');
  const [categories, setCategories] = useState<Category[]>([]);
  const [showCategoriesPanel, setShowCategoriesPanel] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [categoryError, setCategoryError] = useState('');
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [canManageProducts, setCanManageProducts] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  const categoryNameById = new Map(categories.map((c) => [c.id, c.name]));
  const allCategories = Array.from(
    new Set([
      ...categories.map((c) => c.name),
      ...products.map((p) => p.category).filter((c): c is string => !!c),
    ])
  ).sort();
  const allTags = Array.from(new Set(products.flatMap((p) => p.tags || []))).sort();

  const filteredProducts = products.filter((p) => {
    const term = searchTerm.toLowerCase();
    if (term && !p.name.toLowerCase().includes(term) && !(p.sku || '').toLowerCase().includes(term)) {
      return false;
    }
    if (categoryFilter) {
      // Prioriza o nome atual da categoria vinculada (category_id); produtos
      // ainda não vinculados caem no texto livre antigo (category).
      const effectiveCategory = p.category_id ? categoryNameById.get(p.category_id) ?? p.category : p.category;
      if (effectiveCategory !== categoryFilter) return false;
    }
    if (stockFilter === 'in_stock' && !(p.stock_quantity && p.stock_quantity > 0)) return false;
    if (stockFilter === 'out_of_stock' && !(p.stock_quantity !== null && p.stock_quantity <= 0)) {
      return false;
    }
    const effectivePrice = p.promotional_price ?? p.price;
    if (priceMin && effectivePrice < parseFloat(priceMin)) return false;
    if (priceMax && effectivePrice > parseFloat(priceMax)) return false;
    if (selectedTags.length > 0 && !selectedTags.every((tag) => (p.tags || []).includes(tag))) {
      return false;
    }
    return true;
  });

  function toggleTagFilter(tag: string) {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }

  function handleExportCsv() {
    downloadCsv(
      `produtos-${new Date().toISOString().slice(0, 10)}.csv`,
      filteredProducts.map((p) => ({
        nome: p.name,
        sku: p.sku || '',
        categoria: p.category_id ? categoryNameById.get(p.category_id) ?? p.category ?? '' : p.category || '',
        preco: p.price.toFixed(2),
        preco_promocional: p.promotional_price !== null ? p.promotional_price.toFixed(2) : '',
        estoque: p.stock_quantity !== null ? p.stock_quantity : '',
        tags: (p.tags || []).join(', '),
        link_compra: p.purchase_url || '',
        ativo: p.active ? 'sim' : 'não',
      }))
    );
  }

  function clearFilters() {
    setCategoryFilter('');
    setStockFilter('all');
    setPriceMin('');
    setPriceMax('');
    setSelectedTags([]);
  }

  const activeFilterCount =
    (categoryFilter ? 1 : 0) +
    (stockFilter !== 'all' ? 1 : 0) +
    (priceMin ? 1 : 0) +
    (priceMax ? 1 : 0) +
    selectedTags.length;

  useEffect(() => {
    init();
  }, []);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [searchTerm, categoryFilter, stockFilter, priceMin, priceMax, selectedTags]);

  async function init() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const workspace = await ensureWorkspace(supabase, session.user.id, session.user.email);
      if (!workspace) {
        setError('Não foi possível carregar seu workspace.');
        setLoading(false);
        return;
      }

      setWorkspaceId(workspace.workspaceId);
      setCanManageProducts(workspace.role === 'owner' || workspace.role === 'admin');
      await Promise.all([loadProducts(workspace.workspaceId), loadCategories(workspace.workspaceId)]);
    } catch (err) {
      console.error('Erro ao carregar produtos:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadProducts(wsId: string) {
    const { data, error: loadError } = await fetchAllRows<Product>((from, to) =>
      supabase
        .from('products')
        .select('*')
        .eq('workspace_id', wsId)
        .order('created_at', { ascending: false })
        .range(from, to)
    );

    if (loadError) {
      setError('Erro ao carregar produtos');
      return;
    }

    setProducts(data);
  }

  async function loadCategories(wsId: string) {
    const { data, error: loadError } = await supabase
      .from('categories')
      .select('id, name')
      .eq('workspace_id', wsId)
      .order('name', { ascending: true });

    if (loadError) {
      console.error('Erro ao carregar categorias:', loadError);
      return;
    }

    setCategories(data || []);
  }

  async function handleCreateCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!workspaceId || !newCategoryName.trim()) return;

    setCategoryError('');

    const { error: insertError } = await supabase
      .from('categories')
      .insert([{ workspace_id: workspaceId, name: newCategoryName.trim() }]);

    if (insertError) {
      setCategoryError(
        insertError.code === '23505'
          ? 'Já existe uma categoria com esse nome.'
          : 'Erro ao criar categoria: ' + insertError.message
      );
      return;
    }

    setNewCategoryName('');
    await loadCategories(workspaceId);
  }

  function startEditingCategory(cat: Category) {
    setCategoryError('');
    setEditingCategoryId(cat.id);
    setEditingCategoryName(cat.name);
  }

  async function handleRenameCategory(id: string) {
    if (!workspaceId || !editingCategoryName.trim()) return;

    setCategoryError('');
    const newName = editingCategoryName.trim();

    const { error: updateError } = await supabase
      .from('categories')
      .update({ name: newName })
      .eq('id', id);

    if (updateError) {
      setCategoryError(
        updateError.code === '23505'
          ? 'Já existe uma categoria com esse nome.'
          : 'Erro ao renomear categoria: ' + updateError.message
      );
      return;
    }

    // Mantém products.category (texto legado) sincronizado com o novo nome.
    await supabase.from('products').update({ category: newName }).eq('category_id', id);

    setEditingCategoryId(null);
    setEditingCategoryName('');
    await Promise.all([loadCategories(workspaceId), loadProducts(workspaceId)]);
  }

  async function handleDeleteCategory(id: string, name: string) {
    if (
      !workspaceId ||
      !confirm(`Excluir a categoria "${name}"? Os produtos vinculados ficam sem categoria — nenhum produto é apagado.`)
    ) {
      return;
    }

    const { error: deleteError } = await supabase.from('categories').delete().eq('id', id);
    if (deleteError) {
      alert('Erro ao excluir categoria: ' + deleteError.message);
      return;
    }
    await Promise.all([loadCategories(workspaceId), loadProducts(workspaceId)]);
  }

  async function handleAddProduct(e: React.FormEvent) {
    e.preventDefault();
    if (!workspaceId) return;

    setSubmitting(true);
    setError('');

    const tags = formData.tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const { error: insertError } = await supabase.from('products').insert([
      {
        workspace_id: workspaceId,
        name: formData.name,
        sku: formData.sku || null,
        description: formData.description || null,
        price: parseFloat(formData.price),
        promotional_price: formData.promotional_price
          ? parseFloat(formData.promotional_price)
          : null,
        category: formData.category || null,
        category_id: formData.category_id || null,
        tags,
        purchase_url: formData.purchase_url || null,
        image_url: formData.image_url || null,
        variant_size:
          newVariantType === 'simple_size' || newVariantType === 'composite'
            ? formData.variant_size || null
            : null,
        variant_color:
          newVariantType === 'simple_color' || newVariantType === 'composite'
            ? formData.variant_color || null
            : null,
        active: true,
      },
    ]);

    if (insertError) {
      console.error('Erro ao criar produto:', insertError);
      setError('Erro ao criar produto: ' + insertError.message);
      setSubmitting(false);
      return;
    }

    setFormData({
      name: '',
      sku: '',
      description: '',
      price: '',
      promotional_price: '',
      category: '',
      category_id: '',
      tagsInput: '',
      purchase_url: '',
      image_url: '',
      variant_size: '',
      variant_color: '',
    });
    setNewVariantType('none');
    setShowForm(false);
    setSubmitting(false);
    await loadProducts(workspaceId);
  }

  async function handleDeleteProduct(id: string) {
    if (!workspaceId || !confirm('Deletar este produto?')) return;

    const { error: deleteError } = await supabase.from('products').delete().eq('id', id);
    if (deleteError) {
      alert('Erro ao deletar: ' + deleteError.message);
      return;
    }
    await loadProducts(workspaceId);
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');

    try {
      const text = await readFileAsText(file);
      const result = parseProductsCsv(text);

      if (result.products.length === 0) {
        setError(
          'Nenhum produto reconhecido na planilha. Verifique se ela tem colunas de nome e preço.'
        );
        return;
      }

      setImportPreview({ result, fileName: file.name });
    } catch (err) {
      console.error('Erro ao ler planilha:', err);
      setError('Erro ao ler a planilha. Verifique se é um arquivo .csv válido.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleConfirmImport() {
    if (!workspaceId || !importPreview) return;

    setImporting(true);
    setImportProgress(0);
    setError('');

    const { products: parsedProducts, totalRows, skippedRows } = importPreview.result;

    // Categoria que a planilha trouxer e ainda não existir como registro é
    // criada automaticamente (mesmo comportamento do backfill da migração).
    const categoryNames = Array.from(
      new Set(
        parsedProducts
          .map((p) => p.category?.trim())
          .filter((c): c is string => !!c)
      )
    );

    if (categoryNames.length > 0) {
      const { error: upsertError } = await supabase.from('categories').upsert(
        categoryNames.map((name) => ({ workspace_id: workspaceId, name })),
        { onConflict: 'workspace_id,name', ignoreDuplicates: true }
      );
      if (upsertError) {
        console.error('Erro ao criar categorias da planilha:', upsertError);
      }
    }

    const { data: workspaceCategories } = await supabase
      .from('categories')
      .select('id, name')
      .eq('workspace_id', workspaceId);

    const categoryIdByName = new Map((workspaceCategories || []).map((c) => [c.name, c.id]));

    const { data: importRecord, error: importCreateError } = await supabase
      .from('product_imports')
      .insert([
        {
          workspace_id: workspaceId,
          filename: importPreview.fileName,
          status: 'processing',
          total_rows: totalRows,
        },
      ])
      .select('id')
      .single();

    if (importCreateError) {
      setError('Erro ao registrar importação: ' + importCreateError.message);
      setImporting(false);
      return;
    }

    let createdCount = 0;
    let errorCount = 0;

    for (let i = 0; i < parsedProducts.length; i += BATCH_SIZE) {
      const batch = parsedProducts.slice(i, i + BATCH_SIZE).map((p) => ({
        workspace_id: workspaceId,
        ...p,
        category_id: p.category ? categoryIdByName.get(p.category.trim()) ?? null : null,
      }));

      const { error: batchError, count } = await supabase
        .from('products')
        .insert(batch, { count: 'exact' });

      if (batchError) {
        console.error('Erro ao importar lote:', batchError);
        errorCount += batch.length;
      } else {
        createdCount += count ?? batch.length;
      }

      setImportProgress(Math.min(i + BATCH_SIZE, parsedProducts.length));
    }

    await supabase
      .from('product_imports')
      .update({
        status: 'completed',
        created_count: createdCount,
        updated_count: 0,
        error_count: errorCount + skippedRows,
        finished_at: new Date().toISOString(),
      })
      .eq('id', importRecord.id);

    setImporting(false);
    setImportPreview(null);
    await Promise.all([loadProducts(workspaceId), loadCategories(workspaceId)]);
  }

  return (
    <div className="p-2">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Produtos</h1>
            <p className="text-muted-foreground">Catálogo de produtos para recomendações</p>
          </div>
          <div className="flex gap-3">
            <div className="flex items-center border border-border rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode('grid')}
                title="Ver em cards"
                className={`p-2.5 ${
                  viewMode === 'grid'
                    ? 'bg-primary text-white'
                    : 'bg-white text-muted-foreground hover:bg-muted'
                }`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                title="Ver em lista"
                className={`p-2.5 ${
                  viewMode === 'list'
                    ? 'bg-primary text-white'
                    : 'bg-white text-muted-foreground hover:bg-muted'
                }`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
            <button
              onClick={handleExportCsv}
              disabled={filteredProducts.length === 0}
              title="Exportar produtos filtrados para CSV"
              className="flex items-center gap-2 px-4 py-2 border border-border text-foreground rounded-lg font-medium text-sm hover:bg-muted disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              Exportar
            </button>
            {canManageProducts && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelected}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-6 py-2 border border-border text-foreground rounded-lg font-medium hover:bg-muted"
                >
                  <Upload className="w-4 h-4" />
                  Importar planilha
                </button>
                <button
                  onClick={() => setShowCategoriesPanel(!showCategoriesPanel)}
                  className={`flex items-center gap-2 px-6 py-2 rounded-lg font-medium border ${
                    showCategoriesPanel
                      ? 'bg-primary/10 text-primary border-primary/20'
                      : 'border-border text-foreground hover:bg-muted'
                  }`}
                >
                  <FolderOpen className="w-4 h-4" />
                  Categorias
                </button>
                <button
                  onClick={() => setShowForm(!showForm)}
                  className="gradient-brand flex items-center gap-2 px-6 py-2 text-white rounded-lg font-medium shadow-sm transition-all duration-200 hover:shadow-md hover:opacity-95"
                >
                  <Plus className="w-4 h-4" />
                  Novo produto
                </button>
              </>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        {showCategoriesPanel && (
          <div className="bg-card border border-border rounded-2xl shadow-sm p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold text-foreground">Categorias</h2>
                <span className="text-xs text-muted-foreground">
                  {categories.length === 0 ? 'nenhuma cadastrada' : `${categories.length} cadastrada${categories.length > 1 ? 's' : ''}`}
                </span>
              </div>
              <button
                onClick={() => setShowCategoriesPanel(false)}
                className="p-1 text-muted-foreground hover:text-foreground"
              >
                <ChevronDown className="w-5 h-5 rotate-180" />
              </button>
            </div>

            <form onSubmit={handleCreateCategory} className="flex gap-2 mb-4">
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="Nome da nova categoria"
                className="flex-1 px-4 py-2 border border-border rounded-xl bg-white text-foreground"
              />
              <button type="submit" className="px-5 py-2 btn-gradient font-medium whitespace-nowrap">
                Adicionar
              </button>
            </form>

            {categoryError && <p className="text-sm text-red-600 mb-3">{categoryError}</p>}

            {categories.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma categoria cadastrada ainda. Crie uma acima ou importe uma planilha com a
                coluna de categoria preenchida.
              </p>
            ) : (
              <div className="space-y-2">
                {categories.map((cat) => {
                  const productCount = products.filter((p) => p.category_id === cat.id).length;
                  return (
                    <div
                      key={cat.id}
                      className="flex items-center gap-2 p-2.5 border border-border rounded-xl"
                    >
                      {editingCategoryId === cat.id ? (
                        <>
                          <input
                            type="text"
                            value={editingCategoryName}
                            onChange={(e) => setEditingCategoryName(e.target.value)}
                            autoFocus
                            className="flex-1 px-3 py-1.5 border border-border rounded-lg bg-white text-sm text-foreground"
                          />
                          <button
                            onClick={() => handleRenameCategory(cat.id)}
                            title="Salvar"
                            className="p-1.5 text-primary hover:bg-primary/10 rounded-lg"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setEditingCategoryId(null)}
                            title="Cancelar"
                            className="p-1.5 text-muted-foreground hover:text-foreground"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          <span className="flex-1 text-sm text-foreground">{cat.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {productCount} produto{productCount !== 1 ? 's' : ''}
                          </span>
                          <button
                            onClick={() => startEditingCategory(cat)}
                            title="Renomear"
                            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteCategory(cat.id, cat.name)}
                            title="Excluir"
                            className="p-1.5 text-destructive hover:bg-destructive/10 rounded-lg"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {importPreview && (
          <div className="bg-card border border-border rounded-2xl shadow-sm p-6 mb-8">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="w-6 h-6 text-primary" />
                <div>
                  <h2 className="text-xl font-semibold text-foreground">
                    Importar "{importPreview.fileName}"
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {importPreview.result.products.length} produtos reconhecidos
                    {importPreview.result.skippedRows > 0 &&
                      ` · ${importPreview.result.skippedRows} linhas ignoradas (sem nome ou preço)`}
                  </p>
                </div>
              </div>
              {!importing && (
                <button
                  onClick={() => setImportPreview(null)}
                  className="p-2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            <div className="overflow-x-auto border border-border rounded-xl mb-4">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-4 py-2 text-left font-semibold text-foreground">Nome</th>
                    <th className="px-4 py-2 text-left font-semibold text-foreground">Categoria</th>
                    <th className="px-4 py-2 text-left font-semibold text-foreground">Preço</th>
                    <th className="px-4 py-2 text-left font-semibold text-foreground">Estoque</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {importPreview.result.products.slice(0, 8).map((p, i) => (
                    <tr key={i}>
                      <td className="px-4 py-2 text-foreground line-clamp-1 max-w-xs">{p.name}</td>
                      <td className="px-4 py-2 text-muted-foreground">{p.category || '—'}</td>
                      <td className="px-4 py-2 text-foreground">R$ {p.price.toFixed(2)}</td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {p.stock_quantity ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {importPreview.result.products.length > 8 && (
                <p className="text-xs text-muted-foreground p-3 bg-muted">
                  + {importPreview.result.products.length - 8} produtos não exibidos no preview
                </p>
              )}
            </div>

            {importing ? (
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                Importando {importProgress} de {importPreview.result.products.length}...
              </div>
            ) : (
              <div className="flex gap-3">
                <button
                  onClick={handleConfirmImport}
                  className="px-6 py-2 btn-gradient font-medium"
                >
                  Confirmar importação
                </button>
                <button
                  onClick={() => setImportPreview(null)}
                  className="px-6 py-2 border border-border text-foreground rounded-lg font-medium hover:bg-background"
                >
                  Cancelar
                </button>
              </div>
            )}
          </div>
        )}

        <div className="bg-card border border-border rounded-2xl shadow-sm p-6 mb-6">
          <div className="flex items-center gap-3">
            <Search className="w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nome ou SKU..."
              className="flex-1 text-foreground placeholder-muted-foreground outline-none"
            />
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border ${
                showFilters || activeFilterCount > 0
                  ? 'bg-primary/10 text-primary border-primary/20'
                  : 'border-border text-muted-foreground hover:bg-muted'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              Filtros
              {activeFilterCount > 0 && (
                <span className="w-5 h-5 flex items-center justify-center bg-primary text-white rounded-full text-xs">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>

          {showFilters && (
            <div className="mt-4 pt-4 border-t border-border space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {allCategories.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-2">Categoria</p>
                    <select
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                      className="w-full px-3 py-2 border border-border rounded-lg bg-white text-sm text-foreground"
                    >
                      <option value="">Todas</option>
                      {allCategories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2">Estoque</p>
                  <select
                    value={stockFilter}
                    onChange={(e) => setStockFilter(e.target.value as typeof stockFilter)}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-white text-sm text-foreground"
                  >
                    <option value="all">Todos</option>
                    <option value="in_stock">Com estoque</option>
                    <option value="out_of_stock">Sem estoque</option>
                  </select>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">Faixa de preço</p>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    value={priceMin}
                    onChange={(e) => setPriceMin(e.target.value)}
                    placeholder="Mín"
                    className="w-32 px-3 py-2 border border-border rounded-lg bg-white text-sm text-foreground"
                  />
                  <span className="text-muted-foreground">até</span>
                  <input
                    type="number"
                    value={priceMax}
                    onChange={(e) => setPriceMax(e.target.value)}
                    placeholder="Máx"
                    className="w-32 px-3 py-2 border border-border rounded-lg bg-white text-sm text-foreground"
                  />
                </div>
              </div>

              {allTags.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2">Tags</p>
                  <div className="flex flex-wrap gap-2">
                    {allTags.map((tag) => (
                      <button
                        key={tag}
                        onClick={() => toggleTagFilter(tag)}
                        className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border ${
                          selectedTags.includes(tag)
                            ? 'bg-primary text-white border-primary'
                            : 'border-border text-muted-foreground hover:bg-muted'
                        }`}
                      >
                        <Tag className="w-3 h-3" />
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {activeFilterCount > 0 && (
                <button
                  onClick={clearFilters}
                  className="text-xs text-muted-foreground hover:text-foreground underline"
                >
                  Limpar filtros
                </button>
              )}
            </div>
          )}
        </div>

        {showForm && (
          <div className="bg-card border border-border rounded-2xl shadow-sm p-6 mb-8">
            <form onSubmit={handleAddProduct} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Nome *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    className="w-full px-4 py-2 border border-border rounded-xl bg-white text-foreground"
                    placeholder="Nome do produto"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">SKU</label>
                  <input
                    type="text"
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    className="w-full px-4 py-2 border border-border rounded-xl bg-white text-foreground"
                    placeholder="SKU-001"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Preço *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    required
                    className="w-full px-4 py-2 border border-border rounded-xl bg-white text-foreground"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Preço promocional
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.promotional_price}
                    onChange={(e) =>
                      setFormData({ ...formData, promotional_price: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-border rounded-xl bg-white text-foreground"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Categoria
                  </label>
                  <select
                    value={formData.category_id}
                    onChange={(e) => {
                      const id = e.target.value;
                      const cat = categories.find((c) => c.id === id);
                      setFormData({ ...formData, category_id: id, category: cat ? cat.name : '' });
                    }}
                    className="w-full px-4 py-2 border border-border rounded-xl bg-white text-foreground"
                  >
                    <option value="">Nenhuma categoria</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Tags (vírgula)
                  </label>
                  <input
                    type="text"
                    value={formData.tagsInput}
                    onChange={(e) => setFormData({ ...formData, tagsInput: e.target.value })}
                    className="w-full px-4 py-2 border border-border rounded-xl bg-white text-foreground"
                    placeholder="promoção, novo, destaque"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Link de compra
                  </label>
                  <input
                    type="url"
                    value={formData.purchase_url}
                    onChange={(e) => setFormData({ ...formData, purchase_url: e.target.value })}
                    className="w-full px-4 py-2 border border-border rounded-xl bg-white text-foreground"
                    placeholder="https://..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    URL da imagem
                  </label>
                  <input
                    type="url"
                    value={formData.image_url}
                    onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                    className="w-full px-4 py-2 border border-border rounded-xl bg-white text-foreground"
                    placeholder="https://..."
                  />
                </div>

              </div>

              <div>
                <p className="text-sm font-medium text-foreground mb-2">Este produto tem variação?</p>
                <div className="grid grid-cols-4 gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => setNewVariantType('none')}
                    className={`px-3 py-2 rounded-xl text-xs font-medium border ${
                      newVariantType === 'none'
                        ? 'bg-primary text-white border-primary'
                        : 'border-border text-foreground hover:bg-muted'
                    }`}
                  >
                    Não tem
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewVariantType('simple_size')}
                    className={`px-3 py-2 rounded-xl text-xs font-medium border ${
                      newVariantType === 'simple_size'
                        ? 'bg-primary text-white border-primary'
                        : 'border-border text-foreground hover:bg-muted'
                    }`}
                  >
                    Simples: tamanho
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewVariantType('simple_color')}
                    className={`px-3 py-2 rounded-xl text-xs font-medium border ${
                      newVariantType === 'simple_color'
                        ? 'bg-primary text-white border-primary'
                        : 'border-border text-foreground hover:bg-muted'
                    }`}
                  >
                    Simples: cor
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewVariantType('composite')}
                    className={`px-3 py-2 rounded-xl text-xs font-medium border ${
                      newVariantType === 'composite'
                        ? 'bg-primary text-white border-primary'
                        : 'border-border text-foreground hover:bg-muted'
                    }`}
                  >
                    Composta
                  </button>
                </div>

                {newVariantType !== 'none' && (
                  <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-xl">
                    {(newVariantType === 'simple_size' || newVariantType === 'composite') && (
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1">Tamanho</label>
                        <input
                          type="text"
                          value={formData.variant_size}
                          onChange={(e) => setFormData({ ...formData, variant_size: e.target.value })}
                          className="w-full px-4 py-2 border border-border rounded-xl bg-white text-foreground"
                          placeholder="ex: P, M, G"
                        />
                      </div>
                    )}
                    {(newVariantType === 'simple_color' || newVariantType === 'composite') && (
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1">Cor</label>
                        <input
                          type="text"
                          value={formData.variant_color}
                          onChange={(e) => setFormData({ ...formData, variant_color: e.target.value })}
                          className="w-full px-4 py-2 border border-border rounded-xl bg-white text-foreground"
                          placeholder="ex: Azul"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Descrição
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 border border-border rounded-xl bg-white text-foreground"
                  placeholder="Descrição do produto"
                  rows={3}
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2 btn-gradient font-medium"
                >
                  {submitting ? 'Adicionando...' : 'Adicionar'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-6 py-2 border border-border text-foreground rounded-lg font-medium hover:bg-background"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}

        {viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {loading ? (
              <>
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
              </>
            ) : filteredProducts.length === 0 ? (
              <div className="col-span-full">
                <div className="bg-card border border-border rounded-2xl shadow-sm p-12 text-center">
                  <PackageSearch className="w-16 h-16 text-muted-foreground/40 mx-auto mb-4" />
                  <p className="text-foreground font-medium mb-1">
                    {products.length === 0 ? 'Nenhum produto cadastrado' : 'Nenhum produto encontrado'}
                  </p>
                  <p className="text-sm text-muted-foreground mb-6">
                    {products.length === 0
                      ? 'Cadastre manualmente ou importe uma planilha para começar seu catálogo'
                      : 'Tente ajustar os filtros ou o termo de busca'}
                  </p>
                  {products.length === 0 && canManageProducts && (
                    <button
                      onClick={() => setShowForm(true)}
                      className="inline-flex items-center gap-2 px-6 py-2 btn-gradient font-medium"
                    >
                      <Plus className="w-4 h-4" />
                      Novo produto
                    </button>
                  )}
                </div>
              </div>
            ) : (
              filteredProducts.slice(0, visibleCount).map((product) => {
                const outOfStock = product.stock_quantity !== null && product.stock_quantity <= 0;
                return (
                <div
                  key={product.id}
                  onClick={() => setDetailProduct(product)}
                  className={`card-hover-glow bg-card border border-border rounded-2xl shadow-sm p-6 cursor-pointer ${
                    outOfStock ? 'border-l-4 border-l-destructive' : ''
                  }`}
                >
                  {product.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="w-full aspect-square object-cover rounded-xl mb-3 bg-muted"
                    />
                  )}

                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-lg font-semibold text-foreground line-clamp-2">
                      {product.name}
                    </h3>
                    {canManageProducts && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteProduct(product.id);
                      }}
                      className="p-1 text-destructive hover:bg-destructive/10 rounded flex-shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2 mb-2">
                    {product.category && (
                      <p className="text-xs text-muted-foreground">{product.category}</p>
                    )}
                    {product.purchase_url && (
                      <ExternalLink className="w-3 h-3 text-primary" />
                    )}
                  </div>

                  {product.description && (
                    <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                      {product.description}
                    </p>
                  )}

                  {(product.variant_size || product.variant_color) && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {product.variant_size && (
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">
                          Tam: {product.variant_size}
                        </span>
                      )}
                      {product.variant_color && (
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">
                          Cor: {product.variant_color}
                        </span>
                      )}
                    </div>
                  )}

                  {(product.tags || []).length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {(product.tags || []).map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full"
                        >
                          <Tag className="w-3 h-3" />
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex justify-between items-end">
                    <div>
                      {product.sku && (
                        <p className="text-xs text-muted-foreground">SKU: {product.sku}</p>
                      )}
                      {product.stock_quantity !== null && (
                        <p
                          className={`text-xs ${
                            product.stock_quantity > 0 ? 'text-muted-foreground' : 'text-destructive'
                          }`}
                        >
                          {product.stock_quantity > 0
                            ? `${product.stock_quantity} em estoque`
                            : 'Sem estoque'}
                        </p>
                      )}
                      {product.promotional_price ? (
                        <div className="flex items-baseline gap-2">
                          <p className="text-sm text-muted-foreground line-through">
                            R$ {product.price.toFixed(2)}
                          </p>
                          <p className="text-xl font-bold text-primary">
                            R$ {product.promotional_price.toFixed(2)}
                          </p>
                        </div>
                      ) : (
                        <p className="text-xl font-bold text-primary">
                          R$ {product.price.toFixed(2)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                );
              })
            )}
          </div>
        ) : (
          <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
            {loading ? (
              <div className="divide-y divide-border">
                <div className="p-2"><Skeleton className="h-14 w-full" /></div>
                <div className="p-2"><Skeleton className="h-14 w-full" /></div>
                <div className="p-2"><Skeleton className="h-14 w-full" /></div>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="p-12 text-center">
                <PackageSearch className="w-16 h-16 text-muted-foreground/40 mx-auto mb-4" />
                <p className="text-foreground font-medium mb-1">
                  {products.length === 0 ? 'Nenhum produto cadastrado' : 'Nenhum produto encontrado'}
                </p>
                <p className="text-sm text-muted-foreground mb-6">
                  {products.length === 0
                    ? 'Cadastre manualmente ou importe uma planilha para começar seu catálogo'
                    : 'Tente ajustar os filtros ou o termo de busca'}
                </p>
                {products.length === 0 && canManageProducts && (
                  <button
                    onClick={() => setShowForm(true)}
                    className="inline-flex items-center gap-2 px-6 py-2 btn-gradient font-medium"
                  >
                    <Plus className="w-4 h-4" />
                    Novo produto
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-foreground w-16">
                        Imagem
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-foreground">Nome</th>
                      <th className="px-4 py-3 text-left font-semibold text-foreground">
                        Categoria
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-foreground">Preço</th>
                      <th className="px-4 py-3 text-left font-semibold text-foreground">
                        Estoque
                      </th>
                      <th className="px-4 py-3 text-right font-semibold text-foreground">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredProducts.slice(0, visibleCount).map((product) => {
                      const outOfStock = product.stock_quantity !== null && product.stock_quantity <= 0;
                      return (
                      <tr
                        key={product.id}
                        onClick={() => setDetailProduct(product)}
                        className={`cursor-pointer hover:bg-primary/5 transition-colors duration-200 ${
                          outOfStock ? 'border-l-4 border-l-destructive' : ''
                        }`}
                      >
                        <td className="px-4 py-3">
                          {product.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={product.image_url}
                              alt={product.name}
                              className="w-12 h-12 rounded-lg object-cover bg-muted"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-lg bg-muted" />
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground line-clamp-1">
                              {product.name}
                            </span>
                            {product.purchase_url && (
                              <ExternalLink className="w-3 h-3 text-primary flex-shrink-0" />
                            )}
                          </div>
                          {(product.variant_size || product.variant_color) && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {product.variant_size && (
                                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">
                                  Tam: {product.variant_size}
                                </span>
                              )}
                              {product.variant_color && (
                                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">
                                  Cor: {product.variant_color}
                                </span>
                              )}
                            </div>
                          )}
                          {product.sku && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              SKU: {product.sku}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {product.category || '—'}
                        </td>
                        <td className="px-4 py-3">
                          {product.promotional_price ? (
                            <div className="flex items-baseline gap-2">
                              <span className="text-xs text-muted-foreground line-through">
                                R$ {product.price.toFixed(2)}
                              </span>
                              <span className="font-bold text-primary">
                                R$ {product.promotional_price.toFixed(2)}
                              </span>
                            </div>
                          ) : (
                            <span className="font-bold text-primary">
                              R$ {product.price.toFixed(2)}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {product.stock_quantity !== null ? (
                            <span
                              className={`text-xs ${
                                product.stock_quantity > 0
                                  ? 'text-muted-foreground'
                                  : 'text-destructive'
                              }`}
                            >
                              {product.stock_quantity > 0
                                ? `${product.stock_quantity} em estoque`
                                : 'Sem estoque'}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {canManageProducts && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteProduct(product.id);
                            }}
                            className="p-1 text-destructive hover:bg-destructive/10 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          )}
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {filteredProducts.length > visibleCount && (
          <div className="mt-4 text-center">
            <button
              onClick={() => setVisibleCount((v) => v + PAGE_SIZE)}
              className="px-6 py-2 border border-border rounded-xl font-medium text-sm text-foreground hover:bg-muted"
            >
              Carregar mais ({filteredProducts.length - visibleCount} restantes)
            </button>
          </div>
        )}
      </div>

      {detailProduct && workspaceId && (
        <ProductDetailModal
          product={detailProduct}
          workspaceId={workspaceId}
          categories={categories}
          readOnly={!canManageProducts}
          onClose={() => setDetailProduct(null)}
          onSaved={() => {
            setDetailProduct(null);
            loadProducts(workspaceId);
            loadCategories(workspaceId);
          }}
        />
      )}
    </div>
  );
}
