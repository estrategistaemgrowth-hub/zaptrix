export type AiProvider = 'gemini' | 'groq' | 'openai' | 'anthropic';

export const PROVIDER_LABELS: Record<AiProvider, string> = {
  gemini: 'Google Gemini',
  groq: 'Groq',
  openai: 'OpenAI',
  anthropic: 'Anthropic (Claude)',
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
