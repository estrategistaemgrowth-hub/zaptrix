'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ensureWorkspace } from '@/lib/workspace';
import {
  Send,
  MessageCircle,
  Clock,
  Bot,
  BotOff,
  CheckCircle2,
  MessagesSquare,
  List,
  KanbanSquare,
  ArrowRight,
  Paperclip,
  FileText,
  Brain,
  AlertTriangle,
  Check,
  CheckCheck,
} from 'lucide-react';
import { TypingIndicator } from '@/components/typing-indicator';
import { SkeletonRow } from '@/components/skeleton';
import { StatusBadge } from '@/components/status-badge';

interface Conversation {
  id: string;
  status: 'open' | 'closed' | 'archived' | 'follow_up' | 'won' | 'lost';
  ai_enabled: boolean;
  needs_review: boolean;
  last_message_at: string | null;
  unread_count: number | null;
  contact: {
    name: string | null;
    push_name: string | null;
    phone: string;
    ai_memory: string | null;
  } | null;
  last_message?: {
    content: string | null;
    sender_type: 'customer' | 'ai' | 'human' | 'system';
  } | null;
}

/** Colunas do Kanban — funil de vendas construído sobre o enum
 *  `conversation_status` do banco (supabase/migrations/0001_create_zaptrix_schema.sql
 *  + 0021_deal_stages_and_message_status.sql: acrescenta 'follow_up' | 'won' | 'lost').
 *  'closed' e 'archived' continuam existindo no enum mas não são mais colunas
 *  centrais do Kanban — a IA e o humano trabalham o funil por aqui. */
const KANBAN_COLUMNS: { status: Conversation['status']; label: string; dot: string }[] = [
  { status: 'open', label: 'Aberta', dot: 'bg-emerald-500' },
  { status: 'follow_up', label: 'Follow-up', dot: 'bg-blue-500' },
  { status: 'won', label: 'Negócio Fechado', dot: 'bg-green-600' },
  { status: 'lost', label: 'Negócio Perdido', dot: 'bg-destructive' },
];

function statusLabel(status: Conversation['status']): string {
  switch (status) {
    case 'open':
      return 'Aberta';
    case 'follow_up':
      return 'Follow-up';
    case 'won':
      return 'Negócio Fechado';
    case 'lost':
      return 'Negócio Perdido';
    case 'archived':
      return 'Arquivada';
    case 'closed':
    default:
      return 'Fechada';
  }
}

function statusDotClass(status: Conversation['status']): string {
  switch (status) {
    case 'open':
      return 'bg-emerald-500';
    case 'follow_up':
      return 'bg-blue-500';
    case 'won':
      return 'bg-green-600';
    case 'lost':
      return 'bg-destructive';
    case 'archived':
      return 'bg-amber-500';
    case 'closed':
    default:
      return 'bg-gray-400';
  }
}

const VIEW_MODE_STORAGE_KEY = 'zaptrix:atendimento:view-mode';

