'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Ban, Edit2, FileText, Lock, Plus, Unlock } from 'lucide-react';
import { StatusBadge } from '@/components/status-badge';
import { QuotaBar } from '@/components/quota-bar';
import { SkeletonRow } from '@/components/skeleton';
import { EditPlanModal } from './edit-plan-modal';
import { InvoicesModal } from './invoices-modal';

interface Plan {
  id: string;
  name: string;
  price_cents: number;
  product_limit: number;
  member_limit: number;
}

interface Workspace {
  id: string;
  name: string;
  site_url: string | null;
  segment: string | null;
  owner_user_id: string;
  status: 'active' | 'suspended' | 'blocked';
  status_reason: string | null;
  plan_id: string | null;
  subscription_status: 'trial' | 'active' | 'overdue' | 'canceled';
  subscription_expires_at: string | null;
  created_at: string;
  plan: Plan | null;
  ownerEmail: string | null;
  productCount: number;
  memberCount: number;
}

const EMPTY_FORM = {
  name: '',
  siteUrl: '',
  segment: '',
  email: '',
  password: '',
  planId: '',
  expiresAt: '',
};

const STATUS_LABEL: Record<Workspace['status'], string> = {
  active: 'Ativo',
  suspended: 'Suspenso',
  blocked: 'Bloqueado',
};

function generateRandomPassword() {
  return Math.random().toString(36).slice(-8) + '!1';
}

