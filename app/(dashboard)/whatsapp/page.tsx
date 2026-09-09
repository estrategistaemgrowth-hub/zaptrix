'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ensureWorkspace } from '@/lib/workspace';
import { AlertCircle, Smartphone, Settings, Trash2 } from 'lucide-react';

interface WhatsAppConnection {
  id: string;
  instance_name: string;
  phone_number: string | null;
  status: 'connected' | 'disconnected' | 'connecting' | 'error';
  created_at: string;
}

function generateWebhookSecret() {
  return crypto.randomUUID().replace(/-/g, '');
}

export default function WhatsappPage() {
  const [connections, setConnections] = useState<WhatsAppConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [instanceName, setInstanceName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
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
      await loadConnections(workspace.workspaceId);
    } catch (err) {
      console.error('Erro ao carregar conexões:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadConnections(wsId: string) {
    const { data, error: loadError } = await supabase
      .from('whatsapp_connections')
      .select('*')
      .eq('workspace_id', wsId)
      .order('created_at', { ascending: false });

    if (loadError) {
      setError('Erro ao carregar conexões: ' + loadError.message);
      return;
    }

    setConnections(data || []);
  }

  async function handleSaveConnection(e: React.FormEvent) {
    e.preventDefault();
    if (!workspaceId) return;

    setSubmitting(true);
    setError('');

    const { error: insertError } = await supabase.from('whatsapp_connections').insert([
      {
        workspace_id: workspaceId,
        instance_name: instanceName,
        status: 'connecting',
        webhook_secret: generateWebhookSecret(),
      },
    ]);

    if (insertError) {
      console.error('Erro ao criar conexão:', insertError);
      setError('Erro ao criar conexão: ' + insertError.message);
      setSubmitting(false);
      return;
    }

    setInstanceName('');
    setShowForm(false);
    setSubmitting(false);
    await loadConnections(workspaceId);
  }

  async function handleDeleteConnection(id: string) {
    if (!workspaceId || !confirm('Remover esta conexão?')) return;

    const { error: deleteError } = await supabase.from('whatsapp_connections').delete().eq('id', id);
    if (deleteError) {
      alert('Erro ao remover: ' + deleteError.message);
      return;
    }
    await loadConnections(workspaceId);
  }

  return (
    <div className="p-2">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Smartphone className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold text-foreground">WhatsApp</h1>
            <p className="text-muted-foreground">Conexões via Evolution API</p>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-blue-900">
            A conexão real com o WhatsApp (QR code) é feita pela equipe Zaptrix na Evolution API central.
            Aqui você cadastra o nome da instância que será usada pelo seu workspace.
          </p>
        </div>

        {!showForm ? (
          <button
            onClick={() => setShowForm(true)}
            className="px-6 py-2 bg-primary text-white rounded-xl font-medium hover:opacity-90 mb-8"
          >
            Nova conexão
          </button>
        ) : (
          <div className="bg-card border border-border rounded-2xl shadow-sm p-8 mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-6">Nova instância</h2>

            <form onSubmit={handleSaveConnection} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Nome da Instância *
                </label>
                <input
                  type="text"
                  value={instanceName}
                  onChange={(e) => setInstanceName(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-border rounded-xl bg-white text-foreground"
                  placeholder="ex: loja-principal"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Identificador único para esta instância de WhatsApp
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2 bg-primary text-white rounded-xl font-medium hover:opacity-90 disabled:opacity-50"
                >
                  {submitting ? 'Salvando...' : 'Criar conexão'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-6 py-2 border border-border text-foreground rounded-xl font-medium hover:bg-background"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="bg-card border border-border rounded-2xl shadow-sm">
          <div className="p-6 border-b border-border bg-muted rounded-t-2xl">
            <h2 className="text-xl font-semibold text-foreground">
              Conexões ({connections.length})
            </h2>
          </div>

          {loading ? (
            <div className="p-12 text-center text-muted-foreground">
              <p>Carregando...</p>
            </div>
          ) : connections.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <Smartphone className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p>Nenhuma conexão configurada</p>
              <p className="text-sm mt-1">Comece criando uma instância acima</p>
            </div>
          ) : (
            <div className="space-y-4 p-6">
              {connections.map((conn) => (
                <div
                  key={conn.id}
                  className="border border-border rounded-xl p-6 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                        {conn.instance_name}
                        <span
                          className={`text-xs px-2 py-1 rounded-full ${
                            conn.status === 'connected'
                              ? 'bg-emerald-100 text-emerald-700'
                              : conn.status === 'connecting'
                              ? 'bg-amber-100 text-amber-700'
                              : conn.status === 'error'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {conn.status === 'connected'
                            ? 'Conectado'
                            : conn.status === 'connecting'
                            ? 'Conectando'
                            : conn.status === 'error'
                            ? 'Erro'
                            : 'Desconectado'}
                        </span>
                      </h3>
                      {conn.phone_number && (
                        <p className="text-sm text-muted-foreground mt-1">
                          Telefone: {conn.phone_number}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        Criado em {new Date(conn.created_at).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeleteConnection(conn.id)}
                      className="p-2 text-destructive hover:bg-destructive/10 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
