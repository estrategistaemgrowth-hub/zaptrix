'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ensureWorkspace } from '@/lib/workspace';
import { PROVIDER_LABELS, PROVIDER_MODELS, AiProvider } from '@/lib/ai-models';
import { WhatsappQrModal } from '@/components/whatsapp-qr-modal';
import { SkeletonRow } from '@/components/skeleton';
import {
  Plus,
  Trash2,
  Crown,
  ShieldCheck,
  UserRound,
  Smartphone,
  Zap,
  Copy,
  Check,
  Eye,
  EyeOff,
  AlertTriangle,
  Users,
} from 'lucide-react';

type Section = 'membros' | 'whatsapp' | 'ia';

const SECTION_GROUPS: { label: string; items: { id: Section; label: string; icon: typeof Users }[] }[] = [
  {
    label: 'GERAL',
    items: [{ id: 'membros', label: 'Membros', icon: Users }],
  },
  {
    label: 'COMUNICAÇÃO & IA',
    items: [
      { id: 'whatsapp', label: 'WhatsApp', icon: Smartphone },
      { id: 'ia', label: 'API Key da IA', icon: Zap },
    ],
  },
];

interface WorkspaceMember {
  id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'atendente';
  created_at: string;
}

interface WhatsAppConnection {
  id: string;
  instance_name: string;
  status: 'connected' | 'disconnected' | 'connecting' | 'error';
  min_delay_seconds: number;
  max_delay_seconds: number;
  daily_message_limit: number | null;
  warmup_mode: boolean;
}

