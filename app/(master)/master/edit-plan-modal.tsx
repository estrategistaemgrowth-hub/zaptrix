'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface Plan {
  id: string;
  name: string;
  price_cents: number;
  product_limit: number;
  member_limit: number;
}

interface WorkspaceLite {
  id: string;
  name: string;
  plan_id: string | null;
  subscription_expires_at: string | null;
}

interface Props {
  workspace: WorkspaceLite;
  plans: Plan[];
  onClose: () => void;
  onSaved: () => void;
}

/**
 * Edição de plano + vencimento de um workspace. Portal pra `document.body`:
 * `.animate-fade-in` (globals.css) tem `transform` no keyframe, o que quebra
 * a centralização de `position: fixed` quando o modal é renderizado dentro
 * de um wrapper com essa classe — mesmo padrão de whatsapp-qr-modal.tsx.
 */
export function EditPlanModal({ workspace, plans, onClose, onSaved }: Props) {
  const [mounted, setMounted] = useState(false);
  const [planId, setPlanId] = useState(workspace.plan_id || '');
  const [expiresAt, setExpiresAt] = useState(
    workspace.subscription_expires_at ? workspace.subscription_expires_at.slice(0, 10) : ''
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setMounted(true);
  }, []);

  async function handleSave() {
    setSaving(true);
    setError('');

    try {
      const res = await fetch('/api/master/workspaces', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: workspace.id,
          planId: planId || null,
          expiresAt: expiresAt || null,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        setError(result.error || 'Erro ao salvar');
        return;
      }

      onSaved();
    } catch (err) {
      setError('Erro inesperado ao salvar');
    } finally {
      setSaving(false);
    }
  }

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 animate-backdrop-in">
      <div className="bg-card rounded-2xl shadow-lg w-full max-w-md animate-modal-in">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-semibold text-foreground">Plano e vencimento</h2>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-muted-foreground">{workspace.name}</p>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Plano</label>
            <select
              value={planId}
              onChange={(e) => setPlanId(e.target.value)}
              className="w-full px-4 py-2 border border-border rounded-xl bg-white text-foreground"
            >
              <option value="">Sem plano</option>
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name} — R$ {(plan.price_cents / 100).toFixed(2)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Vencimento</label>
            <input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="w-full px-4 py-2 border border-border rounded-xl bg-white text-foreground"
            />
          </div>
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
