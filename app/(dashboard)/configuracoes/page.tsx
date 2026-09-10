'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { createClient } from '@/lib/supabase/client';
import { ensureWorkspace } from '@/lib/workspace';
import { PROVIDER_LABELS, PROVIDER_MODELS, PROVIDER_INFO, AiProvider } from '@/lib/ai-models';
import { ApiKeyGuideModal } from '@/components/api-key-guide-modal';
import { WhatsappQrModal } from '@/components/whatsapp-qr-modal';
import { SkeletonRow } from '@/components/skeleton';
import { StatusBadge } from '@/components/status-badge';
import { QuotaBar } from '@/components/quota-bar';
import { PlanPicker } from '@/components/plan-picker';
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
  Pencil,
  Timer,
  ToggleLeft,
  ToggleRight,
  CreditCard,
  Receipt,
  Download,
  Shuffle,
} from 'lucide-react';

type Section = 'membros' | 'assinatura' | 'whatsapp' | 'roleta' | 'ia';

const SECTION_GROUPS: { label: string; items: { id: Section; label: string; icon: typeof Users }[] }[] = [
  {
    label: 'GERAL',
    items: [
      { id: 'membros', label: 'Membros', icon: Users },
      { id: 'assinatura', label: 'Minha Assinatura', icon: CreditCard },
    ],
  },
  {
    label: 'COMUNICAÇÃO & IA',
    items: [
      { id: 'whatsapp', label: 'WhatsApp', icon: Smartphone },
      { id: 'roleta', label: 'Roleta de Atendimento', icon: Shuffle },
      { id: 'ia', label: 'Provedor de IA', icon: Zap },
    ],
  },
];

interface WorkspaceMember {
  id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'atendente';
  created_at: string;
  email: string | null;
}

interface WhatsAppConnection {
  id: string;
  instance_name: string;
  phone_number: string | null;
  status: 'connected' | 'disconnected' | 'connecting' | 'error';
  min_delay_seconds: number;
  max_delay_seconds: number;
  daily_message_limit: number | null;
  warmup_mode: boolean;
  /** Computed client-side in loadConnections — messages sent since midnight, only when a daily limit is set. */
  messages_today?: number;
}

interface LlmCredential {
  id: string;
  provider: AiProvider;
  key_hint: string | null;
  model_id: string | null;
  is_primary: boolean;
  enabled: boolean;
}

interface PlanInfo {
  id: string;
  name: string;
  price_cents: number;
  product_limit: number;
  member_limit: number;
}

interface WorkspaceBilling {
  plan_id: string | null;
  subscription_status: 'trial' | 'active' | 'overdue' | 'canceled';
  subscription_expires_at: string | null;
  is_complimentary: boolean;
  extra_whatsapp_connections: number;
  plan: PlanInfo | null;
}

interface Invoice {
  id: string;
  amount_cents: number;
  due_date: string;
  status: 'pending' | 'paid' | 'overdue';
  file_url: string | null;
  notes: string | null;
  created_at: string;
  asaas_invoice_url: string | null;
}

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** ≤7 dias ou já vencido pede destaque visual — sem vencimento definido é neutro. */
function subscriptionDueTone(expiresAt: string | null): 'destructive' | 'warning' | 'neutral' {
  if (!expiresAt) return 'neutral';
  const diffDays = (new Date(expiresAt).getTime() - Date.now()) / 86_400_000;
  if (diffDays < 0) return 'destructive';
  if (diffDays <= 7) return 'warning';
  return 'neutral';
}

function subscriptionStatusBadge(
  status: WorkspaceBilling['subscription_status']
): { label: string; active: boolean; tone: 'neutral' | 'warning' | 'destructive' } {
  switch (status) {
    case 'active':
      return { label: 'Ativa', active: true, tone: 'neutral' };
    case 'trial':
      return { label: 'Período de teste', active: false, tone: 'warning' };
    case 'overdue':
      return { label: 'Vencida', active: false, tone: 'destructive' };
    case 'canceled':
      return { label: 'Cancelada', active: false, tone: 'destructive' };
    default:
      return { label: status, active: false, tone: 'neutral' };
  }
}

