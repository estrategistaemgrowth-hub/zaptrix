'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { MessageCircle, Users, MessageSquare, TrendingUp } from 'lucide-react';

interface DashboardMetrics {
  activeConversations: number;
  totalContacts: number;
  messagesToday: number;
  totalMessages: number;
}

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    activeConversations: 0,
    totalContacts: 0,
    messagesToday: 0,
    totalMessages: 0,
  });
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    loadMetrics();
    const interval = setInterval(loadMetrics, 5000); // Atualizar a cada 5s
    return () => clearInterval(interval);
  }, []);

  async function loadMetrics() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const { data: workspace } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', session.user.id)
        .single();

      if (!workspace) return;

      const workspaceId = workspace.workspace_id;

      // Conversas ativas
      const { count: activeCount } = await supabase
        .from('conversations')
        .select('*', { count: 'exact' })
        .eq('workspace_id', workspaceId)
        .eq('status', 'active');

      // Total de contatos
      const { count: contactCount } = await supabase
        .from('contacts')
        .select('*', { count: 'exact' })
        .eq('workspace_id', workspaceId);

      // Mensagens de hoje
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { count: todayCount } = await supabase
        .from('messages')
        .select('*', { count: 'exact' })
        .eq('workspace_id', workspaceId)
        .gte('created_at', today.toISOString());

      // Total de mensagens
      const { count: totalCount } = await supabase
        .from('messages')
        .select('*', { count: 'exact' })
        .eq('workspace_id', workspaceId);

      setMetrics({
        activeConversations: activeCount || 0,
        totalContacts: contactCount || 0,
        messagesToday: todayCount || 0,
        totalMessages: totalCount || 0,
      });
    } catch (err) {
      console.error('Erro ao carregar métricas:', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Dashboard</h1>
          <p className="text-muted-foreground">
            Bem-vindo ao Zaptrix — automação de vendas com IA via WhatsApp
          </p>
        </div>

        {/* Cards de Métricas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white border border-border rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-muted-foreground">Conversas Ativas</h3>
              <MessageCircle className="w-5 h-5 text-primary" />
            </div>
            <p className="text-3xl font-bold text-foreground">
              {loading ? '—' : metrics.activeConversations}
            </p>
            <p className="text-xs text-muted-foreground mt-2">em andamento</p>
          </div>

          <div className="bg-white border border-border rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-muted-foreground">Total de Contatos</h3>
              <Users className="w-5 h-5 text-primary" />
            </div>
            <p className="text-3xl font-bold text-foreground">
              {loading ? '—' : metrics.totalContacts}
            </p>
            <p className="text-xs text-muted-foreground mt-2">contatos únicos</p>
          </div>

          <div className="bg-white border border-border rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-muted-foreground">Mensagens Hoje</h3>
              <MessageSquare className="w-5 h-5 text-primary" />
            </div>
            <p className="text-3xl font-bold text-foreground">
              {loading ? '—' : metrics.messagesToday}
            </p>
            <p className="text-xs text-muted-foreground mt-2">desde meia-noite</p>
          </div>

          <div className="bg-white border border-border rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-muted-foreground">Total de Mensagens</h3>
              <TrendingUp className="w-5 h-5 text-primary" />
            </div>
            <p className="text-3xl font-bold text-foreground">
              {loading ? '—' : metrics.totalMessages}
            </p>
            <p className="text-xs text-muted-foreground mt-2">no histórico</p>
          </div>
        </div>

        {/* Seção de Onboarding */}
        <div className="bg-white border border-border rounded-lg p-8">
          <h2 className="text-lg font-semibold text-foreground mb-2">Comece sua jornada</h2>
          <p className="text-muted-foreground mb-6">
            Siga os passos abaixo para configurar seu agente de vendas
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg border border-border">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center font-bold text-sm">
                  1
                </div>
                <h3 className="font-semibold text-foreground">WhatsApp</h3>
              </div>
              <p className="text-sm text-muted-foreground">Conectar Evolution API</p>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg border border-border">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center font-bold text-sm">
                  2
                </div>
                <h3 className="font-semibold text-foreground">Produtos</h3>
              </div>
              <p className="text-sm text-muted-foreground">Cadastrar seu catálogo</p>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg border border-border">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center font-bold text-sm">
                  3
                </div>
                <h3 className="font-semibold text-foreground">Conhecimento</h3>
              </div>
              <p className="text-sm text-muted-foreground">Treinar a IA com docs</p>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg border border-border">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center font-bold text-sm">
                  4
                </div>
                <h3 className="font-semibold text-foreground">Atender</h3>
              </div>
              <p className="text-sm text-muted-foreground">Receber mensagens ao vivo</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
