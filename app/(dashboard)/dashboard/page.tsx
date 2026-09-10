'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { ensureWorkspace } from '@/lib/workspace';
import { MessageCircle, Users, MessageSquare, TrendingUp, Zap, Check, Package, Clock, AlertTriangle } from 'lucide-react';
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

interface WhatsappAlertState {
  /** Já teve pelo menos uma conexão configurada alguma vez (não é o caso "nunca configurou"). */
  hasConnection: boolean;
  isConnected: boolean;
}

interface OnboardingStatus {
  whatsapp: boolean;
  produtos: boolean;
  conhecimento: boolean;
  atender: boolean;
}

interface BusinessMetrics {
  funnel: { open: number; follow_up: number; won: number; lost: number };
  avgAiResponseMs: number | null;
  topProducts: { name: string; clicks: number }[];
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

const steps: { n: number; key: keyof OnboardingStatus; title: string; desc: string; href: string }[] = [
  { n: 1, key: 'whatsapp', title: 'WhatsApp', desc: 'Conectar seu número', href: '/configuracoes?section=whatsapp' },
  { n: 2, key: 'produtos', title: 'Produtos', desc: 'Cadastrar seu catálogo', href: '/produtos' },
  { n: 3, key: 'conhecimento', title: 'Conhecimento', desc: 'Treinar a IA com docs', href: '/conhecimento' },
  { n: 4, key: 'atender', title: 'Atender', desc: 'Receber mensagens ao vivo', href: '/atendimento' },
];

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    activeConversations: 0,
    totalContacts: 0,
    messagesToday: 0,
    totalMessages: 0,
    dailyLimit: 0,
  });
  const [onboarding, setOnboarding] = useState<OnboardingStatus>({
    whatsapp: false,
    produtos: false,
    conhecimento: false,
    atender: false,
  });
  const [businessMetrics, setBusinessMetrics] = useState<BusinessMetrics>({
    funnel: { open: 0, follow_up: 0, won: 0, lost: 0 },
    avgAiResponseMs: null,
    topProducts: [],
  });
  const [whatsappAlert, setWhatsappAlert] = useState<WhatsappAlertState>({
    hasConnection: false,
    isConnected: false,
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
        .select('daily_message_limit, status')
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

      const [
        { count: productsCount },
        { count: knowledgeCount },
        { count: customerMessagesCount },
      ] = await Promise.all([
        supabase
          .from('products')
          .select('*', { count: 'exact', head: true })
          .eq('workspace_id', workspaceId),
        supabase
          .from('knowledge_entries')
          .select('*', { count: 'exact', head: true })
          .eq('workspace_id', workspaceId),
        supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('workspace_id', workspaceId)
          .eq('sender_type', 'customer'),
      ]);

      setOnboarding({
        whatsapp: (connections || []).some((c) => c.status === 'connected'),
        produtos: (productsCount || 0) > 0,
        conhecimento: (knowledgeCount || 0) > 0,
        atender: (customerMessagesCount || 0) > 0,
      });

      setWhatsappAlert({
        hasConnection: (connections || []).length > 0,
        isConnected: (connections || []).some((c) => c.status === 'connected'),
      });

      const { data: conversationStatuses } = await supabase
        .from('conversations')
        .select('status')
        .eq('workspace_id', workspaceId);

      const funnel: BusinessMetrics['funnel'] = { open: 0, follow_up: 0, won: 0, lost: 0 };
      (conversationStatuses || []).forEach((c) => {
        const status = c.status as keyof BusinessMetrics['funnel'];
        if (status === 'open' || status === 'follow_up' || status === 'won' || status === 'lost') {
          funnel[status] += 1;
        }
      });

      const { data: aiRuns } = await supabase
        .from('ai_runs')
        .select('latency_ms')
        .eq('workspace_id', workspaceId)
        .eq('status', 'completed')
        .not('latency_ms', 'is', null)
        .order('created_at', { ascending: false })
        .limit(50);

      const avgAiResponseMs =
        aiRuns && aiRuns.length > 0
          ? aiRuns.reduce((sum, r) => sum + (r.latency_ms || 0), 0) / aiRuns.length
          : null;

      const { data: clicks } = await supabase
        .from('product_clicks')
        .select('product_id, products(name)')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
        .limit(200);

      const clickCounts = new Map<string, { name: string; clicks: number }>();
      (clicks || []).forEach((c: any) => {
        const name = Array.isArray(c.products) ? c.products[0]?.name : c.products?.name;
        if (!name) return;
        const existing = clickCounts.get(c.product_id);
        clickCounts.set(c.product_id, { name, clicks: (existing?.clicks || 0) + 1 });
      });

      const topProducts = Array.from(clickCounts.values())
        .sort((a, b) => b.clicks - a.clicks)
        .slice(0, 5);

      setBusinessMetrics({ funnel, avgAiResponseMs, topProducts });
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

      {!loading && whatsappAlert.hasConnection && !whatsappAlert.isConnected && (
        <a
          href="/configuracoes?section=whatsapp"
          className="flex items-center gap-3 mb-6 p-4 bg-destructive/10 border border-destructive/30 rounded-2xl text-destructive hover:bg-destructive/15 transition-colors animate-fade-in"
        >
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <div>
            <p className="font-semibold text-sm">Seu WhatsApp está desconectado</p>
            <p className="text-sm opacity-90">
              A IA não está recebendo nem enviando mensagens agora. Toque aqui para reconectar.
            </p>
          </div>
        </a>
      )}

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

      {!loading && Object.values(onboarding).every(Boolean) ? (
        <div className="bg-card border border-border rounded-2xl shadow-sm p-8 animate-fade-in">
          <h2 className="text-lg font-semibold text-foreground mb-2">Métricas do negócio</h2>
          <p className="text-muted-foreground mb-6">
            Sua jornada de configuração está completa — acompanhe o desempenho real do seu agente
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="p-5 bg-muted rounded-xl">
              <h3 className="text-sm font-semibold text-foreground mb-4">Funil de conversas</h3>
              <div className="space-y-2.5">
                {[
                  { label: 'Abertas', value: businessMetrics.funnel.open, dot: 'bg-emerald-500' },
                  { label: 'Follow-up', value: businessMetrics.funnel.follow_up, dot: 'bg-blue-500' },
                  { label: 'Fechadas (ganho)', value: businessMetrics.funnel.won, dot: 'bg-green-600' },
                  { label: 'Perdidas', value: businessMetrics.funnel.lost, dot: 'bg-destructive' },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <span className={`w-2 h-2 rounded-full ${row.dot}`} />
                      {row.label}
                    </span>
                    <span className="font-semibold text-foreground">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-5 bg-muted rounded-xl">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Tempo médio de resposta da IA</h3>
              </div>
              {businessMetrics.avgAiResponseMs !== null ? (
                <p className="text-3xl font-bold text-primary">
                  {(businessMetrics.avgAiResponseMs / 1000).toFixed(1)}s
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">Ainda sem respostas da IA registradas.</p>
              )}
              <p className="text-xs text-muted-foreground mt-2">Últimas 50 respostas concluídas</p>
            </div>

            <div className="p-5 bg-muted rounded-xl">
              <div className="flex items-center gap-2 mb-4">
                <Package className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Produtos mais procurados</h3>
              </div>
              {businessMetrics.topProducts.length > 0 ? (
                <div className="space-y-2">
                  {businessMetrics.topProducts.map((p) => (
                    <div key={p.name} className="flex items-center justify-between text-sm">
                      <span className="text-foreground line-clamp-1">{p.name}</span>
                      <span className="text-muted-foreground flex-shrink-0 ml-2">{p.clicks}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Ainda sem dados suficientes — aparece aqui quando a IA menciona ou envia fotos de produtos aos clientes.
                </p>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl shadow-sm p-8 animate-fade-in">
          <h2 className="text-lg font-semibold text-foreground mb-2">Comece sua jornada</h2>
          <p className="text-muted-foreground mb-6">
            Siga os passos abaixo para configurar seu agente de vendas
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {steps.map((step) => {
              const done = onboarding[step.key];
              return (
                <Link
                  key={step.n}
                  href={step.href}
                  className={`block p-4 rounded-xl transition-all duration-200 hover:shadow-sm cursor-pointer ${
                    done ? 'bg-primary/5 border border-primary/20' : 'bg-muted hover:bg-muted/70'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div
                      className={`w-8 h-8 text-white rounded-full flex items-center justify-center font-bold text-sm shadow-sm flex-shrink-0 ${
                        done ? 'bg-emerald-500' : 'gradient-brand'
                      }`}
                    >
                      {done ? <Check className="w-4 h-4" /> : step.n}
                    </div>
                    <h3 className="font-semibold text-foreground">{step.title}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">{done ? 'Concluído' : step.desc}</p>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
