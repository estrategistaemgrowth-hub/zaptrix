import { AiProvider } from '@/lib/ai-models';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// Nenhum provider tinha timeout próprio — uma chamada travada consumia
// sozinha o orçamento de execução inteiro da function (crítico no plano
// Hobby da Vercel, que mata a function em ~10s independente do
// `maxDuration` pedido; ver comentário em app/api/webhooks/whatsapp/route.ts).
// 8s deixa margem pra outras chamadas do mesmo turno (resposta principal +
// revisão + memória) ainda caberem dentro do teto real.
const LLM_TIMEOUT_MS = 8000;

async function fetchWithTimeout(url: string, init: RequestInit, providerLabel: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`${providerLabel}: tempo limite excedido (${LLM_TIMEOUT_MS}ms)`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

async function callOpenAI(
  apiKey: string,
  model: string,
  systemPrompt: string,
  history: ChatMessage[]
) {
  const res = await fetchWithTimeout(
    'https://api.openai.com/v1/chat/completions',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [{ role: 'system', content: systemPrompt }, ...history],
        temperature: 0.7,
      }),
    },
    'OpenAI'
  );
  if (!res.ok) throw new Error(`OpenAI: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  return data.choices[0].message.content.trim();
}

async function callGroq(
  apiKey: string,
  model: string,
  systemPrompt: string,
  history: ChatMessage[]
) {
  const res = await fetchWithTimeout(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [{ role: 'system', content: systemPrompt }, ...history],
        temperature: 0.7,
      }),
    },
    'Groq'
  );
  if (!res.ok) throw new Error(`Groq: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  return data.choices[0].message.content.trim();
}

async function callCerebras(
  apiKey: string,
  model: string,
  systemPrompt: string,
  history: ChatMessage[]
) {
  const res = await fetchWithTimeout(
    'https://api.cerebras.ai/v1/chat/completions',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [{ role: 'system', content: systemPrompt }, ...history],
        temperature: 0.7,
      }),
    },
    'Cerebras'
  );
  if (!res.ok) throw new Error(`Cerebras: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  return data.choices[0].message.content.trim();
}

async function callAnthropic(
  apiKey: string,
  model: string,
  systemPrompt: string,
  history: ChatMessage[]
) {
  const res = await fetchWithTimeout(
    'https://api.anthropic.com/v1/messages',
    {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        system: systemPrompt,
        messages: history,
      }),
    },
    'Anthropic'
  );
  if (!res.ok) throw new Error(`Anthropic: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  return data.content[0].text.trim();
}

async function callGemini(
  apiKey: string,
  model: string,
  systemPrompt: string,
  history: ChatMessage[]
) {
  const res = await fetchWithTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: history.map((m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        })),
      }),
    },
    'Gemini'
  );
  if (!res.ok) throw new Error(`Gemini: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  return data.candidates[0].content.parts[0].text.trim();
}

/** Chama o provider de LLM configurado, com histórico de conversa + prompt de sistema. */
export async function callLlm(
  provider: AiProvider,
  apiKey: string,
  model: string,
  systemPrompt: string,
  history: ChatMessage[]
): Promise<string> {
  switch (provider) {
    case 'openai':
      return callOpenAI(apiKey, model, systemPrompt, history);
    case 'groq':
      return callGroq(apiKey, model, systemPrompt, history);
    case 'anthropic':
      return callAnthropic(apiKey, model, systemPrompt, history);
    case 'gemini':
      return callGemini(apiKey, model, systemPrompt, history);
    case 'cerebras':
      return callCerebras(apiKey, model, systemPrompt, history);
    default:
      throw new Error(`Provider não suportado: ${provider}`);
  }
}
