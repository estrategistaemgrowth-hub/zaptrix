'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface Plan {
  id: string;
  name: string;
  price_cents: number;
  product_limit: number;
  member_limit: number;
}

interface Props {
  plans: Plan[];
  onClose: () => void;
  onSaved: () => void;
}

/**
 * Edita preço/limites do catálogo fixo de planos (3 linhas seedadas na
 * migration 0024). Grava direto via client-side supabase — a policy
 * "plans_write_platform_admin" (0024_plans_and_billing.sql) já libera
 * escrita pra quem é is_platform_admin(), sem precisar de rota de API.
 * Portal pra document.body: mesmo motivo de todos os outros modais do
 * projeto (transform no keyframe de .animate-fade-in quebra position:fixed).
 */
export function EditPlansModal({ plans, onClose, onSaved }: Props) {
  const [draft, setDraft] = useState<Plan[]>(plans.map((p) => ({ ...p })));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const supabase = createClient();

  function updateField(id: string, field: keyof Plan, value: string) {
    setDraft((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: field === 'name' ? value : Number(value) || 0 } : p))
    );
  }

  async function handleSave() {
    setSaving(true);
    setError('');

    try {
      for (const plan of draft) {
        const { error: updateError } = await supabase
          .from('plans')
          .update({
            name: plan.name,
            price_cents: plan.price_cents,
            product_limit: plan.product_limit,
            member_limit: plan.member_limit,
          })
          .eq('id', plan.id);

        if (updateError) {
          setError(updateError.message);
          return;
        }
      }

      onSaved();
    } catch (err) {
      console.error('Erro ao salvar planos:', err);
      setError('Erro inesperado ao salvar');
    } finally {
      setSaving(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 animate-backdrop-in">
      <div className="bg-card rounded-2xl shadow-lg w-full max-w-2xl animate-modal-in max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-semibold text-foreground">Editar catálogo de planos</h2>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-muted-foreground">
            Alterar aqui não muda o plano de lojistas já cadastrados (fica preso ao valor combinado)
            — só afeta o que aparece pra novos cadastros a partir de agora.
          </p>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
          )}

          {draft.map((plan) => (
            <div key={plan.id} className="border border-border rounded-xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="col-span-2 sm:col-span-4">
                <label className="block text-xs font-medium text-foreground mb-1">Nome</label>
                <input
                  type="text"
                  value={plan.name}
                  onChange={(e) => updateField(plan.id, 'name', e.target.value)}
                  className="w-full px-3 py-1.5 border border-border rounded-lg bg-white text-foreground text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Preço (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  value={(plan.price_cents / 100).toFixed(2)}
                  onChange={(e) => updateField(plan.id, 'price_cents', String(Math.round(Number(e.target.value) * 100)))}
                  className="w-full px-3 py-1.5 border border-border rounded-lg bg-white text-foreground text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Limite de produtos</label>
                <input
                  type="number"
                  value={plan.product_limit}
                  onChange={(e) => updateField(plan.id, 'product_limit', e.target.value)}
                  className="w-full px-3 py-1.5 border border-border rounded-lg bg-white text-foreground text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Limite de usuários</label>
                <input
                  type="number"
                  value={plan.member_limit}
                  onChange={(e) => updateField(plan.id, 'member_limit', e.target.value)}
                  className="w-full px-3 py-1.5 border border-border rounded-lg bg-white text-foreground text-sm"
                />
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-3 p-6 border-t border-border">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 btn-gradient font-medium disabled:opacity-50"
          >
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
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
