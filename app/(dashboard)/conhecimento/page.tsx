'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ensureWorkspace } from '@/lib/workspace';
import { Upload, Trash2, FileText, BookOpen, ToggleLeft, ToggleRight, Link2, RefreshCw, Loader2 } from 'lucide-react';
import { SkeletonCard } from '@/components/skeleton';

interface KnowledgeEntry {
  id: string;
  title: string;
  category: string | null;
  content: string;
  active: boolean;
  created_at: string;
  source_url: string | null;
  source_fetched_at: string | null;
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
  const [addMode, setAddMode] = useState<'manual' | 'url'>('manual');
  const [sourceUrl, setSourceUrl] = useState('');
  const [fetchingUrl, setFetchingUrl] = useState(false);
  const [urlError, setUrlError] = useState('');
  const [pendingSourceUrl, setPendingSourceUrl] = useState<string | null>(null);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
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
        source_url: pendingSourceUrl,
        source_fetched_at: pendingSourceUrl ? new Date().toISOString() : null,
      },
    ]);

    if (insertError) {
      console.error('Erro ao criar entrada:', insertError);
      setError('Erro ao adicionar: ' + insertError.message);
      setSubmitting(false);
      return;
    }

    setFormData({ title: '', category: '', content: '' });
    setPendingSourceUrl(null);
    setSourceUrl('');
    setAddMode('manual');
    setShowForm(false);
    setSubmitting(false);
    await loadEntries(workspaceId);
  }

  async function handleFetchUrl() {
    if (!sourceUrl.trim()) return;

    setFetchingUrl(true);
    setUrlError('');

    try {
      const res = await fetch('/api/knowledge/fetch-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: sourceUrl.trim() }),
      });
      const result = await res.json();

      if (!res.ok) {
        setUrlError(result.error || 'Erro ao buscar a URL');
        return;
      }

      setFormData({ title: result.title, category: formData.category, content: result.content });
      setPendingSourceUrl(sourceUrl.trim());
    } catch (err) {
      console.error('Erro ao buscar URL:', err);
      setUrlError('Erro inesperado ao buscar a URL');
    } finally {
      setFetchingUrl(false);
    }
  }

  async function handleRefreshFromUrl(entry: KnowledgeEntry) {
    if (!entry.source_url || !workspaceId) return;

    setRefreshingId(entry.id);
    try {
      const res = await fetch('/api/knowledge/fetch-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: entry.source_url }),
      });
      const result = await res.json();

      if (!res.ok) {
        alert(result.error || 'Erro ao atualizar da URL');
        return;
      }

      const { error: updateError } = await supabase
        .from('knowledge_entries')
        .update({ content: result.content, source_fetched_at: new Date().toISOString() })
        .eq('id', entry.id);

      if (updateError) {
        alert('Erro ao salvar conteúdo atualizado: ' + updateError.message);
        return;
      }

      await loadEntries(workspaceId);
    } catch (err) {
      console.error('Erro ao atualizar entrada da URL:', err);
      alert('Erro inesperado ao atualizar');
    } finally {
      setRefreshingId(null);
    }
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
            <div className="flex gap-2 mb-4">
              <button
                type="button"
                onClick={() => setAddMode('manual')}
                className={`px-4 py-1.5 rounded-full text-sm font-medium border ${
                  addMode === 'manual'
                    ? 'bg-primary text-white border-primary'
                    : 'border-border text-muted-foreground hover:bg-muted'
                }`}
              >
                Texto manual
              </button>
              <button
                type="button"
                onClick={() => setAddMode('url')}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium border ${
                  addMode === 'url'
                    ? 'bg-primary text-white border-primary'
                    : 'border-border text-muted-foreground hover:bg-muted'
                }`}
              >
                <Link2 className="w-3.5 h-3.5" />
                Buscar de uma URL
              </button>
            </div>

            {addMode === 'url' && (
              <div className="mb-4 p-4 bg-muted rounded-xl space-y-2">
                <label className="block text-sm font-medium text-foreground">
                  URL da página (ex: FAQ ou política de troca do seu site)
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={sourceUrl}
                    onChange={(e) => setSourceUrl(e.target.value)}
                    placeholder="https://sualoja.com.br/politica-de-troca"
                    className="flex-1 px-4 py-2 border border-border rounded-xl bg-white text-foreground"
                  />
                  <button
                    type="button"
                    onClick={handleFetchUrl}
                    disabled={fetchingUrl || !sourceUrl.trim()}
                    className="flex items-center gap-2 px-4 py-2 btn-gradient font-medium disabled:opacity-50 whitespace-nowrap"
                  >
                    {fetchingUrl && <Loader2 className="w-4 h-4 animate-spin" />}
                    {fetchingUrl ? 'Buscando...' : 'Buscar'}
                  </button>
                </div>
                {urlError && <p className="text-sm text-destructive">{urlError}</p>}
                {pendingSourceUrl && (
                  <p className="text-sm text-success">
                    Conteúdo importado — revise abaixo antes de salvar.
                  </p>
                )}
              </div>
            )}

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
                  onClick={() => {
                    setShowForm(false);
                    setAddMode('manual');
                    setSourceUrl('');
                    setPendingSourceUrl(null);
                    setUrlError('');
                    setFormData({ title: '', category: '', content: '' });
                  }}
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
                      {entry.source_url && (
                        <button
                          onClick={() => handleRefreshFromUrl(entry)}
                          disabled={refreshingId === entry.id}
                          title="Buscar conteúdo atualizado da URL"
                          className="p-1 text-muted-foreground hover:text-primary disabled:opacity-50"
                        >
                          <RefreshCw className={`w-4 h-4 ${refreshingId === entry.id ? 'animate-spin' : ''}`} />
                        </button>
                      )}
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

                {entry.source_url && (
                  <a
                    href={entry.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-primary hover:underline mb-1 truncate"
                  >
                    <Link2 className="w-3 h-3 flex-shrink-0" />
                    {entry.source_url}
                  </a>
                )}

                <p className="text-xs text-muted-foreground">
                  {entry.source_fetched_at
                    ? `Atualizado da URL em ${new Date(entry.source_fetched_at).toLocaleDateString('pt-BR')}`
                    : new Date(entry.created_at).toLocaleDateString('pt-BR')}
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
