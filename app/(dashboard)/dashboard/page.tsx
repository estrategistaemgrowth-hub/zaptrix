'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ensureWorkspace } from '@/lib/workspace';
import { MessageCircle, Users, MessageSquare, TrendingUp, Zap } from 'lucide-react';
import { Sparkline } from '@/components/sparkline';
import { BannerCard } from '@/components/banner-card';
import { QuotaBar } from '@/components/quota-bar';

interface DashboardMetrics {
  activeConversations: number;
  totalContacts: number;
  messagesToday: number;
  totalMessages: number;
  /** Sum of `daily_message_limit` across connected WhatsApp connections that have one configured. 0 = no limit set anywhere. */
  dailyLimit: number;
}

const cards = [
  {
    key: 'activeConversations' as const,
    label: 'Conversas Abertas',
    hint: 'em andamento',
    icon: MessageCircle,
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
    valueColor: 'text-blue-600',
    trend: [3, 4, 4, 6, 5, 7, 8],
    trendColor: '#2563eb',
  },
  {
    key: 'totalContacts' as const,
    label: 'Total de Contatos',
    hint: 'contatos únicos',
    icon: Users,
    iconBg: 'bg-emerald-100',
    iconColor: 'text-emerald-600',
    valueColor: 'text-emerald-600',
    trend: [10, 12, 13, 15, 18, 20, 24],
    trendColor: '#10b981',
  },
  {
    key: 'messagesToday' as const,
    label: 'Mensagens Hoje',
    hint: 'desde meia-noite',
    icon: MessageSquare,
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
    valueColor: 'text-amber-600',
    trend: [2, 5, 3, 6, 4, 7, 9],
    trendColor: '#d97706',
  },
  {
    key: 'totalMessages' as const,
    label: 'Total de Mensagens',
    hint: 'no histórico',
    icon: TrendingUp,
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
    valueColor: 'text-blue-600',
    trend: [20, 24, 26, 30, 34, 38, 45],
    trendColor: '#2563eb',
  },
];

const steps = [
  { n: 1, title: 'WhatsApp', desc: 'Conectar Evolution API' },
  { n: 2, title: 'Produtos', desc: 'Cadastrar seu catálogo' },
  { n: 3, title: 'Conhecimento', desc: 'Treinar a IA com docs' },
  { n: 4, title: 'Atender', desc: 'Receber mensagens ao vivo' },
];

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    activeConversations: 0,
    totalContacts: 0,
    messagesToday: 0,
    totalMessages: 0,
    dailyLimit: 0,
  });
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    let workspaceId: string | null = null;
    let interval: ReturnType<typeof setInterval>;

    async function start() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const workspace = await ensureWorkspace(supabase, session.user.id, session.user.email);
      if (!workspace) {
        setLoading(false);
        return;
      }

      workspaceId = workspace.workspaceId;
      await loadMetrics(workspaceId);
      interval = setInterval(() => workspaceId && loadMetrics(workspaceId), 5000);
    }

    start();
    return () => clearInterval(interval);
  }, []);

  async function loadMetrics(workspaceId: string) {
    try {
      const { count: activeCount } = await supabase
        .from('conversations')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .eq('status', 'open');

      const { count: contactCount } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { count: todayCount } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .gte('created_at', today.toISOString());

      const { count: totalCount } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId);

      const { data: connections } = await supabase
        .from('whatsapp_connections')
        .select('daily_message_limit')
        .eq('workspace_id', workspaceId);

      const dailyLimit = (connections || []).reduce(
        (sum, conn) => sum + (conn.daily_message_limit || 0),
        0
      );

      setMetrics({
        activeConversations: activeCount || 0,
        totalContacts: contactCount || 0,
        messagesToday: todayCount || 0,
        totalMessages: totalCount || 0,
        dailyLimit,
      });
    } catch (err) {
      console.error('Erro ao carregar métricas:', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-2">
      <div className="flex items-center gap-3 mb-6">
        <div className="gradient-brand w-11 h-11 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0">
          <Zap className="w-5 h-5 text-white" fill="currentColor" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-1">Dashboard</h1>
          <p className="text-muted-foreground">
            Bem-vindo ao Zaptrix — automação de vendas com IA via WhatsApp
          </p>
        </div>
      </div>

      <BannerCard
        className="mb-6 animate-fade-in"
        badge={new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
        icon={MessageCircle}
        title={
          metrics.activeConversations > 0
            ? `${metrics.activeConversations} ${metrics.activeConversations === 1 ? 'conversa aberta' : 'conversas abertas'} agora`
            : 'Nenhuma conversa aberta no momento'
        }
        subtitle="Acompanhe o atendimento ao vivo e assuma qualquer conversa da sua IA a qualquer momento."
        ctaLabel="Ver atendimento"
        ctaHref="/atendimento"
      />

      {metrics.dailyLimit > 0 && (
        <div className="bg-card border border-border rounded-2xl shadow-sm p-6 mb-6 animate-fade-in">
          <QuotaBar
            label="Cota diária de mensagens"
            current={metrics.messagesToday}
            max={metrics.dailyLimit}
            hint="Soma do limite diário configurado em todas as conexões WhatsApp"
          />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-6 animate-fade-in">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.key}
              className="card-hover-glow bg-card border border-border rounded-2xl shadow-sm p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-muted-foreground">{card.label}</h3>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${card.iconBg}`}>
                  <Icon className={`w-4 h-4 ${card.iconColor}`} />
                </div>
              </div>
              <div className="flex items-end justify-between gap-2">
                <div>
                  <p className={`text-3xl font-bold ${card.valueColor}`}>
                    {loading ? '—' : metrics[card.key]}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">{card.hint}</p>
                </div>
                <Sparkline points={card.trend} color={card.trendColor} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-card border border-border rounded-2xl shadow-sm p-8 animate-fade-in">
        <h2 className="text-lg font-semibold text-foreground mb-2">Comece sua jornada</h2>
        <p className="text-muted-foreground mb-6">
          Siga os passos abaixo para configurar seu agente de vendas
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {steps.map((step) => (
            <div
              key={step.n}
              className="p-4 bg-muted rounded-xl transition-all duration-200 hover:shadow-sm"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="gradient-brand w-8 h-8 text-white rounded-full flex items-center justify-center font-bold text-sm shadow-sm">
                  {step.n}
                </div>
                <h3 className="font-semibold text-foreground">{step.title}</h3>
              </div>
              <p className="text-sm text-muted-foreground">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
