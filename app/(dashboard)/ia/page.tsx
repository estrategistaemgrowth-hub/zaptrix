'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ensureWorkspace } from '@/lib/workspace';
import { Save, Zap, ToggleLeft, ToggleRight, LifeBuoy, TrendingUp, MessageCircle, Gift, Check, Clock } from 'lucide-react';

interface BusinessHoursDay {
  enabled: boolean;
  start: string;
  end: string;
}

type BusinessHours = Record<
  'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday',
  BusinessHoursDay
>;

const WEEK_DAYS: { key: keyof BusinessHours; label: string }[] = [
  { key: 'monday', label: 'Segunda' },
  { key: 'tuesday', label: 'Terça' },
  { key: 'wednesday', label: 'Quarta' },
  { key: 'thursday', label: 'Quinta' },
  { key: 'friday', label: 'Sexta' },
  { key: 'saturday', label: 'Sábado' },
  { key: 'sunday', label: 'Domingo' },
];

const defaultBusinessHours: BusinessHours = {
  monday: { enabled: true, start: '09:00', end: '18:00' },
  tuesday: { enabled: true, start: '09:00', end: '18:00' },
  wednesday: { enabled: true, start: '09:00', end: '18:00' },
  thursday: { enabled: true, start: '09:00', end: '18:00' },
  friday: { enabled: true, start: '09:00', end: '18:00' },
  saturday: { enabled: false, start: '09:00', end: '13:00' },
  sunday: { enabled: false, start: '09:00', end: '13:00' },
};

const defaultOutOfHoursMessage =
  'Nosso atendimento automático está fora do horário de funcionamento. Retornaremos assim que possível!';

interface AIProfile {
  id: string;
  agent_name: string | null;
  company_name: string | null;
  objective: string | null;
  persona: string | null;
  tone: string | null;
  custom_tone: string | null;
  response_style: string | null;
  allowed_topics: string | null;
  forbidden_topics: string | null;
  business_rules: string | null;
  enabled: boolean;
  use_knowledge_base: boolean;
  business_hours_enabled: boolean;
  business_hours: BusinessHours | null;
  out_of_hours_message: string | null;
}

const emptyForm = {
  agent_name: '',
  company_name: '',
  objective: '',
  persona: '',
  tone: 'amigavel',
  custom_tone: '',
  response_style: 'conciso',
  allowed_topics: '',
  forbidden_topics: '',
  business_rules: '',
  enabled: true,
  use_knowledge_base: true,
  business_hours_enabled: false,
  business_hours: defaultBusinessHours,
  out_of_hours_message: defaultOutOfHoursMessage,
};

interface AgentTemplate {
  id: string;
  label: string;
  description: string;
  icon: typeof LifeBuoy;
  suggestedName: string;
  values: {
    objective: string;
    persona: string;
    tone: string;
    custom_tone?: string;
    response_style: string;
    allowed_topics: string;
    forbidden_topics: string;
    business_rules: string;
  };
}