interface LlmCredential {
  id: string;
  provider: AiProvider;
  key_hint: string | null;
  model_id: string | null;
  is_primary: boolean;
  enabled: boolean;
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
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);

  const [connections, setConnections] = useState<WhatsAppConnection[]>([]);
  const [connecting, setConnecting] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [pendingConnectionId, setPendingConnectionId] = useState<string | null>(null);

  const [credentials, setCredentials] = useState<LlmCredential[]>([]);
  const [showAiForm, setShowAiForm] = useState(false);
  const [aiProvider, setAiProvider] = useState<AiProvider>('openai');
  const [aiModel, setAiModel] = useState(PROVIDER_MODELS.openai[0].id);
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [savingAi, setSavingAi] = useState(false);
  const [activeSection, setActiveSection] = useState<Section>('membros');

  useEffect(() => {
    const section = new URLSearchParams(window.location.search).get('section') as Section | null;
    if (section === 'whatsapp' || section === 'ia' || section === 'membros') {
      setActiveSection(section);
    }
  }, []);

  const supabase = createClient();

  useEffect(() => {
    init();
  }, []);

  useEffect(() => {
    if (!pendingConnectionId) return;

    const interval = setInterval(async () => {
      const res = await fetch(`/api/whatsapp/status?connectionId=${pendingConnectionId}`);
      const result = await res.json();

      if (result.status === 'connected') {
        setQrCode(null);
        setPendingConnectionId(null);
        if (workspaceId) await loadConnections(workspaceId);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [pendingConnectionId, workspaceId]);

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
      await Promise.all([
        loadMembers(workspace.workspaceId),
        loadConnections(workspace.workspaceId),
        loadCredentials(workspace.workspaceId),
      ]);
    } catch (err) {
      console.error('Erro ao carregar configurações:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadMembers(wsId: string) {
    const { data, error: loadError } = await supabase
      .from('workspace_members')
      .select('*')
      .eq('workspace_id', wsId)
      .order('created_at');

    if (loadError) {
      setError('Erro ao carregar membros: ' + loadError.message);
      return;
    }
    setMembers(data || []);
  }

  async function loadConnections(wsId: string) {
    const { data } = await supabase
      .from('whatsapp_connections')
      .select('id, instance_name, status, min_delay_seconds, max_delay_seconds, daily_message_limit, warmup_mode')
      .eq('workspace_id', wsId)
      .order('created_at', { ascending: false });
    setConnections(data || []);
  }

  async function loadCredentials(wsId: string) {
    const { data } = await supabase
      .from('llm_credentials')
      .select('id, provider, key_hint, model_id, is_primary, enabled')
      .eq('workspace_id', wsId)
      .order('created_at', { ascending: false });
    setCredentials(data || []);
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
      if (workspaceId) await loadMembers(workspaceId);
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
    if (workspaceId) await loadMembers(workspaceId);
  }

  function handleCopyCredential() {
    if (!createdCredential) return;
    const text = `Email: ${createdCredential.email}\nSenha temporária: ${createdCredential.tempPassword}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  async function handleConnectWhatsapp() {
    setConnecting(true);
    setError('');
    setQrCode(null);

    try {
      const res = await fetch('/api/whatsapp/connect', { method: 'POST' });
      const result = await res.json();

      if (!res.ok) {
        setError(result.error || 'Erro ao conectar WhatsApp');
        setConnecting(false);
        return;
      }

      setQrCode(result.qrcode);
      setPendingConnectionId(result.connectionId);
      if (workspaceId) await loadConnections(workspaceId);
    } catch (err) {
      setError('Erro inesperado ao conectar WhatsApp');
    } finally {
      setConnecting(false);
    }
  }

  async function handleDeleteConnection(id: string) {
    if (!workspaceId || !confirm('Remover esta conexão?')) return;

    await fetch('/api/whatsapp/connect', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ connectionId: id }),
    });

    if (pendingConnectionId === id) {
      setPendingConnectionId(null);
      setQrCode(null);
    }
    await loadConnections(workspaceId);
  }

  async function handleAddCredential(e: React.FormEvent) {
    e.preventDefault();
    setSavingAi(true);
    setError('');

    try {
      const res = await fetch('/api/workspace/llm-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: aiProvider, apiKey, modelId: aiModel }),
      });

      const result = await res.json();

      if (!res.ok) {
        setError(result.error || 'Erro ao salvar credencial');
        setSavingAi(false);
        return;
      }

      setApiKey('');
      setShowAiForm(false);
      if (workspaceId) await loadCredentials(workspaceId);
    } catch (err) {
      setError('Erro inesperado ao salvar credencial');
    } finally {
      setSavingAi(false);
    }
  }

  async function handleDeleteCredential(id: string) {
    if (!confirm('Remover esta credencial?')) return;

    const res = await fetch('/api/workspace/llm-credentials', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credentialId: id }),
    });

    if (!res.ok) {
      const result = await res.json();
      alert('Erro ao remover: ' + result.error);
      return;
    }

    if (workspaceId) await loadCredentials(workspaceId);
  }

  return (
    <div className="p-2">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">Configurações</h1>
        <p className="text-muted-foreground">Parâmetros do workspace e integrações</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex gap-6 items-start">
        {/* Submenu de categorias */}
        <div className="w-64 shrink-0 bg-card border border-border rounded-2xl shadow-sm p-4">
          {SECTION_GROUPS.map((group) => (
            <div key={group.label} className="mb-5 last:mb-0">
              <p className="px-3 mb-2 text-xs font-semibold text-muted-foreground tracking-wide">
                {group.label}
              </p>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeSection === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveSection(item.id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-all duration-200 ${
                        isActive
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'text-foreground hover:bg-muted'
                      }`}
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Conteúdo da seção ativa */}
        <div className="flex-1 min-w-0 animate-fade-in" key={activeSection}>
        {activeSection === 'membros' && (
        <div className="bg-card border border-border rounded-2xl shadow-sm p-6">
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
              className="flex items-center gap-2 px-6 py-2 btn-gradient font-medium"
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
              <div className="divide-y divide-border border border-border rounded-xl overflow-hidden">
                <SkeletonRow />
                <SkeletonRow />
              </div>
            ) : members.length === 0 ? (
              <div className="p-8 text-center">
                <Users className="w-16 h-16 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-foreground font-medium">Nenhum membro no workspace</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Adicione o primeiro membro usando o formulário acima
                </p>
              </div>
            ) : (
              members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-4 border border-border rounded-xl bg-muted transition-all duration-200 hover:shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className="relative flex-shrink-0">
                      <div className="w-9 h-9 rounded-full bg-white border border-border flex items-center justify-center">
                        {member.role === 'owner' ? (
                          <Crown className="w-4 h-4 text-amber-500" />
                        ) : member.role === 'admin' ? (
                          <ShieldCheck className="w-4 h-4 text-primary" />
                        ) : (
                          <UserRound className="w-4 h-4 text-muted-foreground" />
                        )}
                      </div>
                      <span
                        title="Online"
                        className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-muted"
                      />
                    </div>
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
        )}

        {activeSection === 'whatsapp' && (
        <div className="bg-card border border-border rounded-2xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Smartphone className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold text-foreground">WhatsApp</h2>
            </div>
            {!qrCode && (
              <button
                onClick={handleConnectWhatsapp}
                disabled={connecting}
                className="flex items-center gap-2 px-4 py-2 btn-gradient text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                {connecting ? 'Gerando QR code...' : 'Conectar WhatsApp'}
              </button>
            )}
          </div>

          <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-900">
              <p className="font-medium mb-1">Risco de banimento do número</p>
              <p>
                Conexão via Evolution API (não-oficial) pode banir o número em caso de envio em
                massa. Evite números novos para grandes volumes (modo aquecimento).
              </p>
            </div>
          </div>

          {qrCode && (
            <WhatsappQrModal qrCode={qrCode} onClose={() => setQrCode(null)} />
          )}

          <div className="space-y-2">
            {connections.length === 0 ? (
              <div className="p-8 text-center">
                <Smartphone className="w-16 h-16 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-foreground font-medium">Nenhuma conexão configurada</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Clique em "Conectar WhatsApp" para gerar o QR code
                </p>
              </div>
            ) : (
              connections.map((conn) => (
                <div
                  key={conn.id}
                  className="flex items-center justify-between p-4 border border-border rounded-xl bg-muted transition-all duration-200 hover:shadow-sm"
                >
                  <div>
                    <p className="font-medium text-foreground flex items-center gap-2">
                      {conn.instance_name}
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          conn.status === 'connected'
                            ? 'bg-emerald-100 text-emerald-700'
                            : conn.status === 'connecting'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {conn.status === 'connected' ? 'Conectado' : conn.status === 'connecting' ? 'Conectando' : 'Desconectado'}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Delay {conn.min_delay_seconds}-{conn.max_delay_seconds}s
                      {conn.daily_message_limit && ` · limite ${conn.daily_message_limit}/dia`}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeleteConnection(conn.id)}
                    className="p-2 text-destructive hover:bg-destructive/10 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
        )}

        {activeSection === 'ia' && (
        <div className="bg-card border border-border rounded-2xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Zap className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold text-foreground">API Key da IA</h2>
            </div>
            {!showAiForm && (
              <button
                onClick={() => setShowAiForm(true)}
                className="flex items-center gap-2 px-4 py-2 btn-gradient text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Adicionar credencial
              </button>
            )}
          </div>

          {showAiForm && (
            <form onSubmit={handleAddCredential} className="mb-4 p-4 bg-muted rounded-xl space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Provider</label>
                  <select
                    value={aiProvider}
                    onChange={(e) => {
                      const provider = e.target.value as AiProvider;
                      setAiProvider(provider);
                      setAiModel(PROVIDER_MODELS[provider][0].id);
                    }}
                    className="w-full px-4 py-2 border border-border rounded-xl bg-white text-foreground"
                  >
                    {(Object.keys(PROVIDER_LABELS) as AiProvider[]).map((p) => (
                      <option key={p} value={p}>
                        {PROVIDER_LABELS[p]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Modelo</label>
                  <select
                    value={aiModel}
                    onChange={(e) => setAiModel(e.target.value)}
                    className="w-full px-4 py-2 border border-border rounded-xl bg-white text-foreground"
                  >
                    {PROVIDER_MODELS[aiProvider].map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">API Key</label>
                <div className="relative">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    required
                    className="w-full px-4 py-2 border border-border rounded-xl bg-white text-foreground pr-12"
                    placeholder="Cole sua API key aqui"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                  >
                    {showApiKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  A chave é criptografada antes de ser armazenada
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={savingAi}
                  className="px-6 py-2 btn-gradient font-medium"
                >
                  {savingAi ? 'Salvando...' : 'Salvar credencial'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAiForm(false)}
                  className="px-6 py-2 border border-border text-foreground rounded-xl font-medium hover:bg-background"
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}

          <div className="space-y-2">
            {credentials.length === 0 ? (
              <div className="p-8 text-center">
                <Zap className="w-16 h-16 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-foreground font-medium">Nenhuma credencial de IA configurada</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Adicione uma para ativar o atendimento automático
                </p>
              </div>
            ) : (
              credentials.map((cred) => (
                <div
                  key={cred.id}
                  className="flex items-center justify-between p-4 border border-border rounded-xl bg-muted transition-all duration-200 hover:shadow-sm"
                >
                  <div>
                    <p className="font-medium text-foreground flex items-center gap-2">
                      {PROVIDER_LABELS[cred.provider]}
                      {cred.is_primary && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                          Principal
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 font-mono">
                      {cred.key_hint} · {cred.model_id}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeleteCredential(cred.id)}
                    className="p-2 text-destructive hover:bg-destructive/10 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
        )}
        </div>
      </div>
    </div>
  );
}
