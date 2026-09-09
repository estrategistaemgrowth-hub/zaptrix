'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ensureWorkspace } from '@/lib/workspace';
import { Plus, Trash2, Tag } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  sku: string | null;
  description: string | null;
  price: number;
  promotional_price: number | null;
  category: string | null;
  tags: string[] | null;
  purchase_url: string | null;
  image_url: string | null;
  active: boolean;
}

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
    tagsInput: '',
    purchase_url: '',
    image_url: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    init();
  }, []);

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
      await loadProducts(workspace.workspaceId);
    } catch (err) {
      console.error('Erro ao carregar produtos:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadProducts(wsId: string) {
    const { data, error: loadError } = await supabase
      .from('products')
      .select('*')
      .eq('workspace_id', wsId)
      .order('created_at', { ascending: false });

    if (loadError) {
      setError('Erro ao carregar produtos: ' + loadError.message);
      return;
    }

    setProducts(data || []);
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
        tags,
        purchase_url: formData.purchase_url || null,
        image_url: formData.image_url || null,
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
      tagsInput: '',
      purchase_url: '',
      image_url: '',
    });
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

  return (
    <div className="p-2">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Produtos</h1>
            <p className="text-muted-foreground">Catálogo de produtos para recomendações</p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-6 py-2 bg-primary text-white rounded-lg font-medium hover:opacity-90"
          >
            <Plus className="w-4 h-4" />
            Novo produto
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

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
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-4 py-2 border border-border rounded-xl bg-white text-foreground"
                    placeholder="Categoria"
                  />
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
                  className="px-6 py-2 bg-primary text-white rounded-lg font-medium hover:opacity-90 disabled:opacity-50"
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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            <p className="text-muted-foreground">Carregando...</p>
          ) : products.length === 0 ? (
            <p className="text-muted-foreground">Nenhum produto cadastrado</p>
          ) : (
            products.map((product) => (
              <div
                key={product.id}
                className="bg-card border border-border rounded-2xl shadow-sm p-6 hover:shadow-lg transition-shadow"
              >
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-lg font-semibold text-foreground line-clamp-2">
                    {product.name}
                  </h3>
                  <button
                    onClick={() => handleDeleteProduct(product.id)}
                    className="p-1 text-destructive hover:bg-destructive/10 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {product.category && (
                  <p className="text-xs text-muted-foreground mb-2">{product.category}</p>
                )}

                {product.description && (
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                    {product.description}
                  </p>
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
            ))
          )}
        </div>
      </div>
    </div>
  );
}