const AGENT_TEMPLATES: AgentTemplate[] = [
  {
    id: 'suporte',
    label: 'Suporte',
    description: 'Resolve dúvidas técnicas, pedidos e trocas',
    icon: LifeBuoy,
    suggestedName: 'Clara',
    values: {
      objective:
        'Resolver dúvidas técnicas e problemas relacionados a pedidos, entregas, trocas e devoluções, garantindo que o cliente saia com o problema encaminhado ou resolvido.',
      persona:
        'Atendente de suporte experiente, paciente e objetiva. Explica processos com clareza, confirma os dados do pedido antes de responder e transmite segurança mesmo em reclamações mais tensas.',
      tone: 'profissional',
      response_style: 'detalhado',
      allowed_topics:
        'Status do pedido, rastreio, prazo de entrega, política de trocas e devoluções, defeitos de produto, problemas no pagamento, segunda via de nota fiscal, instruções de uso do produto.',
      forbidden_topics:
        'Descontos ou negociação de preço, promessas de reembolso sem análise, opiniões sobre concorrentes, assuntos pessoais ou fora do contexto de compra.',
      business_rules:
        'Sempre pedir número do pedido ou CPF antes de dar qualquer informação. Trocas e devoluções seguem o prazo legal de 7 dias (arrependimento) e 30 dias (defeito) — nunca prometer prazo diferente. Em caso de reclamação grave, produto com defeito recorrente, ameaça de processo/Procon ou cliente visivelmente insatisfeito após 2 interações, escalar imediatamente para um atendente humano avisando "vou te transferir para um especialista para resolver isso com prioridade". Nunca prometer reembolso sem confirmação humana.',
    },
  },
  {
    id: 'vendas',
    label: 'Vendas',
    description: 'Apresenta produtos e conduz até o fechamento',
    icon: TrendingUp,
    suggestedName: 'Bia',
    values: {
      objective:
        'Converter o interesse do cliente em venda: apresentar os produtos certos para a necessidade dele, tirar dúvidas sobre especificações e formas de pagamento, contornar objeções e conduzir até o fechamento do pedido.',
      persona:
        'Vendedora entusiasmada, consultiva e persistente sem ser inconveniente. Conhece bem o catálogo, faz perguntas para entender a necessidade antes de indicar produto e usa gatilhos de urgência e prova social com naturalidade, sem exagerar.',
      tone: 'amigavel',
      response_style: 'conversacional',
      allowed_topics:
        'Catálogo de produtos, preços, formas de pagamento e parcelamento, frete, cupons de desconto ativos, comparação entre produtos, disponibilidade em estoque, prazo de entrega, garantia.',
      forbidden_topics:
        'Reclamações de pedidos antigos (encaminhar para o suporte), críticas a concorrentes, assuntos pessoais fora do contexto de compra.',
      business_rules:
        'Desconto máximo automático de 10% em compras à vista via Pix, sem necessitar aprovação humana; qualquer desconto acima disso precisa de aprovação humana antes de ser oferecido. Usar urgência real quando ela existir de fato (ex: estoque baixo confirmado no catálogo, cupom com validade cadastrada) — nunca mencionar frete grátis, desconto, cupom ou prazo que não esteja explicitamente na Base de Conhecimento ou no catálogo de produtos; se não houver essa informação, não mencionar promoção nenhuma. Se o cliente pedir para falar com um humano ou demonstrar que já decidiu comprar, agilizar o fechamento em vez de insistir em mais argumentos. Sempre oferecer 1 produto complementar (upsell) depois que o cliente confirmar interesse no item principal.',
    },
  },
  {
    id: 'atendimento',
    label: 'Atendimento Geral',
    description: 'Tira dúvidas gerais e direciona o cliente',
    icon: MessageCircle,
    suggestedName: 'Sofia',
    values: {
      objective:
        'Dar as respostas rápidas mais comuns do dia a dia da loja (horário de funcionamento, formas de pagamento, prazo de entrega, formas de contato) e direcionar o cliente para o setor certo quando o assunto for venda, suporte técnico ou pós-venda.',
      persona:
        'Recepcionista simpática e prestativa, direta ao ponto. Cumprimenta bem, entende rápido o que o cliente precisa e já indica o caminho, sem enrolar.',
      tone: 'amigavel',
      response_style: 'conciso',
      allowed_topics:
        'Horário de funcionamento, endereço da loja física (se houver), formas de pagamento aceitas, prazo médio de entrega por região, canais de contato, redes sociais, política geral de trocas (visão geral, sem entrar em caso específico).',
      forbidden_topics:
        'Negociação de preço ou desconto, análise de caso específico de pedido com problema, questões técnicas de produto, assuntos pessoais.',
      business_rules:
        'Quando o cliente demonstrar intenção clara de comprar, direcionar a conversa para apresentar produtos (seguindo o mesmo cuidado consultivo do agente de vendas). Quando o cliente relatar um problema com pedido já feito (atraso, defeito, dúvida sobre troca de um pedido específico), avisar que vai encaminhar para o time de suporte e sinalizar para atendimento humano. Nunca inventar informação que não esteja confirmada na base de conhecimento da loja — se não souber, diz que vai verificar e chama um humano.',
    },
  },
  {
    id: 'pos-venda',
    label: 'Pós-venda',
    description: 'Acompanha a experiência e oferece novos produtos',
    icon: Gift,
    suggestedName: 'Laura',
    values: {
      objective:
        'Acompanhar o cliente depois da compra: perguntar como foi a experiência de compra e o recebimento do produto, coletar feedback e avaliação, e a partir do que a pessoa comprou, oferecer proativamente produtos novos ou complementares (upsell e cross-sell) que façam sentido para ela.',
      persona:
        'Consultora de relacionamento calorosa e genuinamente interessada na experiência do cliente, não só em vender de novo. Pergunta antes de oferecer, comemora quando a experiência foi boa e trata com cuidado quando não foi, sempre com escuta ativa antes de qualquer oferta.',
      tone: 'personalizado',
      custom_tone: 'Caloroso, consultivo e acolhedor, como uma consultora que genuinamente se importa com a experiência do cliente antes de pensar em vender de novo.',
      response_style: 'conversacional',
      allowed_topics:
        'Experiência de recebimento do produto (prazo, embalagem, estado do item), satisfação com o produto comprado, dúvidas de uso pós-compra, pedido de avaliação/depoimento, sugestão de produtos complementares ou novos lançamentos relacionados à compra anterior, programa de fidelidade ou cupom de recompra.',
      forbidden_topics:
        'Reclamação de defeito ou problema não resolvido (encaminhar para o suporte imediatamente, sem tentar resolver sozinha), negociação de reembolso, assuntos pessoais fora do contexto pós-compra.',
      business_rules:
        'Entrar em contato entre 3 e 7 dias após a entrega confirmada, nunca antes do produto chegar. Primeiro perguntar como foi a experiência (recebimento, prazo, condição do produto) e só depois de uma resposta positiva ou neutra oferecer o próximo produto — nunca emendar a oferta antes de ouvir o feedback. Se o cliente relatar qualquer insatisfação, defeito ou problema, parar a oferta imediatamente e encaminhar para o suporte humano. A oferta de cross-sell deve ser sempre coerente com o que a pessoa comprou (ex.: quem comprou tênis de corrida recebe oferta de meia técnica ou palmilha, não um produto aleatório). Pedir avaliação/depoimento apenas quando o feedback foi positivo.',
    },
  },
];

