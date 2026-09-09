'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ensureWorkspace } from '@/lib/workspace';
import { Search, MessageSquare, Users, Plus, Tag, X, Trash2 } from 'lucide-react';

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
  const supabase = createClient();

  useEffect(() => {
    init();
  }, []);

  useEffect(() => {
    const term = searchTerm.toLowerCase();
    const filtered = contacts.filter(
      (contact) =>
        (contact.name || contact.push_name || '').toLowerCase().includes(term) ||
        contact.phone.includes(searchTerm) ||
        (contact.tags || []).some((tag) => tag.toLowerCase().includes(term))
    );
    setFilteredContacts(filtered);
  }, [searchTerm, contacts]);

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
            className="flex items-center gap-2 px-6 py-2 bg-primary text-white rounded-lg font-medium hover:opacity-90"
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
                  className="px-6 py-2 bg-primary text-white rounded-lg font-medium hover:opacity-90 disabled:opacity-50"
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
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-muted-foreground">
              <p>Carregando...</p>
            </div>
          ) : filteredContacts.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p>Nenhum contato encontrado</p>
              <p className="text-sm mt-1">Clique em "Novo contato" para cadastrar o primeiro</p>
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
                  {filteredContacts.map((contact) => (
                    <tr key={contact.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 text-sm font-medium text-foreground">
                        {contact.name || contact.push_name || 'Sem nome'}
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
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
