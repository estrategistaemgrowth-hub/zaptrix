'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ensureWorkspace } from '@/lib/workspace';
import { Upload, Trash2, FileText, BookOpen, ToggleLeft, ToggleRight } from 'lucide-react';
import { SkeletonCard } from '@/components/skeleton';

interface KnowledgeEntry {
  id: string;
  title: string;
  category: string | null;
  content: string;
  active: boolean;
  created_at: string;
}

export default function ConhecimentoPage() {
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({ title: '', category: '', content: '' });
  const [submitting, setSubmitting] = useState(false);
  const [canManage, setCanManage] = useState(true);
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
      setCanManage(workspace.role === 'owner' || workspace.role === 'admin');
      await loadEntries(workspace.workspaceId);
    } catch (err) {
      console.error('Erro ao carregar entradas:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadEntries(wsId: string) {
    const { data, error: loadError } = await supabase
      .from('knowledge_entries')
      .select('*')
      .eq('workspace_id', wsId)
      .order('created_at', { ascending: false });

    if (loadError) {
      setError('Erro ao carregar base de conhecimento: ' + loadError.message);
      return;
    }

    setEntries(data || []);
  }

  async function handleAddEntry(e: React.FormEvent) {
    e.preventDefault();
    if (!workspaceId) return;

    setSubmitting(true);
    setError('');

    const { error: insertError } = await supabase.from('knowledge_entries').insert([
      {
        workspace_id: workspaceId,
        title: formData.title,
        category: formData.category || null,
        content: formData.content,
        active: true,
      },
    ]);

    if (insertError) {
      console.error('Erro ao criar entrada:', insertError);
      setError('Erro ao adicionar: ' + insertError.message);
      setSubmitting(false);
      return;
    }

    setFormData({ title: '', category: '', content: '' });
    setShowForm(false);
    setSubmitting(false);
    await loadEntries(workspaceId);
  }

  async function handleToggleActive(entry: KnowledgeEntry) {
    if (!workspaceId) return;

    const { error: updateError } = await supabase
      .from('knowledge_entries')
      .update({ active: !entry.active })
      .eq('id', entry.id);

    if (updateError) {
      alert('Erro ao atualizar: ' + updateError.message);
      return;
    }
    await loadEntries(workspaceId);
  }

  async function handleDeleteEntry(id: string) {
    if (!workspaceId || !confirm('Deletar esta entrada?')) return;

    const { error: deleteError } = await supabase.from('knowledge_entries').delete().eq('id', id);
    if (deleteError) {
      alert('Erro ao deletar: ' + deleteError.message);
      return;
    }
    await loadEntries(workspaceId);
  }

  return (
    <div className="p-2">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Base de Conhecimento</h1>
            <p className="text-muted-foreground">Conteúdo usado pela IA para responder clientes</p>
          </div>
          {canManage && (
            <button
              onClick={() => setShowForm(!showForm)}
              className="flex items-center gap-2 px-6 py-2 btn-gradient font-medium"
            >
              <Upload className="w-4 h-4" />
              Nova entrada
            </button>
          )}
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        {showForm && (
          <div className="bg-card border border-border rounded-2xl shadow-sm p-6 mb-8">
            <form onSubmit={handleAddEntry} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Título *
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                    className="w-full px-4 py-2 border border-border rounded-xl bg-white text-foreground"
                    placeholder="ex: Política de troca e devolução"
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
                    placeholder="ex: Políticas, FAQ, Produtos"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Conteúdo *
                </label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-border rounded-xl bg-white text-foreground font-mono text-sm"
                  placeholder="Escreva o conteúdo que a IA vai usar para responder os clientes..."
                  rows={8}
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
          {loading ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : entries.length === 0 ? (
            <div className="col-span-full">
              <div className="bg-card border border-border rounded-2xl shadow-sm p-12 text-center">
                <BookOpen className="w-16 h-16 text-muted-foreground/40 mx-auto mb-4" />
                <p className="text-foreground font-medium mb-1">Nenhuma entrada de conhecimento</p>
                <p className="text-sm text-muted-foreground mb-6">
                  Comece adicionando documentação para treinar a IA
                </p>
                {canManage && (
                  <button
                    onClick={() => setShowForm(true)}
                    className="inline-flex items-center gap-2 px-6 py-2 btn-gradient font-medium"
                  >
                    <Upload className="w-4 h-4" />
                    Nova entrada
                  </button>
                )}
              </div>
            </div>
          ) : (
            entries.map((entry) => (
              <div
                key={entry.id}
                className={`card-hover-glow bg-card border border-border rounded-2xl shadow-sm p-6 ${
                  !entry.active ? 'opacity-60' : ''
                }`}
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-start gap-3 flex-1">
                    <FileText className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-foreground line-clamp-2">
                        {entry.title}
                      </h3>
                      {entry.category && (
                        <p className="text-xs text-muted-foreground mt-1">{entry.category}</p>
                      )}
                    </div>
                  </div>
                  {canManage && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => handleToggleActive(entry)}
                        title={entry.active ? 'Desativar' : 'Ativar'}
                        className="p-1 text-muted-foreground hover:text-primary"
                      >
                        {entry.active ? (
                          <ToggleRight className="w-5 h-5 text-primary" />
                        ) : (
                          <ToggleLeft className="w-5 h-5" />
                        )}
                      </button>
                      <button
                        onClick={() => handleDeleteEntry(entry.id)}
                        className="p-1 text-destructive hover:bg-destructive/10 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                <p className="text-sm text-muted-foreground line-clamp-3 mb-3">{entry.content}</p>

                <p className="text-xs text-muted-foreground">
                  {new Date(entry.created_at).toLocaleDateString('pt-BR')}
                  {!entry.active && ' · inativo (a IA ignora este conteúdo)'}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