function invoiceStatusBadge(
  status: Invoice['status']
): { label: string; active: boolean; tone: 'neutral' | 'warning' | 'destructive' } {
  switch (status) {
    case 'paid':
      return { label: 'Paga', active: true, tone: 'neutral' };
    case 'overdue':
      return { label: 'Vencida', active: false, tone: 'destructive' };
    case 'pending':
    default:
      return { label: 'Pendente', active: false, tone: 'warning' };
  }
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
  const [showApiKeyGuide, setShowApiKeyGuide] = useState(false);
  const [aiProvider, setAiProvider] = useState<AiProvider>('openai');
  const [aiModel, setAiModel] = useState(PROVIDER_MODELS.openai[0].id);
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [savingAi, setSavingAi] = useState(false);
  const [activeSection, setActiveSection] = useState<Section>('membros');
  const [editingMember, setEditingMember] = useState<WorkspaceMember | null>(null);
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [savingMember, setSavingMember] = useState(false);
  const [memberError, setMemberError] = useState('');

  const [editingConnection, setEditingConnection] = useState<WhatsAppConnection | null>(null);
  const [editMinDelay, setEditMinDelay] = useState(3);
  const [editMaxDelay, setEditMaxDelay] = useState(8);
  const [editDailyLimit, setEditDailyLimit] = useState<number | ''>('');
  const [editNoLimit, setEditNoLimit] = useState(true);
  const [editWarmupMode, setEditWarmupMode] = useState(true);
  const [savingConnection, setSavingConnection] = useState(false);
  const [connectionError, setConnectionError] = useState('');

  const [workspaceBilling, setWorkspaceBilling] = useState<WorkspaceBilling | null>(null);
  const [productCount, setProductCount] = useState(0);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [downloadingInvoiceId, setDownloadingInvoiceId] = useState<string | null>(null);
  const [showPlanPicker, setShowPlanPicker] = useState(false);
  const [planPickerResult, setPlanPickerResult] = useState<{
    pixQrCode: string | null;
    paymentUrl: string | null;
    warning?: string | null;
  } | null>(null);
  const [cancelingSubscription, setCancelingSubscription] = useState(false);

  const [aiProfileId, setAiProfileId] = useState<string | null>(null);
  const [handoffEnabled, setHandoffEnabled] = useState(false);
  const [handoffTriggerRules, setHandoffTriggerRules] = useState('');
  /** connection_id -> lista de user_id que participam do rodízio daquele
   *  número — vazio pra uma conexão = rodízio usa todos os atendentes/admins
   *  do workspace (comportamento de sempre, sem filtro por número). */
  const [connectionAttendants, setConnectionAttendants] = useState<Record<string, string[]>>({});
  const [savingHandoff, setSavingHandoff] = useState(false);
  const [handoffError, setHandoffError] = useState('');

  useEffect(() => {
    const section = new URLSearchParams(window.location.search).get('section') as Section | null;
    if (
      section === 'whatsapp' ||
      section === 'ia' ||
      section === 'membros' ||
      section === 'assinatura' ||
      section === 'roleta'
    ) {
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
        loadBilling(workspace.workspaceId),
        loadHandoffSettings(workspace.workspaceId),
      ]);
    } catch (err) {
      console.error('Erro ao carregar configurações:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadBilling(wsId: string) {
    const [{ data: wsData, error: wsError }, { count: productsCount }, { data: invoicesData, error: invoicesError }] =
      await Promise.all([
        supabase
          .from('workspaces')
          .select(
            'plan_id, subscription_status, subscription_expires_at, is_complimentary, extra_whatsapp_connections, plans(id, name, price_cents, product_limit, member_limit)'
          )
          .eq('id', wsId)
          .maybeSingle(),
        supabase.from('products').select('id', { count: 'exact', head: true }).eq('workspace_id', wsId),
        supabase
          .from('invoices')
          .select('id, amount_cents, due_date, status, file_url, notes, created_at, asaas_invoice_url')
          .eq('workspace_id', wsId)
          .order('due_date', { ascending: false }),
      ]);

    if (wsError) {
      console.error('Erro ao carregar dados de assinatura:', wsError);
    } else if (wsData) {
      const planRaw = (wsData as unknown as { plans: PlanInfo | PlanInfo[] | null }).plans;
      const plan: PlanInfo | null = Array.isArray(planRaw) ? planRaw[0] ?? null : planRaw ?? null;
      setWorkspaceBilling({
        plan_id: wsData.plan_id,
        subscription_status: wsData.subscription_status,
        subscription_expires_at: wsData.subscription_expires_at,
        is_complimentary: wsData.is_complimentary,
        extra_whatsapp_connections: wsData.extra_whatsapp_connections,
        plan,
      });
    }

    setProductCount(productsCount || 0);

    if (invoicesError) {
      console.error('Erro ao carregar faturas:', invoicesError);
    }
    setInvoices(invoicesData || []);
  }

  function handlePlanSubscribed(result: { pixQrCode: string | null; paymentUrl: string | null; warning?: string | null }) {
    setPlanPickerResult(result);
    setShowPlanPicker(false);
    if (workspaceId) loadBilling(workspaceId);
  }

  async function handleCancelSubscription(action: 'cancel' | 'reactivate') {
    if (action === 'cancel' && !window.confirm('Cancelar a assinatura? Você mantém acesso até o vencimento atual.')) {
      return;
    }

    setCancelingSubscription(true);
    try {
      const res = await fetch('/api/subscription/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const result = await res.json();
      if (!res.ok) {
        alert(result.error || 'Erro ao atualizar assinatura');
        return;
      }
      if (workspaceId) await loadBilling(workspaceId);
    } catch (err) {
      console.error('Erro ao cancelar/reativar assinatura:', err);
      alert('Erro inesperado');
    } finally {
      setCancelingSubscription(false);
    }
  }

  async function loadHandoffSettings(wsId: string) {
    const { data, error: loadError } = await supabase
      .from('ai_profiles')
      .select('id, handoff_enabled, handoff_trigger_rules')
      .eq('workspace_id', wsId)
      .maybeSingle();

    if (loadError) {
      console.error('Erro ao carregar configuração de handoff:', loadError);
      return;
    }

    setAiProfileId(data?.id ?? null);
    setHandoffEnabled(data?.handoff_enabled ?? false);
    setHandoffTriggerRules(data?.handoff_trigger_rules ?? '');
  }

  async function handleSaveHandoff(e: React.FormEvent) {
    e.preventDefault();
    if (!workspaceId) return;

    setSavingHandoff(true);
    setHandoffError('');

    const payload = {
      workspace_id: workspaceId,
      handoff_enabled: handoffEnabled,
      handoff_trigger_rules: handoffTriggerRules || null,
    };

    const { error: saveError } = aiProfileId
      ? await supabase.from('ai_profiles').update(payload).eq('id', aiProfileId)
      : await supabase.from('ai_profiles').insert([payload]);

    if (saveError) {
      setHandoffError('Erro ao salvar: ' + saveError.message);
      setSavingHandoff(false);
      return;
    }

    setSavingHandoff(false);
    await loadHandoffSettings(workspaceId);
  }

  async function handleDownloadInvoice(invoiceId: string) {
    setDownloadingInvoiceId(invoiceId);

    try {
      const res = await fetch(`/api/invoices/download?invoiceId=${invoiceId}`);
      const result = await res.json();

      if (!res.ok) {
        alert('Erro ao baixar fatura: ' + (result.error || ''));
        return;
      }

      window.open(result.url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      alert('Erro inesperado ao baixar fatura');
    } finally {
      setDownloadingInvoiceId(null);
    }
  }

  async function loadMembers(wsId: string) {
    const res = await fetch('/api/workspace/members');
    const result = await res.json();

    if (!res.ok) {
      setError('Erro ao carregar membros: ' + (result.error || ''));
      return;
    }
    setMembers(result.members || []);
  }

  function openEditMember(member: WorkspaceMember) {
    setEditingMember(member);
    setEditEmail(member.email || '');
    setEditPassword('');
    setMemberError('');
  }

  async function handleSaveMember(e: React.FormEvent) {
    e.preventDefault();
    if (!editingMember) return;
    setSavingMember(true);
    setMemberError('');

    try {
      const res = await fetch('/api/workspace/members', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId: editingMember.id,
          email: editEmail !== editingMember.email ? editEmail : undefined,
          password: editPassword || undefined,
        }),
      });
      const result = await res.json();

      if (!res.ok) {
        setMemberError(result.error || 'Erro ao salvar');
        setSavingMember(false);
        return;
      }

      setEditingMember(null);
      if (workspaceId) await loadMembers(workspaceId);
    } catch (err) {
      setMemberError('Erro inesperado ao salvar');
    } finally {
      setSavingMember(false);
    }
  }

  async function loadConnections(wsId: string) {
    const { data } = await supabase
      .from('whatsapp_connections')
      .select('id, instance_name, phone_number, status, min_delay_seconds, max_delay_seconds, daily_message_limit, warmup_mode')
      .eq('workspace_id', wsId)
      .order('created_at', { ascending: false });

    const rows = data || [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Only connections with a configured daily limit need the extra count —
    // this feeds the quota bar with a real "sent today" number, never a guess.
    const withUsage = await Promise.all(
      rows.map(async (conn) => {
        if (!conn.daily_message_limit) return conn;
        const { count } = await supabase
          .from('messages')
          .select('id, conversations!inner(whatsapp_connection_id)', { count: 'exact', head: true })
          .eq('workspace_id', wsId)
          .eq('conversations.whatsapp_connection_id', conn.id)
          .gte('created_at', today.toISOString());
        return { ...conn, messages_today: count || 0 };
      })
    );

    setConnections(withUsage);

    if (rows.length > 0) {
      const { data: attendantRows } = await supabase
        .from('connection_attendants')
        .select('connection_id, user_id')
        .in('connection_id', rows.map((c) => c.id));

      const grouped: Record<string, string[]> = {};
      (attendantRows || []).forEach((row) => {
        grouped[row.connection_id] = [...(grouped[row.connection_id] || []), row.user_id];
      });
      setConnectionAttendants(grouped);
    }
  }

  async function toggleConnectionAttendant(connectionId: string, userId: string) {
    const current = connectionAttendants[connectionId] || [];
    const isIn = current.includes(userId);

    if (isIn) {
      await supabase
        .from('connection_attendants')
        .delete()
        .eq('connection_id', connectionId)
        .eq('user_id', userId);
    } else {
      await supabase.from('connection_attendants').insert([{ connection_id: connectionId, user_id: userId }]);
    }

    setConnectionAttendants((prev) => ({
      ...prev,
      [connectionId]: isIn ? current.filter((id) => id !== userId) : [...current, userId],
    }));
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

  function openEditConnection(conn: WhatsAppConnection) {
    setEditingConnection(conn);
    setEditMinDelay(conn.min_delay_seconds);
    setEditMaxDelay(conn.max_delay_seconds);
    setEditDailyLimit(conn.daily_message_limit ?? '');
    setEditNoLimit(!conn.daily_message_limit);
    setEditWarmupMode(conn.warmup_mode);
    setConnectionError('');
  }

  async function handleSaveConnection(e: React.FormEvent) {
    e.preventDefault();
    if (!editingConnection || !workspaceId) return;

    setSavingConnection(true);
    setConnectionError('');

    const { error: updateError } = await supabase
      .from('whatsapp_connections')
      .update({
        min_delay_seconds: editMinDelay,
        max_delay_seconds: editMaxDelay,
        daily_message_limit: editNoLimit ? null : editDailyLimit || null,
        warmup_mode: editWarmupMode,
      })
      .eq('id', editingConnection.id);

    if (updateError) {
      setConnectionError('Erro ao salvar: ' + updateError.message);
      setSavingConnection(false);
      return;
    }

    setEditingConnection(null);
    setSavingConnection(false);
    await loadConnections(workspaceId);
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

  const attendantCount = members.filter((m) => m.role === 'atendente' || m.role === 'admin').length;

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

      {/* Submenu mobile: grade com quebra de linha, sem os grupos (não cabe a
       *  lista inteira empilhada acima do conteúdo numa tela de celular).
       *  São só 5 itens — quebrar em 2 linhas fica mais limpo que rolagem
       *  horizontal (que mostrava a barra de scroll nativa feia). */}
      <div className="md:hidden flex flex-wrap gap-2 mb-1">
        {SECTION_GROUPS.flatMap((g) => g.items).map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium whitespace-nowrap border transition-colors duration-150 ${
                isActive
                  ? 'bg-primary text-white border-primary'
                  : 'bg-card text-foreground border-border hover:bg-muted'
              }`}
            >
              <Icon className="w-3.5 h-3.5 flex-shrink-0" />
              {item.label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col md:flex-row gap-6 items-start">
        {/* Submenu desktop: lista vertical agrupada */}
        <div className="hidden md:block w-64 shrink-0 bg-card border border-border rounded-2xl shadow-sm p-4">
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
        <div className="flex-1 min-w-0 w-full animate-fade-in" key={activeSection}>
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
                  className="flex items-center justify-between gap-2 p-4 border border-border rounded-xl bg-muted transition-all duration-200 hover:shadow-sm"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
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
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate" title={member.email || 'Sem e-mail'}>
                        {member.email || 'Sem e-mail'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {member.role === 'owner'
                          ? 'Proprietário'
                          : member.role === 'admin'
                          ? 'Administrador'
                          : 'Atendente'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => openEditMember(member)}
                      className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg"
                      title="Editar e-mail e senha"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    {member.role !== 'owner' && (
                      <button
                        onClick={() => handleRemoveMember(member.id)}
                        className="p-2 text-destructive hover:bg-destructive/10 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {editingMember && createPortal(
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 animate-backdrop-in">
              <div className="bg-card rounded-2xl shadow-lg w-full max-w-sm p-6 animate-modal-in">
                <h3 className="text-lg font-semibold text-foreground mb-4">Editar acesso</h3>

                {memberError && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                    {memberError}
                  </div>
                )}

                <form onSubmit={handleSaveMember} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">E-mail</label>
                    <input
                      type="email"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      required
                      className="w-full px-4 py-2 border border-border rounded-xl bg-white text-foreground"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Nova senha (deixe em branco para não alterar)
                    </label>
                    <input
                      type="password"
                      value={editPassword}
                      onChange={(e) => setEditPassword(e.target.value)}
                      minLength={6}
                      placeholder="••••••••"
                      className="w-full px-4 py-2 border border-border rounded-xl bg-white text-foreground"
                    />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button
                      type="submit"
                      disabled={savingMember}
                      className="btn-gradient font-medium px-6 py-2 disabled:opacity-50"
                    >
                      {savingMember ? 'Salvando...' : 'Salvar'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingMember(null)}
                      className="px-6 py-2 border border-border text-foreground rounded-full font-medium hover:bg-background"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              </div>
            </div>,
            document.body
          )}
        </div>
        )}

        {activeSection === 'assinatura' && (
        <div className="bg-card border border-border rounded-2xl shadow-sm p-6">
          <div className="flex items-center gap-3 mb-6">
            <CreditCard className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-semibold text-foreground">Minha Assinatura</h2>
          </div>

          {planPickerResult ? (
            <div className="mb-6 p-4 border border-border rounded-xl bg-muted space-y-3">
              {planPickerResult.warning && (
                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                  {planPickerResult.warning}
                </p>
              )}
              {planPickerResult.pixQrCode && (
                <div className="flex justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`data:image/png;base64,${planPickerResult.pixQrCode}`}
                    alt="QR Code PIX"
                    className="w-40 h-40"
                  />
                </div>
              )}
              {planPickerResult.paymentUrl && (
                <a
                  href={planPickerResult.paymentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full text-center btn-gradient font-medium py-2.5"
                >
                  Pagar com PIX
                </a>
              )}
              <button
                type="button"
                onClick={() => setPlanPickerResult(null)}
                className="w-full text-sm text-muted-foreground hover:text-foreground"
              >
                Fechar
              </button>
            </div>
          ) : !workspaceBilling?.plan && workspaceBilling?.is_complimentary ? (
            <div className="mb-6 p-4 bg-primary/5 border border-primary/20 rounded-xl text-sm text-foreground">
              Acesso privilegiado (cortesia) — sem cobrança.
            </div>
          ) : !workspaceBilling?.plan ? (
            <div className="mb-6">
              {showPlanPicker ? (
                <PlanPicker onSubscribed={handlePlanSubscribed} />
              ) : (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-900 flex items-center justify-between gap-4 flex-wrap">
                  Nenhum plano definido ainda.
                  <button
                    type="button"
                    onClick={() => setShowPlanPicker(true)}
                    className="btn-gradient px-4 py-1.5 text-sm font-medium"
                  >
                    Assinar um plano
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="mb-6 p-4 bg-muted rounded-xl flex items-center justify-between gap-4 flex-wrap">
              <div>
                <p className="text-sm text-muted-foreground">Plano atual</p>
                <p className="text-lg font-semibold text-foreground">{workspaceBilling.plan.name}</p>
              </div>
              <div className="text-right flex items-center gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Valor</p>
                  <p className="text-lg font-semibold text-foreground">
                    {formatCents(workspaceBilling.plan.price_cents)}
                    <span className="text-sm font-normal text-muted-foreground">/mês</span>
                  </p>
                </div>
                {!workspaceBilling.is_complimentary && (
                  <button
                    type="button"
                    onClick={() => setShowPlanPicker((v) => !v)}
                    className="px-3 py-1.5 text-sm font-medium text-primary border border-primary/30 rounded-lg hover:bg-primary/5"
                  >
                    {showPlanPicker ? 'Cancelar' : 'Trocar de plano'}
                  </button>
                )}
              </div>
            </div>
          )}

          {showPlanPicker && workspaceBilling?.plan && (
            <div className="mb-6">
              <PlanPicker onSubscribed={handlePlanSubscribed} />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <div className="p-4 border border-border rounded-2xl bg-muted">
              <QuotaBar
                label="Produtos cadastrados"
                current={productCount}
                max={workspaceBilling?.plan?.product_limit ?? null}
              />
            </div>
            <div className="p-4 border border-border rounded-2xl bg-muted">
              <QuotaBar
                label="Membros da equipe"
                current={members.length}
                max={workspaceBilling?.plan?.member_limit ?? null}
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 p-4 border border-border rounded-2xl bg-muted">
            <div>
              <p className="text-sm text-muted-foreground mb-1.5">Status da assinatura</p>
              {workspaceBilling &&
                (() => {
                  const badge = subscriptionStatusBadge(workspaceBilling.subscription_status);
                  return <StatusBadge label={badge.label} active={badge.active} tone={badge.tone} />;
                })()}
            </div>
            <div className="sm:text-right">
              <p className="text-sm text-muted-foreground mb-1.5">Vencimento</p>
              {(() => {
                const tone = subscriptionDueTone(workspaceBilling?.subscription_expires_at ?? null);
                return (
                  <p
                    className={`text-base font-semibold ${
                      tone === 'destructive'
                        ? 'text-destructive'
                        : tone === 'warning'
                        ? 'text-amber-600'
                        : 'text-foreground'
                    }`}
                  >
                    {workspaceBilling?.subscription_expires_at
                      ? new Date(workspaceBilling.subscription_expires_at).toLocaleDateString('pt-BR')
                      : 'Sem vencimento definido'}
                  </p>
                );
              })()}
            </div>
          </div>

          {workspaceBilling && !workspaceBilling.is_complimentary && (
            <div className="mb-6">
              {workspaceBilling.subscription_status === 'canceled' ? (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-4 flex-wrap">
                  <p className="text-sm text-amber-900">
                    Assinatura cancelada — você mantém acesso até o vencimento acima.
                  </p>
                  <button
                    type="button"
                    onClick={() => handleCancelSubscription('reactivate')}
                    disabled={cancelingSubscription}
                    className="px-4 py-1.5 text-sm font-medium btn-gradient disabled:opacity-50"
                  >
                    Reativar assinatura
                  </button>
                </div>
              ) : (
                workspaceBilling.plan && (
                  <button
                    type="button"
                    onClick={() => handleCancelSubscription('cancel')}
                    disabled={cancelingSubscription}
                    className="text-sm text-muted-foreground hover:text-destructive disabled:opacity-50"
                  >
                    Cancelar assinatura
                  </button>
                )
              )}
            </div>
          )}

          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Receipt className="w-4 h-4 text-primary" /> Faturas
          </h3>

          <div className="space-y-2">
            {invoices.length === 0 ? (
              <div className="p-8 text-center">
                <Receipt className="w-16 h-16 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-foreground font-medium">Nenhuma fatura emitida ainda</p>
              </div>
            ) : (
              invoices.map((invoice) => {
                const badge = invoiceStatusBadge(invoice.status);
                return (
                  <div
                    key={invoice.id}
                    className="flex items-center justify-between gap-4 p-4 border border-border rounded-xl bg-muted transition-all duration-200 hover:shadow-sm"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">{formatCents(invoice.amount_cents)}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Vencimento:{' '}
                        {new Date(`${invoice.due_date}T00:00:00`).toLocaleDateString('pt-BR')}
                      </p>
                      {invoice.notes && (
                        <p className="text-xs text-muted-foreground mt-0.5">{invoice.notes}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <StatusBadge label={badge.label} active={badge.active} tone={badge.tone} />
                      {invoice.status === 'pending' && invoice.asaas_invoice_url && (
                        <a
                          href={invoice.asaas_invoice_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-gradient px-3 py-1.5 text-sm font-medium"
                        >
                          Pagar com PIX
                        </a>
                      )}
                      {invoice.file_url && (
                        <button
                          onClick={() => handleDownloadInvoice(invoice.id)}
                          disabled={downloadingInvoiceId === invoice.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-sm font-medium text-foreground bg-white hover:border-primary/40 hover:text-primary disabled:opacity-50 transition-colors duration-150"
                        >
                          <Download className="w-3.5 h-3.5" />
                          {downloadingInvoiceId === invoice.id ? 'Gerando...' : 'Baixar'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
        )}

        {activeSection === 'whatsapp' && (
        <div className="bg-card border border-border rounded-2xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-3">
              <Smartphone className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold text-foreground">WhatsApp</h2>
            </div>
            {!qrCode && (
              <button
                onClick={handleConnectWhatsapp}
                disabled={connecting || (workspaceBilling ? connections.length >= 1 + workspaceBilling.extra_whatsapp_connections : false)}
                title={
                  workspaceBilling && connections.length >= 1 + workspaceBilling.extra_whatsapp_connections
                    ? 'Limite de números atingido — fale com o suporte para contratar mais uma instância'
                    : undefined
                }
                className="flex items-center gap-2 px-4 py-2 btn-gradient text-sm font-medium disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                {connecting ? 'Gerando QR code...' : 'Conectar WhatsApp'}
              </button>
            )}
          </div>

          {workspaceBilling && (
            <p className="text-xs text-muted-foreground mb-5">
              {connections.length} de {1 + workspaceBilling.extra_whatsapp_connections} número(s) conectado(s)
              {connections.length >= 1 + workspaceBilling.extra_whatsapp_connections &&
                ' — fale com o suporte para contratar uma instância adicional (R$39,90/mês)'}
            </p>
          )}

          <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-900">
              <p className="font-medium mb-1">Risco de banimento do número</p>
              <p>
                Conexão via WhatsApp não-oficial pode banir o número em caso de envio em
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
                  className="flex items-center justify-between gap-4 p-4 border border-border rounded-xl bg-muted transition-all duration-200 hover:shadow-sm"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground flex items-center gap-2">
                      {conn.phone_number ? `+${conn.phone_number}` : conn.instance_name}
                      <StatusBadge
                        label={
                          conn.status === 'connected'
                            ? 'Conectado'
                            : conn.status === 'connecting'
                            ? 'Conectando'
                            : conn.status === 'error'
                            ? 'Erro'
                            : 'Desconectado'
                        }
                        active={conn.status === 'connected'}
                        tone={
                          conn.status === 'connecting'
                            ? 'warning'
                            : conn.status === 'error'
                            ? 'destructive'
                            : 'neutral'
                        }
                      />
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Delay {conn.min_delay_seconds}-{conn.max_delay_seconds}s
                    </p>
                    {conn.daily_message_limit ? (
                      <QuotaBar
                        label="Mensagens hoje"
                        current={conn.messages_today ?? 0}
                        max={conn.daily_message_limit}
                        className="mt-2 max-w-xs"
                      />
                    ) : null}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => openEditConnection(conn)}
                      className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg"
                      title="Editar proteções anti-ban"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteConnection(conn.id)}
                      className="p-2 text-destructive hover:bg-destructive/10 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {editingConnection && createPortal(
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 animate-backdrop-in">
              <div className="bg-card rounded-2xl shadow-lg w-full max-w-md p-6 animate-modal-in">
                <div className="flex items-center gap-2 mb-4">
                  <Timer className="w-4 h-4 text-primary" />
                  <h3 className="text-lg font-semibold text-foreground">
                    Proteções anti-ban — {editingConnection.instance_name}
                  </h3>
                </div>

                {connectionError && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                    {connectionError}
                  </div>
                )}

                <form onSubmit={handleSaveConnection} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Delay entre mensagens: de {editMinDelay} a {editMaxDelay} segundos
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        min={1}
                        value={editMinDelay}
                        onChange={(e) => setEditMinDelay(Number(e.target.value))}
                        className="w-full px-4 py-2 border border-border rounded-xl bg-white text-foreground"
                      />
                      <span className="text-muted-foreground text-sm flex-shrink-0">a</span>
                      <input
                        type="number"
                        min={1}
                        value={editMaxDelay}
                        onChange={(e) => setEditMaxDelay(Number(e.target.value))}
                        className="w-full px-4 py-2 border border-border rounded-xl bg-white text-foreground"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Limite diário de mensagens
                    </label>
                    <input
                      type="number"
                      min={1}
                      disabled={editNoLimit}
                      value={editDailyLimit}
                      onChange={(e) =>
                        setEditDailyLimit(e.target.value === '' ? '' : Number(e.target.value))
                      }
                      className="w-full px-4 py-2 border border-border rounded-xl bg-white text-foreground mb-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      placeholder="ex: 200"
                    />
                    <label className="flex items-center gap-2 text-sm text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={editNoLimit}
                        onChange={(e) => setEditNoLimit(e.target.checked)}
                        className="rounded border-border"
                      />
                      Sem limite
                    </label>
                  </div>

                  <div className="flex items-start justify-between gap-4 p-3 bg-muted rounded-xl">
                    <div>
                      <p className="text-sm font-medium text-foreground">Modo aquecimento</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Reduz o volume de envio nos primeiros dias para evitar banimento do número.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditWarmupMode(!editWarmupMode)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 flex-shrink-0 ${
                        editWarmupMode
                          ? 'gradient-brand text-white shadow-sm'
                          : 'bg-white text-muted-foreground border border-border'
                      }`}
                    >
                      {editWarmupMode ? (
                        <ToggleRight className="w-4 h-4" />
                      ) : (
                        <ToggleLeft className="w-4 h-4" />
                      )}
                      {editWarmupMode ? 'Ativado' : 'Desativado'}
                    </button>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      type="submit"
                      disabled={savingConnection}
                      className="btn-gradient font-medium px-6 py-2 disabled:opacity-50"
                    >
                      {savingConnection ? 'Salvando...' : 'Salvar'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingConnection(null)}
                      className="px-6 py-2 border border-border text-foreground rounded-full font-medium hover:bg-background"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              </div>
            </div>,
            document.body
          )}
        </div>
        )}

        {activeSection === 'roleta' && (
        <div className="bg-card border border-border rounded-2xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Shuffle className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold text-foreground">Roleta de Atendimento</h2>
            </div>
            <button
              type="button"
              onClick={() => setHandoffEnabled(!handoffEnabled)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                handoffEnabled ? 'gradient-brand text-white shadow-sm' : 'bg-muted text-muted-foreground'
              }`}
            >
              {handoffEnabled ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
              {handoffEnabled ? 'Ativar transferência para humano: Ativado' : 'Ativar transferência para humano: Desativado'}
            </button>
          </div>

          <p className="text-sm text-muted-foreground mb-6">
            Quando ativado, a IA transfere a conversa para um atendente humano automaticamente e para
            de responder — a partir daí o atendimento é manual, até alguém ligar a IA de novo na
            conversa (em Atendimento).
          </p>

          <div className="mb-6 p-4 bg-muted rounded-xl">
            <p className="text-sm font-medium text-foreground mb-2">Gatilhos sempre ativos</p>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                Cliente pede explicitamente para falar com um atendente
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                A IA ficou incerta sobre o andamento do negócio em respostas consecutivas
              </li>
            </ul>
          </div>

          <form onSubmit={handleSaveHandoff} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Gatilhos adicionais
              </label>
              <textarea
                value={handoffTriggerRules}
                onChange={(e) => setHandoffTriggerRules(e.target.value)}
                className="w-full px-4 py-2 border border-border rounded-xl bg-white text-foreground"
                placeholder="ex: cliente demonstrando raiva ou fazendo reclamação grave; pergunta técnica que foge do catálogo"
                rows={3}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Descreva outras situações em que a IA deve transferir a conversa, além dos gatilhos
                sempre ativos acima.
              </p>
            </div>

            {handoffError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {handoffError}
              </div>
            )}

            <button
              type="submit"
              disabled={savingHandoff}
              className="px-6 py-2 btn-gradient font-medium disabled:opacity-50"
            >
              {savingHandoff ? 'Salvando...' : 'Salvar'}
            </button>
          </form>

          {connections.length > 1 && (
            <div className="mt-6 pt-6 border-t border-border">
              <h3 className="text-sm font-semibold text-foreground mb-1">Atendentes por número</h3>
              <p className="text-xs text-muted-foreground mb-4">
                Seu workspace tem mais de um número de WhatsApp conectado. Escolha quais atendentes
                participam do rodízio de cada número — sem nenhum marcado, o rodízio usa todos os
                atendentes/admins do workspace (comportamento padrão).
              </p>
              <div className="space-y-4">
                {connections.map((conn) => (
                  <div key={conn.id} className="p-4 border border-border rounded-xl bg-muted">
                    <p className="text-sm font-medium text-foreground mb-2">
                      {conn.phone_number ? `+${conn.phone_number}` : conn.instance_name}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {members
                        .filter((m) => m.role === 'atendente' || m.role === 'admin')
                        .map((m) => {
                          const active = (connectionAttendants[conn.id] || []).includes(m.user_id);
                          return (
                            <button
                              key={m.user_id}
                              type="button"
                              onClick={() => toggleConnectionAttendant(conn.id, m.user_id)}
                              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors duration-150 ${
                                active
                                  ? 'bg-primary text-white border-primary'
                                  : 'border-border text-muted-foreground hover:bg-white'
                              }`}
                            >
                              {m.email || 'Membro'}
                            </button>
                          );
                        })}
                      {members.filter((m) => m.role === 'atendente' || m.role === 'admin').length === 0 && (
                        <p className="text-xs text-muted-foreground">
                          Nenhum atendente/admin cadastrado ainda — adicione em Membros.
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div
            className={`mt-6 p-4 rounded-xl border flex items-start gap-3 ${
              attendantCount === 0 ? 'bg-amber-50 border-amber-200' : 'bg-muted border-border'
            }`}
          >
            <Users
              className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                attendantCount === 0 ? 'text-amber-600' : 'text-muted-foreground'
              }`}
            />
            <div className="text-sm">
              <p className="font-medium text-foreground">
                {attendantCount} {attendantCount === 1 ? 'atendente cadastrado' : 'atendentes cadastrados'}
              </p>
              {attendantCount === 0 && (
                <p className="text-amber-800 mt-0.5">
                  Nenhum atendente cadastrado — a roleta não vai funcionar até você adicionar um em
                  Membros.
                </p>
              )}
            </div>
          </div>
        </div>
        )}

        {activeSection === 'ia' && (
        <div className="bg-card border border-border rounded-2xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Zap className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold text-foreground">Provedor de IA</h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowApiKeyGuide(true)}
                className="px-4 py-2 border border-border text-foreground rounded-xl font-medium text-sm hover:bg-muted"
              >
                Guia de uso
              </button>
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
          </div>

          {showAiForm && (
            <form onSubmit={handleAddCredential} className="mb-4 p-4 bg-muted rounded-xl space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-foreground">Provider</label>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        PROVIDER_INFO[aiProvider].tag === 'free'
                          ? 'bg-success/10 text-success'
                          : PROVIDER_INFO[aiProvider].tag === 'free-tier'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {PROVIDER_INFO[aiProvider].tagLabel}
                    </span>
                  </div>
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
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-foreground">API Key</label>
                  <a
                    href={PROVIDER_INFO[aiProvider].keysUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    Onde conseguir a chave da {PROVIDER_LABELS[aiProvider]}?
                  </a>
                </div>
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
                      {cred.is_primary && <StatusBadge label="Principal" />}
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

      {showApiKeyGuide && <ApiKeyGuideModal onClose={() => setShowApiKeyGuide(false)} />}
    </div>
  );
}