function timeAgo(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'agora';
  if (diffMin < 60) return `há ${diffMin} min`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `há ${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  return `há ${diffDays}d`;
}

type MessageType = 'text' | 'image' | 'audio' | 'video' | 'document' | 'sticker';

type WaStatus = 'sent' | 'delivered' | 'read' | 'failed';

interface Message {
  id: string;
  conversation_id: string;
  sender_type: 'customer' | 'ai' | 'human' | 'system';
  message_type?: MessageType | null;
  content: string | null;
  media_url?: string | null;
  media_mime_type?: string | null;
  media_caption?: string | null;
  transcript?: string | null;
  wa_status?: WaStatus | null;
  created_at: string;
}

const MAX_ATTACHMENT_SIZE_BYTES = 16 * 1024 * 1024; // 16MB — limite comum do WhatsApp

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // reader.result vem como data URI ("data:image/png;base64,AAAA...") —
      // a Evolution API espera só o base64 puro, sem o prefixo.
      const base64 = result.split(',')[1] || '';
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function AtendimentoPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [messageInput, setMessageInput] = useState('');
  const [sending, setSending] = useState(false);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [showTyping, setShowTyping] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<Conversation['status'] | null>(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  useEffect(() => {
    init();
  }, []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(VIEW_MODE_STORAGE_KEY);
      if (stored === 'kanban' || stored === 'list') setViewMode(stored);
    } catch {
      // localStorage indisponível (modo privado, storage bloqueado etc.) — mantém "list"
    }
  }, []);

  function handleSetViewMode(mode: 'list' | 'kanban') {
    setViewMode(mode);
    try {
      localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
    } catch {
      // ignora — preferência só não persiste
    }
  }

  useEffect(() => {
    if (!workspaceId) return;
    const interval = setInterval(() => loadConversations(workspaceId), 3000);
    return () => clearInterval(interval);
  }, [workspaceId]);

  useEffect(() => {
    if (selectedConversation) {
      loadMessages(selectedConversation.id);
      const interval = setInterval(() => loadMessages(selectedConversation.id), 2000);
      return () => clearInterval(interval);
    }
  }, [selectedConversation?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
      await loadConversations(workspace.workspaceId);
    } catch (err) {
      console.error('Erro ao carregar atendimento:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadConversations(wsId: string) {
    const { data, error: loadError } = await supabase
      .from('conversations')
      .select(
        'id, status, needs_review, ai_enabled, last_message_at, unread_count, contact:contacts(name, push_name, phone, ai_memory), messages(content, sender_type, created_at)'
      )
      .eq('workspace_id', wsId)
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false, foreignTable: 'messages' })
      .limit(1, { foreignTable: 'messages' });

    if (loadError) {
      console.error('Erro ao carregar conversas:', loadError);
      setError('Erro ao carregar conversas: ' + loadError.message);
      return;
    }

    const normalized = (data || []).map((c: any) => ({
      ...c,
      contact: Array.isArray(c.contact) ? c.contact[0] ?? null : c.contact,
      last_message: Array.isArray(c.messages) ? c.messages[0] ?? null : c.messages ?? null,
    }));

    setConversations(normalized);

    setSelectedConversation((current) =>
      current ? normalized.find((c) => c.id === current.id) || current : current
    );
  }

  async function handleSelectConversation(conv: Conversation) {
    setSelectedConversation(conv);

    const shouldClearUnread = !!conv.unread_count;
    const shouldClearReview = !!conv.needs_review;
    if (!shouldClearUnread && !shouldClearReview) return;

    // Zera localmente na hora (feedback imediato) e persiste no banco — sem
    // isso, o próximo polling de loadConversations traria o valor antigo de
    // volta e a notificação/tag "voltaria" sozinha. Abrir o card já conta como
    // o humano "interagindo" com ele — resolve a tag "Analisar conversa"
    // junto com o zerar do não lido.
    setConversations((current) =>
      current.map((c) =>
        c.id === conv.id
          ? {
              ...c,
              unread_count: shouldClearUnread ? 0 : c.unread_count,
              needs_review: shouldClearReview ? false : c.needs_review,
            }
          : c
      )
    );

    const updatePayload: Record<string, unknown> = {};
    if (shouldClearUnread) updatePayload.unread_count = 0;
    if (shouldClearReview) updatePayload.needs_review = false;

    await supabase.from('conversations').update(updatePayload).eq('id', conv.id);
  }

  async function loadMessages(conversationId: string) {
    const { data, error: loadError } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (loadError) {
      console.error('Erro ao carregar mensagens:', loadError);
      return;
    }

    setMessages(data || []);
  }

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!messageInput.trim() || !selectedConversation || !workspaceId) return;

    setSending(true);

    try {
      const res = await fetch('/api/whatsapp/send-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: selectedConversation.id, text: messageInput }),
      });
      const result = await res.json();

      if (!res.ok) {
        alert('Erro ao enviar mensagem: ' + (result.error || ''));
        setSending(false);
        return;
      }

      if (result.warning) {
        alert(result.warning);
      }
    } catch (err) {
      alert('Erro inesperado ao enviar mensagem');
      setSending(false);
      return;
    }

    setMessageInput('');
    await loadMessages(selectedConversation.id);
    setSending(false);

    // Decorative only: simulates the AI "reading" the message it will
    // eventually reply to. No real generation is triggered here.
    if (selectedConversation.ai_enabled) {
      setShowTyping(true);
      window.setTimeout(() => setShowTyping(false), 1700);
    }
  }

  async function handleAttachmentSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!file || !selectedConversation || !workspaceId) return;

    if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
      alert('Arquivo muito grande. O limite é 16MB.');
      return;
    }

    setUploadingMedia(true);

    try {
      const base64 = await fileToBase64(file);
      const res = await fetch('/api/whatsapp/send-media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: selectedConversation.id,
          base64,
          mimeType: file.type || 'application/octet-stream',
          fileName: file.name,
        }),
      });
      const result = await res.json();

      if (!res.ok) {
        alert('Erro ao enviar arquivo: ' + (result.error || ''));
        return;
      }

      if (result.warning) {
        alert(result.warning);
      }

      await loadMessages(selectedConversation.id);
    } catch (err) {
      console.error('Erro inesperado ao enviar arquivo:', err);
      alert('Erro inesperado ao enviar arquivo');
    } finally {
      setUploadingMedia(false);
    }
  }

  async function handleToggleAI() {
    if (!selectedConversation || !workspaceId) return;

    const newValue = !selectedConversation.ai_enabled;

    const { error: updateError } = await supabase
      .from('conversations')
      .update({ ai_enabled: newValue })
      .eq('id', selectedConversation.id);

    if (updateError) {
      alert('Erro ao atualizar IA: ' + updateError.message);
      return;
    }

    setSelectedConversation({ ...selectedConversation, ai_enabled: newValue });
    await loadConversations(workspaceId);
  }

  async function handleCloseConversation() {
    if (!selectedConversation || !workspaceId) return;

    const { error: updateError } = await supabase
      .from('conversations')
      .update({ status: 'closed', needs_review: false })
      .eq('id', selectedConversation.id);

    if (updateError) {
      alert('Erro ao encerrar conversa: ' + updateError.message);
      return;
    }

    await loadConversations(workspaceId);
  }

  function contactLabel(contact: Conversation['contact']) {
    return contact?.name || contact?.push_name || contact?.phone || 'Contato';
  }

  async function handleChangeStatus(conversationId: string, newStatus: Conversation['status']) {
    if (!workspaceId) return;

    const previous = conversations;

    // Mover manualmente (drag ou botão "Mover para X") é sempre ação humana —
    // conta como revisão feita, então zera a tag "Analisar conversa" junto.
    // Atualização otimista — o Kanban reage na hora, sem esperar o round-trip.
    setConversations((prev) =>
      prev.map((c) => (c.id === conversationId ? { ...c, status: newStatus, needs_review: false } : c))
    );
    setSelectedConversation((current) =>
      current && current.id === conversationId
        ? { ...current, status: newStatus, needs_review: false }
        : current
    );

    const { error: updateError } = await supabase
      .from('conversations')
      .update({ status: newStatus, needs_review: false })
      .eq('id', conversationId);

    if (updateError) {
      console.error('Erro ao mover conversa:', updateError);
      alert('Erro ao mover conversa: ' + updateError.message);
      setConversations(previous);
      await loadConversations(workspaceId);
    }
  }

  function handleCardDragStart(e: React.DragEvent<HTMLDivElement>, conversationId: string) {
    setDraggedId(conversationId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', conversationId);
  }

  function handleCardDragEnd() {
    setDraggedId(null);
    setDragOverColumn(null);
  }

  function handleColumnDragOver(e: React.DragEvent<HTMLDivElement>, status: Conversation['status']) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverColumn !== status) setDragOverColumn(status);
  }

  function handleColumnDragLeave(status: Conversation['status']) {
    setDragOverColumn((current) => (current === status ? null : current));
  }

  function handleColumnDrop(e: React.DragEvent<HTMLDivElement>, status: Conversation['status']) {
    e.preventDefault();
    const conversationId = e.dataTransfer.getData('text/plain') || draggedId;
    setDragOverColumn(null);
    setDraggedId(null);
    if (!conversationId) return;

    const conv = conversations.find((c) => c.id === conversationId);
    if (!conv || conv.status === status) return;

    handleChangeStatus(conversationId, status);
  }

  return (
    <div className="p-2 flex flex-col h-[calc(100vh-2rem)]">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <MessageCircle className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Atendimento</h1>
            <p className="text-sm text-muted-foreground">{conversations.length} conversas</p>
          </div>
        </div>

        <div className="flex items-center border border-border rounded-lg overflow-hidden">
          <button
            onClick={() => handleSetViewMode('list')}
            title="Ver em lista"
            className={`p-2.5 transition-colors duration-150 ${
              viewMode === 'list'
                ? 'bg-primary text-white'
                : 'bg-white text-muted-foreground hover:bg-muted'
            }`}
          >
            <List className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleSetViewMode('kanban')}
            title="Ver em kanban"
            className={`p-2.5 transition-colors duration-150 ${
              viewMode === 'kanban'
                ? 'bg-primary text-white'
                : 'bg-white text-muted-foreground hover:bg-muted'
            }`}
          >
            <KanbanSquare className="w-4 h-4" />
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex-1 flex overflow-hidden gap-5">
        {viewMode === 'list' ? (
        <div className="w-80 bg-card border border-border rounded-2xl shadow-sm flex flex-col overflow-hidden">
          <div className="p-4 border-b border-border bg-muted">
            <h2 className="font-semibold text-foreground">Conversas</h2>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="divide-y divide-border">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3 p-4">
                    <div className="w-10 h-10 rounded-full bg-muted animate-pulse flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3.5 w-2/3 bg-muted animate-pulse rounded-full" />
                      <div className="h-3 w-1/3 bg-muted animate-pulse rounded-full" />
                    </div>
                  </div>
                ))}
              </div>
            ) : conversations.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground">
                <MessageCircle className="w-16 h-16 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-foreground font-medium">Nenhuma conversa ainda</p>
                <p className="text-xs mt-1">
                  Conversas aparecem aqui quando um cliente escreve pelo WhatsApp
                </p>
              </div>
            ) : (
              conversations.map((conv) => {
                const label = contactLabel(conv.contact);
                const initial = label.charAt(0).toUpperCase();
                return (
                <button
                  key={conv.id}
                  onClick={() => handleSelectConversation(conv)}
                  className={`w-full p-4 border-b border-border text-left transition-all duration-200 ${
                    selectedConversation?.id === conv.id
                      ? 'bg-primary/5 font-semibold'
                      : 'hover:bg-muted'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="relative flex-shrink-0">
                      <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-sm">
                        {initial}
                      </div>
                      <span
                        title={statusLabel(conv.status)}
                        className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full ring-2 ring-card ${statusDotClass(
                          conv.status
                        )}`}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <p className="font-medium text-foreground line-clamp-1">{label}</p>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-1">
                        {conv.contact?.phone || '—'}
                      </p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {conv.last_message_at && (
                          <p className="text-xs text-muted-foreground">
                            <Clock className="w-3 h-3 inline mr-1" />
                            {new Date(conv.last_message_at).toLocaleTimeString('pt-BR', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        )}
                        {conv.ai_enabled ? (
                          <span className="flex items-center gap-1 text-xs text-primary">
                            <Bot className="w-3 h-3" /> IA
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <BotOff className="w-3 h-3" /> Manual
                          </span>
                        )}
                        {conv.needs_review && (
                          <StatusBadge
                            label="Analisar conversa"
                            icon={AlertTriangle}
                            active={false}
                            tone="warning"
                            className="!py-0.5 !text-[10px]"
                          />
                        )}
                      </div>
                    </div>
                  </div>
                </button>
                );
              })
            )}
          </div>
        </div>
        ) : (
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 overflow-hidden">
          {KANBAN_COLUMNS.map((col) => {
            const columnConversations = conversations.filter((c) => c.status === col.status);
            const otherColumns = KANBAN_COLUMNS.filter((c) => c.status !== col.status);

            return (
              <div
                key={col.status}
                onDragOver={(e) => handleColumnDragOver(e, col.status)}
                onDragLeave={() => handleColumnDragLeave(col.status)}
                onDrop={(e) => handleColumnDrop(e, col.status)}
                className={`bg-card border rounded-2xl shadow-sm flex flex-col overflow-hidden transition-colors duration-200 ${
                  dragOverColumn === col.status ? 'border-primary ring-2 ring-primary/20' : 'border-border'
                }`}
              >
                <div className="p-4 border-b border-border bg-muted flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${col.dot}`} />
                  <h2 className="font-semibold text-foreground">{col.label}</h2>
                  <span className="ml-auto text-xs font-medium text-muted-foreground bg-card border border-border rounded-full px-2 py-0.5">
                    {columnConversations.length}
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                  {loading ? (
                    <>
                      <SkeletonRow />
                      <SkeletonRow />
                    </>
                  ) : columnConversations.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground py-10">
                      <p className="text-xs">Nenhuma conversa aqui</p>
                    </div>
                  ) : (
                    columnConversations.map((conv) => {
                      const label = contactLabel(conv.contact);
                      const initial = label.charAt(0).toUpperCase();
                      const preview = conv.last_message?.content?.trim() || 'Sem mensagens ainda';
                      const ago = timeAgo(conv.last_message_at);

                      return (
                        <div
                          key={conv.id}
                          draggable
                          onDragStart={(e) => handleCardDragStart(e, conv.id)}
                          onDragEnd={handleCardDragEnd}
                          onClick={() => handleSelectConversation(conv)}
                          data-dragging={draggedId === conv.id}
                          className={`kanban-card bg-white border rounded-2xl p-3.5 cursor-grab active:cursor-grabbing animate-fade-in ${
                            selectedConversation?.id === conv.id
                              ? 'border-primary/40 ring-1 ring-primary/20'
                              : 'border-border'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-2.5">
                            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                              {conv.ai_enabled ? (
                                <StatusBadge label="IA" icon={Bot} active className="!py-0.5 !text-[11px]" />
                              ) : (
                                <StatusBadge
                                  label="Manual"
                                  icon={BotOff}
                                  active={false}
                                  tone="neutral"
                                  className="!py-0.5 !text-[11px]"
                                />
                              )}
                              {conv.needs_review && (
                                <StatusBadge
                                  label="Analisar conversa"
                                  icon={AlertTriangle}
                                  active={false}
                                  tone="warning"
                                  className="!py-0.5 !text-[11px]"
                                />
                              )}
                            </div>
                            {typeof conv.unread_count === 'number' && conv.unread_count > 0 && (
                              <span className="flex-shrink-0 min-w-[20px] h-5 px-1.5 flex items-center justify-center gradient-brand text-white text-[11px] font-semibold rounded-full shadow-sm">
                                {conv.unread_count}
                              </span>
                            )}
                          </div>

                          <div className="flex items-start gap-2.5">
                            <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-xs flex-shrink-0">
                              {initial}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-foreground text-sm line-clamp-1">{label}</p>
                              <p className="text-xs text-muted-foreground line-clamp-1">
                                {conv.contact?.phone || '—'}
                              </p>
                            </div>
                          </div>

                          <p className="text-xs text-muted-foreground line-clamp-2 mt-2.5 leading-relaxed">
                            {preview}
                          </p>

                          <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                            {ago ? (
                              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                <Clock className="w-3 h-3" />
                                {ago}
                              </span>
                            ) : (
                              <span />
                            )}
                            <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-[10px] ring-2 ring-card">
                              {initial}
                            </div>
                          </div>

                          {otherColumns.length > 0 && (
                            <div className="flex items-center gap-1.5 mt-2.5 pt-2.5 border-t border-border">
                              {otherColumns.map((target) => (
                                <button
                                  key={target.status}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleChangeStatus(conv.id, target.status);
                                  }}
                                  title={`Mover para ${target.label}`}
                                  className="flex-1 flex items-center justify-center gap-1 px-2 py-1 text-[11px] font-medium text-muted-foreground border border-border rounded-lg hover:bg-muted hover:text-foreground transition-colors duration-150"
                                >
                                  <ArrowRight className="w-3 h-3" />
                                  {target.label}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
        )}

        {/* Chat */}
        <div
          className={`bg-card border border-border rounded-2xl shadow-sm flex flex-col overflow-hidden ${
            viewMode === 'kanban' ? 'w-96 flex-shrink-0' : 'flex-1'
          }`}
        >
          {selectedConversation ? (
            <>
              {/* Header */}
              <div className="p-6 border-b border-border bg-muted flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold text-foreground">
                    {contactLabel(selectedConversation.contact)}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {selectedConversation.contact?.phone}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleToggleAI}
                    title={selectedConversation.ai_enabled ? 'Desligar IA (assumir manualmente)' : 'Ligar IA'}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full font-medium border transition-all duration-200 ${
                      selectedConversation.ai_enabled
                        ? 'gradient-brand text-white border-transparent shadow-sm'
                        : 'bg-gray-100 text-muted-foreground border-border'
                    }`}
                  >
                    {selectedConversation.ai_enabled ? (
                      <Bot className="w-4 h-4" />
                    ) : (
                      <BotOff className="w-4 h-4" />
                    )}
                    {selectedConversation.ai_enabled ? 'IA ativa' : 'IA pausada'}
                  </button>

                  {selectedConversation.status === 'open' && (
                    <button
                      onClick={handleCloseConversation}
                      className="flex items-center gap-2 px-4 py-2 bg-destructive text-white rounded-lg font-medium hover:opacity-90"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Encerrar
                    </button>
                  )}
                </div>
              </div>

              {selectedConversation.contact?.ai_memory && (
                <div className="px-6 py-3 bg-primary/5 border-b border-border flex items-start gap-2.5">
                  <Brain className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-foreground/80 whitespace-pre-line leading-relaxed">
                    <span className="font-medium text-primary">Memória da IA sobre este cliente: </span>
                    {selectedConversation.contact.ai_memory}
                  </p>
                </div>
              )}

              {/* Mensagens */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-card">
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground">
                    <MessagesSquare className="w-16 h-16 text-muted-foreground/40 mb-3" />
                    <p className="text-foreground font-medium">Sem mensagens ainda</p>
                    <p className="text-sm mt-1">Envie a primeira mensagem para começar a conversa</p>
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${
                        msg.sender_type === 'customer' ? 'justify-start' : 'justify-end'
                      }`}
                    >
                      <div
                        className={`max-w-xs px-4 py-2 rounded-lg ${
                          msg.sender_type === 'human'
                            ? 'bg-primary text-white'
                            : msg.sender_type === 'ai'
                            ? 'bg-blue-100 text-foreground border border-blue-200'
                            : msg.sender_type === 'customer'
                            ? 'bg-gray-100 text-foreground'
                            : 'bg-yellow-50 text-foreground border border-yellow-200'
                        }`}
                      >
                        {msg.sender_type !== 'human' && msg.sender_type !== 'customer' && (
                          <p className="text-xs font-semibold mb-1 opacity-75">
                            {msg.sender_type === 'ai' ? 'IA' : 'Sistema'}
                          </p>
                        )}

                        {msg.message_type && msg.message_type !== 'text' && msg.media_url ? (
                          <div className="space-y-1.5">
                            {(msg.message_type === 'image' || msg.message_type === 'sticker') && (
                              <img
                                src={msg.media_url}
                                alt={msg.media_caption || 'Imagem'}
                                className="max-w-full rounded-lg max-h-64 object-contain"
                              />
                            )}
                            {msg.message_type === 'video' && (
                              <video src={msg.media_url} controls className="max-w-full rounded-lg max-h-64" />
                            )}
                            {msg.message_type === 'audio' && (
                              <div className="space-y-1">
                                <audio src={msg.media_url} controls className="max-w-full" />
                                {msg.transcript && (
                                  <p className="text-xs italic opacity-80 whitespace-pre-wrap">
                                    &ldquo;{msg.transcript}&rdquo;
                                  </p>
                                )}
                              </div>
                            )}
                            {msg.message_type === 'document' && (
                              <a
                                href={msg.media_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 underline text-sm"
                              >
                                <FileText className="w-4 h-4 flex-shrink-0" />
                                {msg.media_caption || 'Ver documento'}
                              </a>
                            )}
                            {msg.media_caption && msg.message_type !== 'audio' && msg.message_type !== 'document' && (
                              <p className="text-sm whitespace-pre-wrap">{msg.media_caption}</p>
                            )}
                          </div>
                        ) : (
                          <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                        )}

                        <p className="text-xs opacity-70 mt-1 flex items-center justify-end gap-1">
                          <span>
                            {new Date(msg.created_at).toLocaleTimeString('pt-BR', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          {msg.sender_type !== 'customer' && msg.wa_status === 'sent' && (
                            <Check className="w-3.5 h-3.5 flex-shrink-0" />
                          )}
                          {msg.sender_type !== 'customer' && msg.wa_status === 'delivered' && (
                            <CheckCheck className="w-3.5 h-3.5 flex-shrink-0" />
                          )}
                          {msg.sender_type !== 'customer' && msg.wa_status === 'read' && (
                            <CheckCheck className="w-3.5 h-3.5 flex-shrink-0 text-sky-400" />
                          )}
                        </p>
                      </div>
                    </div>
                  ))
                )}
                {showTyping && (
                  <div className="flex justify-end">
                    <TypingIndicator label="IA está digitando uma resposta" />
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <form onSubmit={handleSendMessage} className="p-6 border-t border-border bg-muted">
                <div className="flex gap-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,audio/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx"
                    onChange={handleAttachmentSelected}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingMedia}
                    title="Anexar arquivo"
                    className="flex items-center justify-center w-10 h-10 flex-shrink-0 border border-border rounded-xl bg-white text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors duration-150 disabled:opacity-50"
                  >
                    {uploadingMedia ? (
                      <span className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                    ) : (
                      <Paperclip className="w-4 h-4" />
                    )}
                  </button>
                  <input
                    type="text"
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    placeholder="Digite uma mensagem..."
                    className="flex-1 px-4 py-2 border border-border rounded-xl bg-white text-foreground"
                  />
                  <button
                    type="submit"
                    disabled={sending || !messageInput.trim()}
                    className="flex items-center gap-2 px-6 py-2 btn-gradient font-medium"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center text-muted-foreground p-6">
              <MessageCircle className="w-16 h-16 text-muted-foreground/40 mb-3" />
              <p className="text-foreground font-medium">Selecione uma conversa</p>
              <p className="text-sm mt-1">Escolha um contato na lista ao lado para ver o histórico</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
