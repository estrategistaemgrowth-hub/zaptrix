'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Plus, Trash2, Shield } from 'lucide-react';

interface WorkspaceMember {
  id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'atendente';
  created_at: string;
}

export default function ConfiguracoesPage() {
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<'admin' | 'atendente'>('atendente');
  const [submitting, setSubmitting] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    loadMembers();
  }, []);

  async function loadMembers() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const { data: workspace } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', session.user.id)
        .single();

      if (!workspace) return;

      const { data } = await supabase
        .from('workspace_members')
        .select('*')
        .eq('workspace_id', workspace.workspace_id)
        .order('created_at');

      setMembers(data || []);
    } catch (err) {
      console.error('Erro ao carregar membros:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const { data: workspace } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', session.user.id)
        .single();

      if (!workspace) return;

      // Criar usuário via auth
      const { data: newUser, error: authError } = await supabase.auth.signUp({
        email: newMemberEmail,
        password: Math.random().toString(36).slice(-8),
      });

      if (authError || !newUser.user) {
        alert('Erro ao criar usuário: ' + (authError?.message || 'Desconhecido'));
        return;
      }

      // Adicionar como membro
      await supabase
        .from('workspace_members')
        .insert([
          {
            workspace_id: workspace.workspace_id,
            user_id: newUser.user.id,
            role: newMemberRole,
          },
        ]);

      setNewMemberEmail('');
      loadMembers();
    } catch (err) {
      console.error('Erro:', err);
      alert('Erro ao adicionar membro');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemoveMember(memberId: string) {
    if (!confirm('Remover este membro?')) return;

    try {
      await supabase
        .from('workspace_members')
        .delete()
        .eq('id', memberId);

      loadMembers();
    } catch (err) {
      console.error('Erro:', err);
    }
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-foreground mb-8">Configurações</h1>

        <div className="bg-card border border-border rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold text-foreground mb-6">Gerenciar Membros</h2>

          <form onSubmit={handleAddMember} className="mb-8 p-4 bg-muted rounded-lg">
            <div className="grid gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Email do novo membro
                </label>
                <input
                  type="email"
                  value={newMemberEmail}
                  onChange={(e) => setNewMemberEmail(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-border rounded-md bg-input text-foreground"
                  placeholder="membro@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Função
                </label>
                <select
                  value={newMemberRole}
                  onChange={(e) => setNewMemberRole(e.target.value as 'admin' | 'atendente')}
                  className="w-full px-4 py-2 border border-border rounded-md bg-input text-foreground"
                >
                  <option value="atendente">Atendente (só chat)</option>
                  <option value="admin">Admin (acesso completo)</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground rounded-md font-medium hover:opacity-90 disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              {submitting ? 'Adicionando...' : 'Adicionar membro'}
            </button>
          </form>

          <div className="space-y-2">
            {loading ? (
              <p className="text-muted-foreground">Carregando...</p>
            ) : members.length === 0 ? (
              <p className="text-muted-foreground">Nenhum membro no workspace</p>
            ) : (
              members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-4 border border-border rounded-md bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <Shield className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-foreground">User {member.user_id.slice(0, 8)}</p>
                      <p className="text-sm text-muted-foreground">
                        {member.role === 'owner' ? '👑 Owner' : member.role === 'admin' ? '🔐 Admin' : '👤 Atendente'}
                      </p>
                    </div>
                  </div>
                  {member.role !== 'owner' && (
                    <button
                      onClick={() => handleRemoveMember(member.id)}
                      className="p-2 text-destructive hover:bg-destructive/10 rounded-md"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-xl font-semibold text-foreground mb-4">Sobre o Workspace</h2>
          <div className="space-y-4 text-muted-foreground">
            <p>📱 <strong>WhatsApp:</strong> Configure sua conexão Evolution API em breve</p>
            <p>🤖 <strong>IA:</strong> Personalize seu agente de atendimento</p>
            <p>📚 <strong>Conhecimento:</strong> Treinar a IA com sua base de dados</p>
          </div>
        </div>
      </div>
    </div>
  );
}
