import { AiProvider } from '@/lib/ai-models';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

async function callOpenAI(
  apiKey: string,
  model: string,
  systemPrompt: string,
  history: ChatMessage[]
) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: systemPrompt }, ...history],
      temperature: 0.7,
    }),
  });
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
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: systemPrompt }, ...history],
      temperature: 0.7,
    }),
  });
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
  const res = await fetch('https://api.cerebras.ai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: systemPrompt }, ...history],
      temperature: 0.7,
    }),
  });
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
  const res = await fetch('https://api.anthropic.com/v1/messages', {
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
  });
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
  const res = await fetch(
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
    }
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
