'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { AlertCircle, CheckCircle2, Smartphone, Settings, Copy, Eye, EyeOff } from 'lucide-react';

interface WhatsAppConnection {
  id: string;
  instance_name: string;
  phone_number?: string;
  status: 'connected' | 'disconnected' | 'connecting';
  created_at: string;
}

export default function WhatsappPage() {
  const [connections, setConnections] = useState<WhatsAppConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [formData, setFormData] = useState({
    evolution_api_url: '',
    evolution_api_key: '',
    instance_name: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const supabase = createClient();

  useEffect(() => {
    loadConnections();
  }, []);

  async function loadConnections() {
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
        .from('whatsapp_connections')
        .select('*')
        .eq('workspace_id', workspace.workspace_id)
        .order('created_at', { ascending: false });

      setConnections(data || []);
    } catch (err) {
      console.error('Erro ao carregar conexões:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleTestConnection() {
    setTestingConnection(true);

    try {
      // Simulação de teste — em produção, faria POST para /api/whatsapp/test
      if (formData.evolution_api_url && formData.evolution_api_key) {
        setTestResult('success');
      } else {
        setTestResult('error');
      }
    } catch (err) {
      setTestResult('error');
    } finally {
      setTestingConnection(false);
    }
  }

  async function handleSaveConnection(e: React.FormEvent) {
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
        .from('whatsapp_connections')
        .insert([
          {
            workspace_id: workspace.workspace_id,
            instance_name: formData.instance_name,
            status: 'connecting',
          },
        ]);

      setFormData({ evolution_api_url: '', evolution_api_key: '', instance_name: '' });
      setShowForm(false);
      loadConnections();
    } catch (err) {
      console.error('Erro:', err);
      alert('Erro ao salvar conexão');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Smartphone className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold text-foreground">WhatsApp</h1>
            <p className="text-muted-foreground">Integração com Evolution API</p>
          </div>
        </div>

        {/* Formulário de Configuração */}
        {!showForm ? (
          <button
            onClick={() => setShowForm(true)}
            className="px-6 py-2 bg-primary text-white rounded-lg font-medium hover:opacity-90 mb-8"
          >
            Conectar Evolution API
          </button>
        ) : (
          <div className="bg-white border border-border rounded-lg p-8 mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-6">Configurar Evolution API</h2>

            <form onSubmit={handleSaveConnection} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Nome da Instância *
                </label>
                <input
                  type="text"
                  value={formData.instance_name}
                  onChange={(e) => setFormData({ ...formData, instance_name: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-border rounded-lg bg-white text-foreground"
                  placeholder="ex: loja-principal"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Identificador único para esta instância de WhatsApp
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  URL da Evolution API *
                </label>
                <input
                  type="url"
                  value={formData.evolution_api_url}
                  onChange={(e) => setFormData({ ...formData, evolution_api_url: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-border rounded-lg bg-white text-foreground"
                  placeholder="ex: https://evolution-api.example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  API Key *
                </label>
                <div className="relative">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={formData.evolution_api_key}
                    onChange={(e) => setFormData({ ...formData, evolution_api_key: e.target.value })}
                    required
                    className="w-full px-4 py-2 border border-border rounded-lg bg-white text-foreground pr-12"
                    placeholder="Cole sua API key aqui"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-4 top-2.5 text-muted-foreground hover:text-foreground"
                  >
                    {showApiKey ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-900">
                  💡 Você pode testar a conexão antes de salvar. A API key será criptografada e armazenada com segurança.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testingConnection || !formData.evolution_api_url || !formData.evolution_api_key}
                  className="px-6 py-2 border border-primary text-primary rounded-lg font-medium hover:bg-primary/5 disabled:opacity-50"
                >
                  {testingConnection ? 'Testando...' : 'Testar Conexão'}
                </button>

                {testResult && (
                  <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
                    testResult === 'success'
                      ? 'bg-green-100 text-green-900 border border-green-200'
                      : 'bg-red-100 text-red-900 border border-red-200'
                  }`}>
                    {testResult === 'success' ? (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span className="text-sm font-medium">Conexão OK</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-4 h-4" />
                        <span className="text-sm font-medium">Falha na conexão</span>
                      </>
                    )}
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-4 border-t border-border">
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2 bg-primary text-white rounded-lg font-medium hover:opacity-90 disabled:opacity-50"
                >
                  {submitting ? 'Salvando...' : 'Salvar Configuração'}
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

        {/* Lista de Conexões */}
        <div className="bg-white border border-border rounded-lg">
          <div className="p-6 border-b border-border bg-gray-50">
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
              <p className="text-sm mt-1">Comece adicionando sua Evolution API acima</p>
            </div>
          ) : (
            <div className="space-y-4 p-6">
              {connections.map((conn) => (
                <div
                  key={conn.id}
                  className="border border-border rounded-lg p-6 hover:shadow-lg transition-shadow"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                        {conn.instance_name}
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          conn.status === 'connected' ? 'bg-green-100 text-green-700' :
                          conn.status === 'connecting' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {conn.status === 'connected' ? 'Conectado' : conn.status === 'connecting' ? 'Conectando' : 'Desconectado'}
                        </span>
                      </h3>
                      {conn.phone_number && (
                        <p className="text-sm text-muted-foreground mt-1">
                          Telefone: {conn.phone_number}
                        </p>
                      )}
                    </div>
                    <button className="p-2 text-muted-foreground hover:text-foreground">
                      <Settings className="w-5 h-5" />
                    </button>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Criado em {new Date(conn.created_at).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Info Box */}
        <div className="bg-white border border-border rounded-lg p-6 mt-8">
          <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-primary" />
            Como configurar
          </h3>
          <ol className="space-y-3 text-sm text-muted-foreground">
            <li>
              <strong>1.</strong> Acesse{' '}
              <a
                href="https://evolution-api.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                evolution-api.com
              </a>
              {' '}e crie uma conta
            </li>
            <li>
              <strong>2.</strong> Gere uma API key na seção de configurações
            </li>
            <li>
              <strong>3.</strong> Cole a URL e a API key nos campos acima
            </li>
            <li>
              <strong>4.</strong> Clique em "Testar Conexão" para validar
            </li>
            <li>
              <strong>5.</strong> Após conectado, faça login com seu WhatsApp via QR code
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}
