'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Send, MessageCircle, Clock, PhoneOff, Phone } from 'lucide-react';

interface Conversation {
  id: string;
  contact_name: string;
  contact_phone: string;
  status: 'active' | 'closed' | 'waiting';
  assigned_to?: string;
  last_message_at: string;
}

interface Message {
  id: string;
  conversation_id: string;
  sender_type: 'contact' | 'agent' | 'ai';
  sender_name: string;
  content: string;
  created_at: string;
}

export default function AtendimentoPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [messageInput, setMessageInput] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  useEffect(() => {
    loadConversations();
    const interval = setInterval(loadConversations, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedConversation) {
      loadMessages(selectedConversation.id);
      const interval = setInterval(() => loadMessages(selectedConversation.id), 2000);
      return () => clearInterval(interval);
    }
  }, [selectedConversation]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function loadConversations() {
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
        .from('conversations')
        .select('*')
        .eq('workspace_id', workspace.workspace_id)
        .order('last_message_at', { ascending: false });

      setConversations(data || []);
    } catch (err) {
      console.error('Erro ao carregar conversas:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadMessages(conversationId: string) {
    try {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      setMessages(data || []);
    } catch (err) {
      console.error('Erro ao carregar mensagens:', err);
    }
  }

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!messageInput.trim() || !selectedConversation) return;

    setSending(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      await supabase
        .from('messages')
        .insert([
          {
            conversation_id: selectedConversation.id,
            sender_type: 'agent',
            sender_name: 'Você',
            content: messageInput,
            direction: 'outbound',
          },
        ]);

      setMessageInput('');
      loadMessages(selectedConversation.id);
    } catch (err) {
      console.error('Erro ao enviar mensagem:', err);
    } finally {
      setSending(false);
    }
  }

  async function handleAssignConversation() {
    if (!selectedConversation) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      await supabase
        .from('conversations')
        .update({
          assigned_to: session.user.id,
          status: 'active',
        })
        .eq('id', selectedConversation.id);

      loadConversations();
    } catch (err) {
      console.error('Erro ao assumir conversa:', err);
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="bg-white border-b border-border p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <MessageCircle className="w-8 h-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold text-foreground">Atendimento</h1>
              <p className="text-sm text-muted-foreground">{conversations.length} conversas</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden max-w-7xl w-full mx-auto gap-6 p-6">
        {/* Lista de Conversas */}
        <div className="w-80 bg-white border border-border rounded-lg flex flex-col overflow-hidden">
          <div className="p-4 border-b border-border bg-gray-50">
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
              </div>
            ) : (
              conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => setSelectedConversation(conv)}
                  className={`w-full p-4 border-b border-border text-left transition-colors ${
                    selectedConversation?.id === conv.id
                      ? 'bg-primary/5 font-semibold'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-medium text-foreground line-clamp-1">
                      {conv.contact_name || 'Contato'}
                    </p>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      conv.status === 'active' ? 'bg-green-100 text-green-700' :
                      conv.status === 'waiting' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {conv.status === 'active' ? 'Ativo' : conv.status === 'waiting' ? 'Aguardando' : 'Fechado'}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-1">
                    {conv.contact_phone}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    <Clock className="w-3 h-3 inline mr-1" />
                    {new Date(conv.last_message_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Chat */}
        <div className="flex-1 bg-white border border-border rounded-lg flex flex-col overflow-hidden">
          {selectedConversation ? (
            <>
              {/* Header */}
              <div className="p-6 border-b border-border bg-gray-50 flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold text-foreground">
                    {selectedConversation.contact_name || 'Contato'}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {selectedConversation.contact_phone}
                  </p>
                </div>
                {selectedConversation.status === 'waiting' && (
                  <button
                    onClick={handleAssignConversation}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg font-medium hover:opacity-90"
                  >
                    <Phone className="w-4 h-4" />
                    Assumir conversa
                  </button>
                )}
                {selectedConversation.status === 'active' && (
                  <button
                    className="flex items-center gap-2 px-4 py-2 bg-destructive text-white rounded-lg font-medium hover:opacity-90"
                  >
                    <PhoneOff className="w-4 h-4" />
                    Devolver
                  </button>
                )}
              </div>

              {/* Mensagens */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-white">
                {messages.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    <p>Sem mensagens ainda</p>
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${
                        msg.sender_type === 'agent' ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      <div
                        className={`max-w-xs px-4 py-2 rounded-lg ${
                          msg.sender_type === 'agent'
                            ? 'bg-primary text-white'
                            : msg.sender_type === 'ai'
                            ? 'bg-blue-100 text-foreground border border-blue-200'
                            : 'bg-gray-100 text-foreground'
                        }`}
                      >
                        {msg.sender_type !== 'agent' && (
                          <p className="text-xs font-semibold mb-1 opacity-75">
                            {msg.sender_name}
                          </p>
                        )}
                        <p className="text-sm">{msg.content}</p>
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
              <form
                onSubmit={handleSendMessage}
                className="p-6 border-t border-border bg-gray-50"
              >
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    placeholder="Digite uma mensagem..."
                    className="flex-1 px-4 py-2 border border-border rounded-lg bg-white text-foreground"
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
