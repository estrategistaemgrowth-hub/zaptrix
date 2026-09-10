export type AiProvider = 'gemini' | 'groq' | 'openai' | 'anthropic';

export const PROVIDER_LABELS: Record<AiProvider, string> = {
  gemini: 'Google Gemini',
  groq: 'Groq',
  openai: 'OpenAI',
  anthropic: 'Anthropic (Claude)',
};

export interface ProviderInfo {
  /** Onde gerar/gerenciar a chave de API. */
  keysUrl: string;
  tag: 'free' | 'free-tier' | 'paid';
  tagLabel: string;
  note: string;
  steps: string[];
}

/**
 * Guia de "como conseguir a API key" por provedor — mostrado em Configurações
 * > IA. Tags e notas são um retrato geral (o modelo de preço de cada
 * provedor muda com o tempo); o link sempre aponta pra página oficial, onde
 * o valor exato e atualizado está.
 */
export const PROVIDER_INFO: Record<AiProvider, ProviderInfo> = {
  groq: {
    keysUrl: 'https://console.groq.com/keys',
    tag: 'free',
    tagLabel: 'Tem plano grátis',
    note: 'A Groq costuma liberar uso gratuito com limites generosos de requisições — boa opção pra começar sem custo nenhum.',
    steps: [
      'Crie uma conta gratuita em console.groq.com',
      'No menu lateral, entre em "API Keys"',
      'Clique em "Create API Key", dê um nome e copie a chave (começa com "gsk_")',
    ],
  },
  gemini: {
    keysUrl: 'https://aistudio.google.com/app/apikey',
    tag: 'free-tier',
    tagLabel: 'Cota grátis',
    note: 'O Google AI Studio libera uma cota diária gratuita pros modelos Gemini Flash — passar da cota vira cobrança.',
    steps: [
      'Entre em aistudio.google.com com uma conta Google',
      'Clique em "Get API key" / "Criar chave de API"',
      'Escolha (ou crie) um projeto do Google Cloud e copie a chave gerada',
    ],
  },
  openai: {
    keysUrl: 'https://platform.openai.com/api-keys',
    tag: 'paid',
    tagLabel: 'Pago',
    note: 'A OpenAI cobra por uso desde o início — é preciso cadastrar um cartão e adicionar créditos antes de usar.',
    steps: [
      'Crie uma conta em platform.openai.com',
      'Vá em "Billing" e adicione um método de pagamento + créditos',
      'Vá em "API keys", clique em "Create new secret key" e copie (começa com "sk-")',
    ],
  },
  anthropic: {
    keysUrl: 'https://console.anthropic.com/settings/keys',
    tag: 'paid',
    tagLabel: 'Pago',
    note: 'A Anthropic cobra por uso desde o início — é preciso adicionar créditos na conta antes de gerar tráfego real.',
    steps: [
      'Crie uma conta em console.anthropic.com',
      'Vá em "Billing" e adicione créditos',
      'Vá em "API Keys", clique em "Create Key" e copie (começa com "sk-ant-")',
    ],
  },
};

export const PROVIDER_MODELS: Record<AiProvider, { id: string; label: string }[]> = {
  gemini: [
    { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash (rápido e barato)' },
    { id: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
    { id: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
  ],
  groq: [
    { id: 'openai/gpt-oss-120b', label: 'GPT-OSS 120B (mais capaz)' },
    { id: 'openai/gpt-oss-20b', label: 'GPT-OSS 20B (rápido e barato)' },
    { id: 'groq/compound', label: 'Groq Compound' },
  ],
  openai: [
    { id: 'gpt-4o', label: 'GPT-4o' },
    { id: 'gpt-4o-mini', label: 'GPT-4o Mini (rápido e barato)' },
    { id: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
  ],
  anthropic: [
    { id: 'claude-sonnet-5', label: 'Claude Sonnet 5' },
    { id: 'claude-opus-5', label: 'Claude Opus 5 (mais capaz)' },
    { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 (rápido e barato)' },
  ],
};
