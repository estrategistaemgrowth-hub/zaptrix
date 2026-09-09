'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ensureWorkspace } from '@/lib/workspace';
import { Send, MessageCircle, Clock, Bot, BotOff, CheckCircle2 } from 'lucide-react';

interface Conversation {
  id: string;
  status: 'open' | 'closed' | 'archived';
  ai_enabled: boolean;
  last_message_at: string | null;
  contact: {
    name: string | null;
    push_name: string | null;
    phone: string;
  } | null;
}

interface Message {
  id: string;
  conversation_id: string;
  sender_type: 'customer' | 'ai' | 'human' | 'system';
  content: string | null;
  created_at: string;
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  useEffect(() => {
    init();
  }, []);

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
      .select('id, status, ai_enabled, last_message_at, contact:contacts(name, push_name, phone)')
      .eq('workspace_id', wsId)
      .order('last_message_at', { ascending: false, nullsFirst: false });

    if (loadError) {
      console.error('Erro ao carregar conversas:', loadError);
      setError('Erro ao carregar conversas: ' + loadError.message);
      return;
    }

    const normalized = (data || []).map((c: any) => ({
      ...c,
      contact: Array.isArray(c.contact) ? c.contact[0] ?? null : c.contact,
    }));

    setConversations(normalized);

    setSelectedConversation((current) =>
      current ? normalized.find((c) => c.id === current.id) || current : current
    );
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

    const { error: sendError } = await supabase.from('messages').insert([
      {
        workspace_id: workspaceId,
        conversation_id: selectedConversation.id,
        sender_type: 'human',
        direction: 'outbound',
        content: messageInput,
      },
    ]);

    if (sendError) {
      console.error('Erro ao enviar mensagem:', sendError);
      alert('Erro ao enviar mensagem: ' + sendError.message);
      setSending(false);
      return;
    }

    await supabase
      .from('conversations')
      .update({ last_message_at: new Date().toISOString(), last_human_message_at: new Date().toISOString() })
      .eq('id', selectedConversation.id);

    setMessageInput('');
    await loadMessages(selectedConversation.id);
    setSending(false);
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
      .update({ status: 'closed' })
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

  return (
    <div className="p-2 flex flex-col h-[calc(100vh-2rem)]">
      <div className="flex items-center gap-3 mb-4">
        <MessageCircle className="w-8 h-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">Atendimento</h1>
          <p className="text-sm text-muted-foreground">{conversations.length} conversas</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex-1 flex overflow-hidden gap-5">
        {/* Lista de Conversas */}
        <div className="w-80 bg-card border border-border rounded-2xl shadow-sm flex flex-col overflow-hidden">
          <div className="p-4 border-b border-border bg-muted">
            <h2 className="font-semibold text-foreground">Conversas</h2>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center text-muted-foreground">
                <p>Carregando...</p>
              </div>
            ) : conversations.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground">
                <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>Nenhuma conversa ainda</p>
                <p className="text-xs mt-1">
                  Conversas aparecem aqui quando um cliente escreve pelo WhatsApp
                </p>
              </div>
            ) : (
              conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => setSelectedConversation(conv)}
                  className={`w-full p-4 border-b border-border text-left transition-colors ${
                    selectedConversation?.id === conv.id
                      ? 'bg-primary/5 font-semibold'
                      : 'hover:bg-muted'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-medium text-foreground line-clamp-1">
                      {contactLabel(conv.contact)}
                    </p>
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        conv.status === 'open'
                          ? 'bg-green-100 text-green-700'
                          : conv.status === 'archived'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {conv.status === 'open' ? 'Aberta' : conv.status === 'archived' ? 'Arquivada' : 'Fechada'}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-1">
                    {conv.contact?.phone || '—'}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
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
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Chat */}
        <div className="flex-1 bg-card border border-border rounded-2xl shadow-sm flex flex-col overflow-hidden">
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
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium border ${
                      selectedConversation.ai_enabled
                        ? 'bg-primary/10 text-primary border-primary/20'
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

              {/* Mensagens */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-card">
                {messages.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    <p>Sem mensagens ainda</p>
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
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                        <p className="text-xs opacity-70 mt-1">
                          {new Date(msg.created_at).toLocaleTimeString('pt-BR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <form onSubmit={handleSendMessage} className="p-6 border-t border-border bg-muted">
                <div className="flex gap-3">
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
                    className="flex items-center gap-2 px-6 py-2 bg-primary text-white rounded-lg font-medium hover:opacity-90 disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <p>Selecione uma conversa para começar</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
