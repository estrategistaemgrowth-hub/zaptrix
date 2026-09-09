'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ensureWorkspace } from '@/lib/workspace';
import { Plus, Trash2, Crown, ShieldCheck, UserRound, Smartphone, Zap, BookOpen, Copy, Check } from 'lucide-react';

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
  const [error, setError] = useState('');
  const [createdCredential, setCreatedCredential] = useState<{ email: string; tempPassword: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    loadMembers();
  }, []);

  async function loadMembers() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const workspace = await ensureWorkspace(supabase, session.user.id, session.user.email);
      if (!workspace) {
        setError('Não foi possível carregar seu workspace.');
        setLoading(false);
        return;
      }

      const { data, error: loadError } = await supabase
        .from('workspace_members')
        .select('*')
        .eq('workspace_id', workspace.workspaceId)
        .order('created_at');

      if (loadError) {
        setError('Erro ao carregar membros: ' + loadError.message);
        return;
      }

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
    setError('');
    setCreatedCredential(null);

    try {
      const res = await fetch('/api/workspace/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newMemberEmail, role: newMemberRole }),
      });

      const result = await res.json();

      if (!res.ok) {
        setError(result.error || 'Erro ao adicionar membro');
        setSubmitting(false);
        return;
      }

      setCreatedCredential({ email: result.email, tempPassword: result.tempPassword });
      setNewMemberEmail('');
      await loadMembers();
    } catch (err) {
      console.error('Erro:', err);
      setError('Erro inesperado ao adicionar membro');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemoveMember(memberId: string) {
    if (!confirm('Remover este membro?')) return;

    const { error: deleteError } = await supabase.from('workspace_members').delete().eq('id', memberId);
    if (deleteError) {
      alert('Erro ao remover: ' + deleteError.message);
      return;
    }
    await loadMembers();
  }

  function handleCopyCredential() {
    if (!createdCredential) return;
    const text = `Email: ${createdCredential.email}\nSenha temporária: ${createdCredential.tempPassword}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="p-2">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-foreground mb-8">Configurações</h1>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="bg-card border border-border rounded-2xl shadow-sm p-6 mb-8">
          <h2 className="text-xl font-semibold text-foreground mb-6">Gerenciar Membros</h2>

          <form onSubmit={handleAddMember} className="mb-6 p-4 bg-muted rounded-xl">
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
                  className="w-full px-4 py-2 border border-border rounded-xl bg-white text-foreground"
                  placeholder="membro@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Função</label>
                <select
                  value={newMemberRole}
                  onChange={(e) => setNewMemberRole(e.target.value as 'admin' | 'atendente')}
                  className="w-full px-4 py-2 border border-border rounded-xl bg-white text-foreground"
                >
                  <option value="atendente">Atendente (só atendimento)</option>
                  <option value="admin">Admin (acesso completo)</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 px-6 py-2 bg-primary text-white rounded-xl font-medium hover:opacity-90 disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              {submitting ? 'Adicionando...' : 'Adicionar membro'}
            </button>
          </form>

          {createdCredential && (
            <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
              <p className="text-sm text-emerald-900 mb-2">
                Membro criado! Compartilhe estas credenciais temporárias com ele:
              </p>
              <div className="flex items-center justify-between gap-3 bg-white border border-emerald-200 rounded-lg p-3">
                <div className="text-sm font-mono text-foreground">
                  <p>{createdCredential.email}</p>
                  <p>{createdCredential.tempPassword}</p>
                </div>
                <button
                  onClick={handleCopyCredential}
                  className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white text-xs rounded-lg hover:opacity-90"
                >
                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copied ? 'Copiado' : 'Copiar'}
                </button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {loading ? (
              <p className="text-muted-foreground">Carregando...</p>
            ) : members.length === 0 ? (
              <p className="text-muted-foreground">Nenhum membro no workspace</p>
            ) : (
              members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-4 border border-border rounded-xl bg-muted"
                >
                  <div className="flex items-center gap-3">
                    {member.role === 'owner' ? (
                      <Crown className="w-4 h-4 text-amber-500" />
                    ) : member.role === 'admin' ? (
                      <ShieldCheck className="w-4 h-4 text-primary" />
                    ) : (
                      <UserRound className="w-4 h-4 text-muted-foreground" />
                    )}
                    <div>
                      <p className="font-medium text-foreground">User {member.user_id.slice(0, 8)}</p>
                      <p className="text-sm text-muted-foreground">
                        {member.role === 'owner'
                          ? 'Proprietário'
                          : member.role === 'admin'
                          ? 'Administrador'
                          : 'Atendente'}
                      </p>
                    </div>
                  </div>
                  {member.role !== 'owner' && (
                    <button
                      onClick={() => handleRemoveMember(member.id)}
                      className="p-2 text-destructive hover:bg-destructive/10 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl shadow-sm p-6 space-y-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Smartphone className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-semibold text-foreground">WhatsApp</h3>
            </div>
            <p className="text-sm text-muted-foreground">Configure sua conexão Evolution API na aba WhatsApp</p>
          </div>

          <hr className="border-border" />

          <div>
            <div className="flex items-center gap-3 mb-2">
              <Zap className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-semibold text-foreground">Inteligência Artificial</h3>
            </div>
            <p className="text-sm text-muted-foreground">Personalize seu agente de atendimento automático</p>
          </div>

          <hr className="border-border" />

          <div>
            <div className="flex items-center gap-3 mb-2">
              <BookOpen className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-semibold text-foreground">Base de Conhecimento</h3>
            </div>
            <p className="text-sm text-muted-foreground">Treinar a IA com sua base de dados de produtos e serviços</p>
          </div>
        </div>
      </div>
    </div>
  );
}
