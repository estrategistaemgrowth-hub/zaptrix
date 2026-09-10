'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { createClient } from '@/lib/supabase/client';
import { X, Upload, ExternalLink, Loader2, Image as ImageIcon, Sparkles } from 'lucide-react';

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
  variant_size?: string | null;
  variant_color?: string | null;
  active: boolean;
}

interface Category {
  id: string;
  name: string;
}

interface Props {
  product: Product;
  workspaceId: string;
  categories: Category[];
  onClose: () => void;
  onSaved: () => void;
  /** Atendente só visualiza — edição/exclusão de produto é owner/admin por RLS
   *  (products UPDATE/DELETE), então aqui só desabilitamos os campos pra não
   *  deixar a pessoa tentar salvar e esbarrar num erro cru de RLS. */
  readOnly?: boolean;
}

export function ProductDetailModal({ product, workspaceId, categories, onClose, onSaved, readOnly = false }: Props) {
  const [form, setForm] = useState({
    name: product.name,
    sku: product.sku || '',
    description: product.description || '',
    price: String(product.price),
    promotional_price: product.promotional_price !== null ? String(product.promotional_price) : '',
    category: product.category || '',
    category_id: product.category_id || '',
    tagsInput: (product.tags || []).join(', '),
    purchase_url: product.purchase_url || '',
    image_url: product.image_url || '',
    stock_quantity:
      product.stock_quantity !== null && product.stock_quantity !== undefined
        ? String(product.stock_quantity)
        : '',
    variant_size: product.variant_size || '',
    variant_color: product.variant_color || '',
    active: product.active,
  });
  const [variantType, setVariantType] = useState<'none' | 'simple_size' | 'simple_color' | 'composite'>(
    product.variant_size && product.variant_color
      ? 'composite'
      : product.variant_size
      ? 'simple_size'
      : product.variant_color
      ? 'simple_color'
      : 'none'
  );
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [generatingDescription, setGeneratingDescription] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  async function handleGenerateDescription() {
    setGeneratingDescription(true);
    setError('');

    try {
      const res = await fetch('/api/ai/generate-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName: form.name,
          category: form.category,
          currentDescription: form.description,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        setError(result.error || 'Erro ao gerar descrição');
        return;
      }

      setForm((f) => ({ ...f, description: result.description }));
    } catch (err) {
      setError('Erro inesperado ao gerar descrição');
    } finally {
      setGeneratingDescription(false);
    }
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    setError('');

    const ext = file.name.split('.').pop() || 'jpg';
    const path = `${workspaceId}/${product.id}-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('product-images')
      .upload(path, file, { upsert: true });

    if (uploadError) {
      setError('Erro ao enviar imagem: ' + uploadError.message);
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const { data } = supabase.storage.from('product-images').getPublicUrl(path);
    setForm((f) => ({ ...f, image_url: data.publicUrl }));
    setUploadingImage(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleSave() {
    setSaving(true);
    setError('');

    const tags = form.tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const selectedCategory = categories.find((c) => c.id === form.category_id);

    const { error: updateError } = await supabase
      .from('products')
      .update({
        name: form.name,
        sku: form.sku || null,
        description: form.description || null,
        price: parseFloat(form.price),
        promotional_price: form.promotional_price ? parseFloat(form.promotional_price) : null,
        category: selectedCategory ? selectedCategory.name : null,
        category_id: form.category_id || null,
        tags,
        purchase_url: form.purchase_url || null,
        image_url: form.image_url || null,
        stock_quantity: form.stock_quantity ? parseInt(form.stock_quantity, 10) : null,
        variant_size:
          variantType === 'simple_size' || variantType === 'composite'
            ? form.variant_size || null
            : null,
        variant_color:
          variantType === 'simple_color' || variantType === 'composite'
            ? form.variant_color || null
            : null,
        active: form.active,
      })
      .eq('id', product.id);

    if (updateError) {
      setError('Erro ao salvar: ' + updateError.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    onSaved();
  }

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 animate-backdrop-in">
      <div className="bg-card rounded-2xl shadow-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-modal-in">
        <div className="flex items-center justify-between p-6 border-b border-border sticky top-0 bg-card rounded-t-2xl">
          <h2 className="text-xl font-semibold text-foreground">
            {readOnly ? 'Produto' : 'Editar produto'}
          </h2>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        {readOnly && (
          <div className="mx-6 mt-4 p-3 bg-muted rounded-xl text-sm text-muted-foreground">
            Apenas visualização — editar produtos é restrito a donos e administradores.
          </div>
        )}

        <fieldset disabled={readOnly} className="contents">
        <div className="p-6 space-y-5">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          <div>
            <p className="text-sm font-medium text-foreground mb-2">Foto do produto</p>
            <div className="flex items-center gap-4">
              <div className="w-24 h-24 rounded-2xl border border-border bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                {form.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={form.image_url} alt={form.name} className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="w-8 h-8 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingImage}
                  className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted disabled:opacity-50"
                >
                  {uploadingImage ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  {uploadingImage ? 'Enviando...' : 'Enviar foto'}
                </button>
                <p className="text-xs text-muted-foreground mt-2">
                  A IA usa esta foto para enviar ao cliente no WhatsApp
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Nome *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-4 py-2 border border-border rounded-xl bg-white text-foreground"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">SKU</label>
              <input
                type="text"
                value={form.sku}
                onChange={(e) => setForm({ ...form, sku: e.target.value })}
                className="w-full px-4 py-2 border border-border rounded-xl bg-white text-foreground"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Preço *</label>
              <input
                type="number"
                step="0.01"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                className="w-full px-4 py-2 border border-border rounded-xl bg-white text-foreground"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Preço promocional
              </label>
              <input
                type="number"
                step="0.01"
                value={form.promotional_price}
                onChange={(e) => setForm({ ...form, promotional_price: e.target.value })}
                className="w-full px-4 py-2 border border-border rounded-xl bg-white text-foreground"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Estoque</label>
              <input
                type="number"
                value={form.stock_quantity}
                onChange={(e) => setForm({ ...form, stock_quantity: e.target.value })}
                className="w-full px-4 py-2 border border-border rounded-xl bg-white text-foreground"
                placeholder="Deixe vazio se não controla estoque"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Categoria</label>
              <select
                value={form.category_id}
                onChange={(e) => {
                  const id = e.target.value;
                  const cat = categories.find((c) => c.id === id);
                  setForm({ ...form, category_id: id, category: cat ? cat.name : '' });
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
          </div>

          <div>
            <p className="text-sm font-medium text-foreground mb-2">Este produto tem variação?</p>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <button
                type="button"
                onClick={() => setVariantType('none')}
                className={`px-4 py-2 rounded-xl text-sm font-medium border ${
                  variantType === 'none'
                    ? 'bg-primary text-white border-primary'
                    : 'border-border text-foreground hover:bg-muted'
                }`}
              >
                Não tem variação
              </button>
              <button
                type="button"
                onClick={() => setVariantType((v) => (v === 'none' ? 'simple_size' : v))}
                className={`px-4 py-2 rounded-xl text-sm font-medium border ${
                  variantType !== 'none'
                    ? 'bg-primary text-white border-primary'
                    : 'border-border text-foreground hover:bg-muted'
                }`}
              >
                Tem variação
              </button>
            </div>

            {variantType !== 'none' && (
              <div className="p-4 bg-muted rounded-xl space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setVariantType('simple_size')}
                    className={`px-3 py-2 rounded-lg text-xs font-medium border ${
                      variantType === 'simple_size' || variantType === 'simple_color'
                        ? 'bg-white text-primary border-primary'
                        : 'border-border text-muted-foreground hover:bg-white'
                    }`}
                  >
                    Simples (só tamanho OU só cor)
                  </button>
                  <button
                    type="button"
                    onClick={() => setVariantType('composite')}
                    className={`px-3 py-2 rounded-lg text-xs font-medium border ${
                      variantType === 'composite'
                        ? 'bg-white text-primary border-primary'
                        : 'border-border text-muted-foreground hover:bg-white'
                    }`}
                  >
                    Composta (tamanho E cor)
                  </button>
                </div>

                {(variantType === 'simple_size' || variantType === 'simple_color') && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setVariantType('simple_size')}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium ${
                        variantType === 'simple_size'
                          ? 'bg-primary text-white'
                          : 'bg-white text-muted-foreground border border-border'
                      }`}
                    >
                      Por tamanho
                    </button>
                    <button
                      type="button"
                      onClick={() => setVariantType('simple_color')}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium ${
                        variantType === 'simple_color'
                          ? 'bg-primary text-white'
                          : 'bg-white text-muted-foreground border border-border'
                      }`}
                    >
                      Por cor
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  {(variantType === 'simple_size' || variantType === 'composite') && (
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Tamanho</label>
                      <input
                        type="text"
                        value={form.variant_size}
                        onChange={(e) => setForm({ ...form, variant_size: e.target.value })}
                        className="w-full px-4 py-2 border border-border rounded-xl bg-white text-foreground"
                        placeholder="ex: P, M, G, Único"
                      />
                    </div>
                  )}
                  {(variantType === 'simple_color' || variantType === 'composite') && (
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Cor</label>
                      <input
                        type="text"
                        value={form.variant_color}
                        onChange={(e) => setForm({ ...form, variant_color: e.target.value })}
                        className="w-full px-4 py-2 border border-border rounded-xl bg-white text-foreground"
                        placeholder="ex: Azul"
                      />
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Cada combinação vira um produto separado (com seu próprio SKU e estoque), igual
                  na planilha.
                </p>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Tags (separadas por vírgula)
            </label>
            <input
              type="text"
              value={form.tagsInput}
              onChange={(e) => setForm({ ...form, tagsInput: e.target.value })}
              className="w-full px-4 py-2 border border-border rounded-xl bg-white text-foreground"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Link do produto (loja/checkout)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="url"
                value={form.purchase_url}
                onChange={(e) => setForm({ ...form, purchase_url: e.target.value })}
                className="w-full px-4 py-2 border border-border rounded-xl bg-white text-foreground"
                placeholder="https://sualoja.com.br/produto"
              />
              {form.purchase_url && (
                <a
                  href={form.purchase_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 text-primary hover:bg-primary/10 rounded-lg flex-shrink-0"
                  title="Abrir link"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              A IA envia este link quando o cliente quer comprar
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-foreground">Descrição</label>
              <button
                type="button"
                onClick={handleGenerateDescription}
                disabled={generatingDescription || !form.name}
                className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-primary bg-primary/10 rounded-full hover:bg-primary/20 disabled:opacity-50"
              >
                {generatingDescription ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Sparkles className="w-3 h-3" />
                )}
                {generatingDescription
                  ? 'Gerando...'
                  : form.description
                  ? 'Melhorar com IA'
                  : 'Gerar com IA'}
              </button>
            </div>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={4}
              className="w-full px-4 py-2 border border-border rounded-xl bg-white text-foreground"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
              className="w-4 h-4"
            />
            Produto ativo (aparece nas recomendações da IA)
          </label>
        </div>
        </fieldset>

        <div className="flex gap-3 p-6 border-t border-border sticky bottom-0 bg-card rounded-b-2xl">
          {!readOnly && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2 btn-gradient font-medium disabled:opacity-50"
            >
              {saving ? 'Salvando...' : 'Salvar alterações'}
            </button>
          )}
          <button
            onClick={onClose}
            className="px-6 py-2 border border-border text-foreground rounded-lg font-medium hover:bg-background"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
