'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Plus, Edit2, Lock, Unlock } from 'lucide-react';

interface Workspace {
  id: string;
  name: string;
  owner_user_id: string;
  status: 'active' | 'suspended' | 'blocked';
  created_at: string;
}

export default function MasterAdminPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewForm, setShowNewForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '' });
  const [submitting, setSubmitting] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    loadWorkspaces();
  }, []);

  async function loadWorkspaces() {
    try {
      const { data } = await supabase
        .from('workspaces')
        .select('*')
        .order('created_at', { ascending: false });

      setWorkspaces(data || []);
    } catch (err) {
      console.error('Erro ao carregar lojistas:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateWorkspace(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    try {
      // Step 1: Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: Math.random().toString(36).slice(-8),
      });

      if (authError || !authData.user) {
        alert('Erro ao criar usuário: ' + (authError?.message || 'Desconhecido'));
        return;
      }

      // Step 2: Create workspace
      const { data: workspace, error: wsError } = await supabase
        .from('workspaces')
        .insert([
          {
            name: formData.name,
            owner_user_id: authData.user.id,
            status: 'active',
          },
        ])
        .select()
        .single();

      if (wsError || !workspace) {
        alert('Erro ao criar workspace: ' + (wsError?.message || 'Desconhecido'));
        return;
      }

      // Step 3: Add owner as workspace member
      await supabase
        .from('workspace_members')
        .insert([
          {
            workspace_id: workspace.id,
            user_id: authData.user.id,
            role: 'owner',
          },
        ]);

      setFormData({ name: '', email: '' });
      setShowNewForm(false);
      loadWorkspaces();
    } catch (err) {
      console.error('Erro:', err);
      alert('Erro ao criar lojista');
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleStatus(workspaceId: string, currentStatus: string) {
    const newStatus = currentStatus === 'active' ? 'suspended' : 'active';

    try {
      await supabase
        .from('workspaces')
        .update({ status: newStatus })
        .eq('id', workspaceId);

      loadWorkspaces();
    } catch (err) {
      console.error('Erro ao atualizar status:', err);
    }
  }

  const statusBadge = (status: string) => {
    const colors = {
      active: 'bg-success/10 text-success',
      suspended: 'bg-warning/10 text-warning',
      blocked: 'bg-destructive/10 text-destructive',
    };
    return colors[status as keyof typeof colors] || colors.active;
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Painel Master</h1>
            <p className="text-muted-foreground">Gerenciar lojistas e acessos da plataforma</p>
          </div>
          <button
            onClick={() => setShowNewForm(!showNewForm)}
            className="flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground rounded-md font-medium hover:opacity-90"
          >
            <Plus className="w-4 h-4" />
            Novo lojista
          </button>
        </div>

        {showNewForm && (
          <div className="bg-card border border-border rounded-lg p-6 mb-8">
            <form onSubmit={handleCreateWorkspace} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Nome do negócio
                </label>
                <input
                  type="text"
                  placeholder="Sua Loja"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-border rounded-md bg-input text-foreground"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Email do proprietário
                </label>
                <input
                  type="email"
                  placeholder="dono@loja.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-border rounded-md bg-input text-foreground"
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2 bg-primary text-primary-foreground rounded-md font-medium hover:opacity-90 disabled:opacity-50"
                >
                  {submitting ? 'Criando...' : 'Criar'}
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
                  <th className="px-6 py-4 text-left text-sm font-medium text-foreground">Status</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-foreground">Data</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-foreground">Ações</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">
                      Carregando...
                    </td>
                  </tr>
                ) : workspaces.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">
                      Nenhum lojista cadastrado ainda
                    </td>
                  </tr>
                ) : (
                  workspaces.map((ws) => (
                    <tr key={ws.id} className="border-b border-border hover:bg-muted/50">
                      <td className="px-6 py-4 text-sm font-medium text-foreground">{ws.name}</td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusBadge(ws.status)}`}>
                          {ws.status === 'active' ? 'Ativo' : ws.status === 'suspended' ? 'Suspenso' : 'Bloqueado'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {new Date(ws.created_at).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-6 py-4 flex gap-2">
                        <button
                          onClick={() => toggleStatus(ws.id, ws.status)}
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
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
