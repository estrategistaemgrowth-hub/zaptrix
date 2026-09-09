'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Upload, Trash2, FileText, BookOpen } from 'lucide-react';

interface KnowledgeEntry {
  id: string;
  title: string;
  content: string;
  source?: string;
  created_at: string;
}

export default function ConhecimentoPage() {
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    source: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    loadEntries();
  }, []);

  async function loadEntries() {
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
        .from('knowledge_entries')
        .select('*')
        .eq('workspace_id', workspace.workspace_id)
        .order('created_at', { ascending: false });

      setEntries(data || []);
    } catch (err) {
      console.error('Erro ao carregar entradas:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddEntry(e: React.FormEvent) {
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

      await supabase
        .from('knowledge_entries')
        .insert([
          {
            workspace_id: workspace.workspace_id,
            title: formData.title,
            content: formData.content,
            source: formData.source || null,
          },
        ]);

      setFormData({ title: '', content: '', source: '' });
      setShowForm(false);
      loadEntries();
    } catch (err) {
      console.error('Erro:', err);
      alert('Erro ao adicionar entrada de conhecimento');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteEntry(id: string) {
    if (!confirm('Deletar esta entrada?')) return;

    try {
      await supabase.from('knowledge_entries').delete().eq('id', id);
      loadEntries();
    } catch (err) {
      console.error('Erro:', err);
    }
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Base de Conhecimento</h1>
            <p className="text-muted-foreground">Documentação para treinar a IA</p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-6 py-2 bg-primary text-white rounded-lg font-medium hover:opacity-90"
          >
            <Upload className="w-4 h-4" />
            Nova entrada
          </button>
        </div>

        {showForm && (
          <div className="bg-white border border-border rounded-lg p-6 mb-8">
            <form onSubmit={handleAddEntry} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Título *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-border rounded-lg bg-white text-foreground"
                  placeholder="ex: Guia de Produtos 2024"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Conteúdo *
                </label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-border rounded-lg bg-white text-foreground font-mono text-sm"
                  placeholder="Cole o conteúdo da documentação aqui..."
                  rows={8}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Fonte (opcional)
                </label>
                <input
                  type="text"
                  value={formData.source}
                  onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                  className="w-full px-4 py-2 border border-border rounded-lg bg-white text-foreground"
                  placeholder="ex: drive.google.com/..."
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {loading ? (
            <p className="text-muted-foreground">Carregando...</p>
          ) : entries.length === 0 ? (
            <div className="col-span-full">
              <div className="bg-white border border-border rounded-lg p-12 text-center">
                <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">Nenhuma entrada de conhecimento</p>
                <p className="text-sm text-muted-foreground">Comece adicionando documentação para treinar a IA</p>
              </div>
            </div>
          ) : (
            entries.map((entry) => (
              <div
                key={entry.id}
                className="bg-white border border-border rounded-lg p-6 hover:shadow-lg transition-shadow"
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-start gap-3 flex-1">
                    <FileText className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-foreground line-clamp-2">
                        {entry.title}
                      </h3>
                      {entry.source && (
                        <p className="text-xs text-muted-foreground truncate mt-1">Fonte: {entry.source}</p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteEntry(entry.id)}
                    className="p-1 text-destructive hover:bg-destructive/10 rounded ml-2 flex-shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <p className="text-sm text-muted-foreground line-clamp-3 mb-3">
                  {entry.content}
                </p>

                <p className="text-xs text-muted-foreground">
                  {new Date(entry.created_at).toLocaleDateString('pt-BR')}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