/** Vencido = destaque forte, vence em até 7 dias = alerta, senão cor normal. */
function expiryClassName(expiresAt: string | null): string {
  if (!expiresAt) return 'text-muted-foreground';
  const diffDays = (new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  if (diffDays < 0) return 'text-destructive font-semibold';
  if (diffDays <= 7) return 'text-amber-600 font-semibold';
  return 'text-foreground';
}

export default function MasterAdminPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewForm, setShowNewForm] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editingWorkspace, setEditingWorkspace] = useState<Workspace | null>(null);
  const [invoicesWorkspace, setInvoicesWorkspace] = useState<Workspace | null>(null);
  const supabase = createClient();

  useEffect(() => {
    loadWorkspaces();
    loadPlans();
  }, []);

  async function loadWorkspaces() {
    setLoading(true);
    try {
      const res = await fetch('/api/master/workspaces');
      const result = await res.json();
      if (res.ok) {
        setWorkspaces(result.workspaces || []);
      }
    } catch (err) {
      console.error('Erro ao carregar lojistas:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadPlans() {
    const { data } = await supabase.from('plans').select('*').order('price_cents');
    setPlans(data || []);
  }

  async function handleCreateWorkspace(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFormError('');

    try {
      const res = await fetch('/api/master/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeName: formData.name,
          siteUrl: formData.siteUrl || undefined,
          segment: formData.segment || undefined,
          email: formData.email,
          password: formData.password,
          planId: formData.planId,
          expiresAt: formData.expiresAt,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        setFormError(result.error || 'Erro ao criar lojista');
        return;
      }

      setFormData(EMPTY_FORM);
      setShowNewForm(false);
      loadWorkspaces();
    } catch (err) {
      console.error('Erro:', err);
      setFormError('Erro inesperado ao criar lojista');
    } finally {
      setSubmitting(false);
    }
  }

  async function updateWorkspaceStatus(workspaceId: string, status: string, statusReason?: string) {
    try {
      await fetch('/api/master/workspaces', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId, status, statusReason }),
      });
      loadWorkspaces();
    } catch (err) {
      console.error('Erro ao atualizar status:', err);
    }
  }

  function toggleStatus(ws: Workspace) {
    const newStatus = ws.status === 'active' ? 'suspended' : 'active';
    updateWorkspaceStatus(ws.id, newStatus);
  }

  function handleBlock(ws: Workspace) {
    const reason = window.prompt('Motivo do bloqueio (obrigatório):');
    if (!reason || !reason.trim()) return;
    updateWorkspaceStatus(ws.id, 'blocked', reason.trim());
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Painel Master</h1>
            <p className="text-muted-foreground">Gerenciar lojistas, planos e faturas da plataforma</p>
          </div>
          <button
            onClick={() => setShowNewForm(!showNewForm)}
            className="flex items-center gap-2 px-6 py-2 btn-gradient font-medium"
          >
            <Plus className="w-4 h-4" />
            Novo lojista
          </button>
        </div>

        {showNewForm && (
          <div className="bg-card border border-border rounded-2xl p-6 mb-8 animate-fade-in">
            <form onSubmit={handleCreateWorkspace} className="space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Nome da loja *
                  </label>
                  <input
                    type="text"
                    placeholder="Sua Loja"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    className="w-full px-4 py-2 border border-border rounded-xl bg-white text-foreground"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Site (opcional)
                  </label>
                  <input
                    type="url"
                    placeholder="https://sualoja.com.br"
                    value={formData.siteUrl}
                    onChange={(e) => setFormData({ ...formData, siteUrl: e.target.value })}
                    className="w-full px-4 py-2 border border-border rounded-xl bg-white text-foreground"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Segmento (opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="ex: moda, beleza, eletrônicos"
                    value={formData.segment}
                    onChange={(e) => setFormData({ ...formData, segment: e.target.value })}
                    className="w-full px-4 py-2 border border-border rounded-xl bg-white text-foreground"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Email do lojista *
                  </label>
                  <input
                    type="email"
                    placeholder="dono@loja.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    className="w-full px-4 py-2 border border-border rounded-xl bg-white text-foreground"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Senha *</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      required
                      className="flex-1 px-4 py-2 border border-border rounded-xl bg-white text-foreground"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setFormData((f) => ({ ...f, password: generateRandomPassword() }))
                      }
                      className="px-3 py-2 border border-border rounded-xl text-sm font-medium text-foreground hover:bg-muted whitespace-nowrap"
                    >
                      Gerar senha
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">Plano *</label>
                    <select
                      value={formData.planId}
                      onChange={(e) => setFormData({ ...formData, planId: e.target.value })}
                      required
                      className="w-full px-4 py-2 border border-border rounded-xl bg-white text-foreground"
                    >
                      <option value="">Selecione</option>
                      {plans.map((plan) => (
                        <option key={plan.id} value={plan.id}>
                          {plan.name} — R$ {(plan.price_cents / 100).toFixed(2)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Vencimento *
                    </label>
                    <input
                      type="date"
                      value={formData.expiresAt}
                      onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
                      required
                      className="w-full px-4 py-2 border border-border rounded-xl bg-white text-foreground"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2 btn-gradient font-medium disabled:opacity-50"
                >
                  {submitting ? 'Criando...' : 'Criar lojista'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewForm(false)}
                  className="px-6 py-2 border border-border rounded-md font-medium text-foreground hover:bg-muted"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted">
                  <th className="px-6 py-4 text-left text-sm font-medium text-foreground">Lojista</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-foreground">Plano</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-foreground">Vencimento</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-foreground">Status</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-foreground">Uso</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-foreground">Ações</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-2 py-2">
                      <div className="space-y-1">
                        <SkeletonRow />
                        <SkeletonRow />
                        <SkeletonRow />
                      </div>
                    </td>
                  </tr>
                ) : workspaces.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">
                      Nenhum lojista cadastrado ainda
                    </td>
                  </tr>
                ) : (
                  workspaces.map((ws) => (
                    <tr key={ws.id} className="border-b border-border hover:bg-muted/50 align-top">
                      <td className="px-6 py-4">
                        <p className="text-sm font-medium text-foreground">{ws.name}</p>
                        <p className="text-xs text-muted-foreground">{ws.ownerEmail || '—'}</p>
                        {ws.segment && (
                          <p className="text-xs text-muted-foreground">{ws.segment}</p>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-foreground">
                        {ws.plan?.name || 'Sem plano'}
                      </td>
                      <td className={`px-6 py-4 text-sm ${expiryClassName(ws.subscription_expires_at)}`}>
                        {ws.subscription_expires_at
                          ? new Date(ws.subscription_expires_at).toLocaleDateString('pt-BR')
                          : '—'}
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge
                          label={STATUS_LABEL[ws.status]}
                          active={ws.status === 'active'}
                          tone={ws.status === 'blocked' ? 'destructive' : 'warning'}
                        />
                        {ws.status === 'blocked' && ws.status_reason && (
                          <p className="text-xs text-muted-foreground mt-1">{ws.status_reason}</p>
                        )}
                      </td>
                      <td className="px-6 py-4 min-w-[220px] space-y-2">
                        <QuotaBar
                          label="Produtos"
                          current={ws.productCount}
                          max={ws.plan?.product_limit ?? null}
                        />
                        <QuotaBar
                          label="Membros"
                          current={ws.memberCount}
                          max={ws.plan?.member_limit ?? null}
                        />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-1">
                          <button
                            onClick={() => toggleStatus(ws)}
                            title={ws.status === 'active' ? 'Suspender' : 'Ativar'}
                            className={`p-2 rounded-md transition-colors ${
                              ws.status === 'active'
                                ? 'text-warning hover:bg-warning/10'
                                : 'text-success hover:bg-success/10'
                            }`}
                          >
                            {ws.status === 'active' ? (
                              <Lock className="w-4 h-4" />
                            ) : (
                              <Unlock className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            onClick={() => handleBlock(ws)}
                            title="Bloquear"
                            className="p-2 rounded-md text-destructive hover:bg-destructive/10"
                          >
                            <Ban className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setEditingWorkspace(ws)}
                            title="Editar plano/vencimento"
                            className="p-2 rounded-md text-muted-foreground hover:bg-muted"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setInvoicesWorkspace(ws)}
                            title="Faturas"
                            className="p-2 rounded-md text-muted-foreground hover:bg-muted"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {editingWorkspace && (
        <EditPlanModal
          workspace={editingWorkspace}
          plans={plans}
          onClose={() => setEditingWorkspace(null)}
          onSaved={() => {
            setEditingWorkspace(null);
            loadWorkspaces();
          }}
        />
      )}

      {invoicesWorkspace && (
        <InvoicesModal
          workspaceId={invoicesWorkspace.id}
          workspaceName={invoicesWorkspace.name}
          onClose={() => setInvoicesWorkspace(null)}
        />
      )}
    </div>
  );
}
