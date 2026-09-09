'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ensureWorkspace } from '@/lib/workspace';
import { Search, MessageSquare, Users, Plus, Tag, X, Trash2, SlidersHorizontal } from 'lucide-react';

interface Contact {
  id: string;
  name: string | null;
  push_name: string | null;
  phone: string;
  tags: string[] | null;
  notes: string | null;
  last_contact_at: string | null;
  created_at: string;
}

export default function ContatosPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({ name: '', phone: '', tagsInput: '', notes: '' });
  const [error, setError] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<'recent' | 'name' | 'last_contact'>('recent');
  const supabase = createClient();

  const allTags = Array.from(new Set(contacts.flatMap((c) => c.tags || []))).sort();

  useEffect(() => {
    init();
  }, []);

  useEffect(() => {
    const term = searchTerm.toLowerCase();
    let filtered = contacts.filter(
      (contact) =>
        (contact.name || contact.push_name || '').toLowerCase().includes(term) ||
        contact.phone.includes(searchTerm) ||
        (contact.tags || []).some((tag) => tag.toLowerCase().includes(term))
    );

    if (selectedTags.length > 0) {
      filtered = filtered.filter((contact) =>
        selectedTags.every((tag) => (contact.tags || []).includes(tag))
      );
    }

    filtered = [...filtered].sort((a, b) => {
      if (sortBy === 'name') {
        return (a.name || a.push_name || '').localeCompare(b.name || b.push_name || '');
      }
      if (sortBy === 'last_contact') {
        return (
          new Date(b.last_contact_at || 0).getTime() - new Date(a.last_contact_at || 0).getTime()
        );
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    setFilteredContacts(filtered);
  }, [searchTerm, contacts, selectedTags, sortBy]);

  function toggleTagFilter(tag: string) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

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
      await loadContacts(workspace.workspaceId);
    } catch (err) {
      console.error('Erro ao carregar contatos:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadContacts(wsId: string) {
    const { data, error: loadError } = await supabase
      .from('contacts')
      .select('*')
      .eq('workspace_id', wsId)
      .order('created_at', { ascending: false });

    if (loadError) {
      console.error('Erro ao carregar contatos:', loadError);
      setError('Erro ao carregar contatos: ' + loadError.message);
      return;
    }

    setContacts(data || []);
  }

  async function handleAddContact(e: React.FormEvent) {
    e.preventDefault();
    if (!workspaceId) return;

    setSubmitting(true);
    setError('');

    const tags = formData.tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const { error: insertError } = await supabase.from('contacts').insert([
      {
        workspace_id: workspaceId,
        name: formData.name || null,
        phone: formData.phone,
        tags,
        notes: formData.notes || null,
      },
    ]);

    if (insertError) {
      console.error('Erro ao criar contato:', insertError);
      setError('Erro ao criar contato: ' + insertError.message);
      setSubmitting(false);
      return;
    }

    setFormData({ name: '', phone: '', tagsInput: '', notes: '' });
    setShowForm(false);
    setSubmitting(false);
    await loadContacts(workspaceId);
  }

  async function handleDeleteContact(id: string) {
    if (!workspaceId || !confirm('Remover este contato?')) return;

    const { error: deleteError } = await supabase.from('contacts').delete().eq('id', id);
    if (deleteError) {
      alert('Erro ao remover contato: ' + deleteError.message);
      return;
    }
    await loadContacts(workspaceId);
  }

  return (
    <div className="p-2">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Users className="w-8 h-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold text-foreground">Contatos</h1>
              <p className="text-muted-foreground">{filteredContacts.length} contatos</p>
            </div>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-6 py-2 btn-gradient font-medium"
          >
            <Plus className="w-4 h-4" />
            Novo contato
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        {showForm && (
          <div className="bg-card border border-border rounded-2xl shadow-sm p-6 mb-6">
            <form onSubmit={handleAddContact} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Nome</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 border border-border rounded-xl bg-white text-foreground"
                    placeholder="Nome do contato"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Telefone *
                  </label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    required
                    className="w-full px-4 py-2 border border-border rounded-xl bg-white text-foreground"
                    placeholder="5511999999999"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Tags (separadas por vírgula)
                </label>
                <input
                  type="text"
                  value={formData.tagsInput}
                  onChange={(e) => setFormData({ ...formData, tagsInput: e.target.value })}
                  className="w-full px-4 py-2 border border-border rounded-xl bg-white text-foreground"
                  placeholder="cliente vip, atacado, novo"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Observações
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-4 py-2 border border-border rounded-xl bg-white text-foreground"
                  rows={2}
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2 btn-gradient font-medium"
                >
                  {submitting ? 'Salvando...' : 'Adicionar contato'}
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

        <div className="bg-card border border-border rounded-2xl shadow-sm p-6 mb-6">
          <div className="flex items-center gap-3">
            <Search className="w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nome, telefone ou tag..."
              className="flex-1 text-foreground placeholder-muted-foreground outline-none"
            />
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border ${
                showFilters || selectedTags.length > 0
                  ? 'bg-primary/10 text-primary border-primary/20'
                  : 'border-border text-muted-foreground hover:bg-muted'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              Filtros
              {selectedTags.length > 0 && (
                <span className="w-5 h-5 flex items-center justify-center bg-primary text-white rounded-full text-xs">
                  {selectedTags.length}
                </span>
              )}
            </button>
          </div>

          {showFilters && (
            <div className="mt-4 pt-4 border-t border-border space-y-4">
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">Ordenar por</p>
                <div className="flex gap-2">
                  {[
                    { value: 'recent', label: 'Mais recentes' },
                    { value: 'name', label: 'Nome (A-Z)' },
                    { value: 'last_contact', label: 'Último contato' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setSortBy(opt.value as typeof sortBy)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border ${
                        sortBy === opt.value
                          ? 'bg-primary text-white border-primary'
                          : 'border-border text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {allTags.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2">
                    Tags {selectedTags.length > 0 && `(contato precisa ter todas as selecionadas)`}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {allTags.map((tag) => (
                      <button
                        key={tag}
                        onClick={() => toggleTagFilter(tag)}
                        className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border ${
                          selectedTags.includes(tag)
                            ? 'bg-primary text-white border-primary'
                            : 'border-border text-muted-foreground hover:bg-muted'
                        }`}
                      >
                        <Tag className="w-3 h-3" />
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {selectedTags.length > 0 && (
                <button
                  onClick={() => setSelectedTags([])}
                  className="text-xs text-muted-foreground hover:text-foreground underline"
                >
                  Limpar filtros de tag
                </button>
              )}
            </div>
          )}
        </div>

        <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="divide-y divide-border">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-3 p-4">
                  <div className="w-9 h-9 rounded-full bg-muted animate-pulse flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 w-1/4 bg-muted animate-pulse rounded-full" />
                    <div className="h-3 w-1/6 bg-muted animate-pulse rounded-full" />
                  </div>
                  <div className="h-5 w-16 bg-muted animate-pulse rounded-full" />
                </div>
              ))}
            </div>
          ) : filteredContacts.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="w-16 h-16 text-muted-foreground/40 mx-auto mb-4" />
              <p className="text-foreground font-medium mb-1">Nenhum contato encontrado</p>
              <p className="text-sm text-muted-foreground mb-6">
                {contacts.length === 0
                  ? 'Cadastre o primeiro contato para começar'
                  : 'Tente ajustar a busca ou os filtros'}
              </p>
              {contacts.length === 0 && (
                <button
                  onClick={() => setShowForm(true)}
                  className="inline-flex items-center gap-2 px-6 py-2 btn-gradient font-medium"
                >
                  <Plus className="w-4 h-4" />
                  Novo contato
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted border-b border-border">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Nome</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Telefone</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Tags</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Último contato</th>
                    <th className="px-6 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredContacts.map((contact) => {
                    const label = contact.name || contact.push_name || 'Sem nome';
                    return (
                    <tr key={contact.id} className="transition-colors duration-200 hover:bg-primary/5">
                      <td className="px-6 py-4 text-sm font-medium text-foreground">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold flex-shrink-0">
                            {label.charAt(0).toUpperCase()}
                          </div>
                          {label}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">{contact.phone}</td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {(contact.tags || []).map((tag) => (
                            <span
                              key={tag}
                              className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full"
                            >
                              <Tag className="w-3 h-3" />
                              {tag}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {contact.last_contact_at
                          ? new Date(contact.last_contact_at).toLocaleDateString('pt-BR')
                          : '—'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleDeleteContact(contact.id)}
                          className="p-1 text-destructive hover:bg-destructive/10 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