export default function IaPage() {
  const [profile, setProfile] = useState<AIProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [formData, setFormData] = useState(emptyForm);
  const [appliedTemplate, setAppliedTemplate] = useState<string | null>(null);
  const supabase = createClient();

  function applyTemplate(template: AgentTemplate) {
    setFormData((prev) => ({
      ...prev,
      agent_name: prev.agent_name || template.suggestedName,
      objective: template.values.objective,
      persona: template.values.persona,
      tone: template.values.tone,
      custom_tone: template.values.custom_tone || '',
      response_style: template.values.response_style,
      allowed_topics: template.values.allowed_topics,
      forbidden_topics: template.values.forbidden_topics,
      business_rules: template.values.business_rules,
    }));
    setAppliedTemplate(template.id);
    setSaved(false);
    window.setTimeout(() => setAppliedTemplate(null), 2500);
  }

  function updateBusinessHoursDay(day: keyof BusinessHours, patch: Partial<BusinessHoursDay>) {
    setFormData((prev) => ({
      ...prev,
      business_hours: {
        ...prev.business_hours,
        [day]: { ...prev.business_hours[day], ...patch },
      },
    }));
  }

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

      const { data, error: loadError } = await supabase
        .from('ai_profiles')
        .select('*')
        .eq('workspace_id', workspace.workspaceId)
        .maybeSingle();

      if (loadError) {
        setError('Erro ao carregar perfil de IA: ' + loadError.message);
      } else if (data) {
        setProfile(data);
        setFormData({
          agent_name: data.agent_name || '',
          company_name: data.company_name || '',
          objective: data.objective || '',
          persona: data.persona || '',
          tone: data.tone || 'amigavel',
          custom_tone: data.custom_tone || '',
          response_style: data.response_style || 'conciso',
          allowed_topics: data.allowed_topics || '',
          forbidden_topics: data.forbidden_topics || '',
          business_rules: data.business_rules || '',
          enabled: data.enabled,
          use_knowledge_base: data.use_knowledge_base ?? true,
          business_hours_enabled: data.business_hours_enabled ?? false,
          business_hours: data.business_hours || defaultBusinessHours,
          out_of_hours_message: data.out_of_hours_message || defaultOutOfHoursMessage,
        });
      }
    } catch (err) {
      console.error('Erro ao carregar perfil:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!workspaceId) return;

    setSaving(true);
    setError('');
    setSaved(false);

    const payload = { workspace_id: workspaceId, ...formData };

    const { error: saveError } = profile
      ? await supabase.from('ai_profiles').update(payload).eq('id', profile.id)
      : await supabase.from('ai_profiles').insert([payload]);

    if (saveError) {
      console.error('Erro ao salvar perfil de IA:', saveError);
      setError('Erro ao salvar: ' + saveError.message);
      setSaving(false);
      return;
    }

    setSaved(true);
    setSaving(false);
    await init();
  }

  if (loading) {
    return (
      <div className="p-2">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="h-9 w-72 bg-muted animate-pulse rounded-xl" />
          <div className="h-40 bg-muted animate-pulse rounded-2xl" />
          <div className="h-96 bg-muted animate-pulse rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-2">
      <div className="max-w-4xl mx-auto animate-fade-in">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="gradient-brand w-11 h-11 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0">
              <Zap className="w-5 h-5 text-white" fill="currentColor" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Configuração da IA</h1>
              <p className="text-muted-foreground">Personalize seu agente de atendimento</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setFormData({ ...formData, enabled: !formData.enabled })}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
              formData.enabled
                ? 'gradient-brand text-white shadow-sm'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            {formData.enabled ? (
              <ToggleRight className="w-5 h-5" />
            ) : (
              <ToggleLeft className="w-5 h-5" />
            )}
            {formData.enabled ? 'IA ativa' : 'IA desativada'}
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        {saved && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
            Perfil de IA salvo com sucesso!
          </div>
        )}

        <div className="bg-card border border-border rounded-2xl shadow-sm p-6 mb-8">
          <h3 className="text-lg font-semibold text-foreground mb-1">Comece com um template</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Escolha um perfil pronto e ajuste depois — os campos abaixo são preenchidos automaticamente.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-border rounded-2xl border border-border overflow-hidden">
            {AGENT_TEMPLATES.map((template) => {
              const Icon = template.icon;
              const isApplied = appliedTemplate === template.id;
              return (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => applyTemplate(template)}
                  className={`relative flex flex-col items-start gap-3 p-5 text-left transition-colors duration-200 ${
                    isApplied ? 'bg-primary/5' : 'bg-white hover:bg-muted'
                  }`}
                >
                  {isApplied && (
                    <span className="absolute top-4 right-4 flex items-center justify-center w-5 h-5 rounded-full bg-primary text-white">
                      <Check className="w-3 h-3" />
                    </span>
                  )}
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground text-sm">{template.label}</p>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      {template.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl shadow-sm p-6 mb-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-1">
                Usar Conhecimento e Produtos
              </h3>
              <p className="text-sm text-muted-foreground">
                Quando ativado, a IA consulta a Base de Conhecimento e o catálogo de Produtos
                (preço, estoque, descrição) para responder os clientes no WhatsApp com informação
                real, em vez de respostas genéricas.
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                setFormData({ ...formData, use_knowledge_base: !formData.use_knowledge_base })
              }
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 flex-shrink-0 ${
                formData.use_knowledge_base
                  ? 'gradient-brand text-white shadow-sm'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {formData.use_knowledge_base ? (
                <ToggleRight className="w-5 h-5" />
              ) : (
                <ToggleLeft className="w-5 h-5" />
              )}
              {formData.use_knowledge_base ? 'Ativado' : 'Desativado'}
            </button>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl shadow-sm p-6 mb-8">
          <div className="flex items-start justify-between gap-4 mb-1">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-1 flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                Horário de Atendimento
              </h3>
              <p className="text-sm text-muted-foreground">
                Quando ativado, a IA só responde dentro dos horários configurados abaixo. Fora
                deles, envia a mensagem de ausência automaticamente.
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                setFormData({ ...formData, business_hours_enabled: !formData.business_hours_enabled })
              }
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 flex-shrink-0 ${
                formData.business_hours_enabled
                  ? 'gradient-brand text-white shadow-sm'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {formData.business_hours_enabled ? (
                <ToggleRight className="w-5 h-5" />
              ) : (
                <ToggleLeft className="w-5 h-5" />
              )}
              {formData.business_hours_enabled ? 'Ativado' : 'Desativado'}
            </button>
          </div>

          {formData.business_hours_enabled && (
            <div className="mt-5 space-y-4">
              <div className="divide-y divide-border border border-border rounded-xl overflow-hidden">
                {WEEK_DAYS.map(({ key, label }) => {
                  const day = formData.business_hours[key];
                  return (
                    <div
                      key={key}
                      className="flex items-center gap-4 p-3 bg-muted"
                    >
                      <button
                        type="button"
                        onClick={() => updateBusinessHoursDay(key, { enabled: !day.enabled })}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 flex-shrink-0 w-28 justify-center ${
                          day.enabled
                            ? 'gradient-brand text-white shadow-sm'
                            : 'bg-white text-muted-foreground border border-border'
                        }`}
                      >
                        {day.enabled ? (
                          <ToggleRight className="w-4 h-4" />
                        ) : (
                          <ToggleLeft className="w-4 h-4" />
                        )}
                        {label}
                      </button>
                      <div className="flex items-center gap-2">
                        <input
                          type="time"
                          value={day.start}
                          disabled={!day.enabled}
                          onChange={(e) => updateBusinessHoursDay(key, { start: e.target.value })}
                          className="px-3 py-1.5 border border-border rounded-lg bg-white text-foreground text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                        <span className="text-muted-foreground text-sm">até</span>
                        <input
                          type="time"
                          value={day.end}
                          disabled={!day.enabled}
                          onChange={(e) => updateBusinessHoursDay(key, { end: e.target.value })}
                          className="px-3 py-1.5 border border-border rounded-lg bg-white text-foreground text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Mensagem fora do horário
                </label>
                <textarea
                  value={formData.out_of_hours_message}
                  onChange={(e) => setFormData({ ...formData, out_of_hours_message: e.target.value })}
                  className="w-full px-4 py-2 border border-border rounded-xl bg-white text-foreground"
                  placeholder="ex: Nosso atendimento automático está fora do horário de funcionamento. Retornaremos assim que possível!"
                  rows={2}
                />
              </div>
            </div>
          )}
        </div>

        <div className="bg-card border border-border rounded-2xl shadow-sm p-8">
          <form onSubmit={handleSave} className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Nome do agente
                </label>
                <input
                  type="text"
                  value={formData.agent_name}
                  onChange={(e) => setFormData({ ...formData, agent_name: e.target.value })}
                  className="w-full px-4 py-2 border border-border rounded-xl bg-white text-foreground"
                  placeholder="ex: Ana"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Nome da empresa
                </label>
                <input
                  type="text"
                  value={formData.company_name}
                  onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                  className="w-full px-4 py-2 border border-border rounded-xl bg-white text-foreground"
                  placeholder="ex: Loja da Ana"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Objetivo do agente
              </label>
              <textarea
                value={formData.objective}
                onChange={(e) => setFormData({ ...formData, objective: e.target.value })}
                className="w-full px-4 py-2 border border-border rounded-xl bg-white text-foreground"
                placeholder="ex: Tirar dúvidas sobre produtos e ajudar o cliente a fechar a compra"
                rows={2}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Persona</label>
              <textarea
                value={formData.persona}
                onChange={(e) => setFormData({ ...formData, persona: e.target.value })}
                className="w-full px-4 py-2 border border-border rounded-xl bg-white text-foreground"
                placeholder="ex: Vendedora experiente, atenciosa, que conhece bem o catálogo"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Tom de voz</label>
                <select
                  value={formData.tone}
                  onChange={(e) => setFormData({ ...formData, tone: e.target.value })}
                  className="w-full px-4 py-2 border border-border rounded-xl bg-white text-foreground"
                >
                  <option value="amigavel">Amigável</option>
                  <option value="formal">Formal</option>
                  <option value="descontraido">Descontraído</option>
                  <option value="profissional">Profissional</option>
                  <option value="personalizado">Personalizado</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Estilo de resposta
                </label>
                <select
                  value={formData.response_style}
                  onChange={(e) => setFormData({ ...formData, response_style: e.target.value })}
                  className="w-full px-4 py-2 border border-border rounded-xl bg-white text-foreground"
                >
                  <option value="conciso">Conciso (respostas curtas)</option>
                  <option value="detalhado">Detalhado</option>
                  <option value="conversacional">Conversacional</option>
                </select>
              </div>
            </div>

            {formData.tone === 'personalizado' && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Descreva o tom personalizado
                </label>
                <input
                  type="text"
                  value={formData.custom_tone}
                  onChange={(e) => setFormData({ ...formData, custom_tone: e.target.value })}
                  className="w-full px-4 py-2 border border-border rounded-xl bg-white text-foreground"
                  placeholder="ex: Bem-humorado, usa gírias regionais"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Tópicos permitidos
                </label>
                <textarea
                  value={formData.allowed_topics}
                  onChange={(e) => setFormData({ ...formData, allowed_topics: e.target.value })}
                  className="w-full px-4 py-2 border border-border rounded-xl bg-white text-foreground"
                  placeholder="ex: produtos, preços, entrega, trocas"
                  rows={2}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Tópicos proibidos
                </label>
                <textarea
                  value={formData.forbidden_topics}
                  onChange={(e) => setFormData({ ...formData, forbidden_topics: e.target.value })}
                  className="w-full px-4 py-2 border border-border rounded-xl bg-white text-foreground"
                  placeholder="ex: política, concorrentes, assuntos pessoais"
                  rows={2}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Regras de negócio
              </label>
              <textarea
                value={formData.business_rules}
                onChange={(e) => setFormData({ ...formData, business_rules: e.target.value })}
                className="w-full px-4 py-2 border border-border rounded-xl bg-white text-foreground"
                placeholder="ex: Nunca dar desconto acima de 10% sem aprovação humana. Prazo de entrega é sempre 5 dias úteis."
                rows={3}
              />
            </div>

            <div className="flex gap-3 pt-4 border-t border-border">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2 btn-gradient font-medium"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Salvando...' : 'Salvar Configurações'}
              </button>
            </div>
          </form>
        </div>

        <div className="bg-card border border-border rounded-2xl shadow-sm p-6 mt-8">
          <h3 className="text-lg font-semibold text-foreground mb-4">Próximas Etapas</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>→ Adicione documentação na seção Base de Conhecimento</li>
            <li>→ Configure o provedor de IA em Configurações</li>
            <li>→ Conecte sua conta do WhatsApp em Configurações</li>
            <li>→ Em cada conversa no Atendimento, você pode ligar/desligar a IA individualmente</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
