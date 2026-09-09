import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { decryptSecret } from '@/lib/security/encrypt';

const SYSTEM_PROMPT =
  'Você é um copywriter de e-commerce. Escreva descrições de produto persuasivas, claras e ' +
  'objetivas em português do Brasil, destacando benefícios reais (nunca invente características). ' +
  'Responda APENAS com o texto da descrição final, sem markdown, sem aspas, sem comentários.';

function buildUserPrompt(name: string, category: string | null, currentDescription: string | null) {
  let prompt = `Produto: ${name}\n`;
  if (category) prompt += `Categoria: ${category}\n`;
  if (currentDescription) {
    prompt += `\nDescrição atual (melhore, mantendo as informações reais e corrigindo erros de digitação, sem inventar dados novos):\n${currentDescription}`;
  } else {
    prompt += `\nEscreva uma descrição de venda curta (3-5 frases) para este produto.`;
  }
  return prompt;
}

async function callOpenAI(apiKey: string, model: string, userPrompt: string) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return data.choices[0].message.content.trim();
}

async function callAnthropic(apiKey: string, model: string, userPrompt: string) {
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
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return data.content[0].text.trim();
}

async function callGroq(apiKey: string, model: string, userPrompt: string) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
    }),
  });
  if (!res.ok) throw new Error(`Groq: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return data.choices[0].message.content.trim();
}

async function callGemini(apiKey: string, model: string, userPrompt: string) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ parts: [{ text: userPrompt }] }],
      }),
    }
  );
  if (!res.ok) throw new Error(`Gemini: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return data.candidates[0].content.parts[0].text.trim();
}

export async function POST(request: NextRequest) {
  const { productName, category, currentDescription } = await request.json();

  if (!productName) {
    return NextResponse.json({ error: 'Nome do produto é obrigatório' }, { status: 400 });
  }

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const { data: membership } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership) {
    return NextResponse.json({ error: 'Workspace não encontrado' }, { status: 404 });
  }

  const { data: credential } = await supabase
    .from('llm_credentials')
    .select('provider, encrypted_api_key, model_id')
    .eq('workspace_id', membership.workspace_id)
    .eq('is_primary', true)
    .eq('enabled', true)
    .maybeSingle();

  if (!credential) {
    return NextResponse.json(
      { error: 'Nenhuma credencial de IA configurada. Adicione uma em Configurações.' },
      { status: 400 }
    );
  }

  const apiKey = decryptSecret(credential.encrypted_api_key);
  const model = credential.model_id || '';
  const userPrompt = buildUserPrompt(productName, category || null, currentDescription || null);

  try {
    let text: string;

    switch (credential.provider) {
      case 'openai':
        text = await callOpenAI(apiKey, model, userPrompt);
        break;
      case 'anthropic':
        text = await callAnthropic(apiKey, model, userPrompt);
        break;
      case 'groq':
        text = await callGroq(apiKey, model, userPrompt);
        break;
      case 'gemini':
        text = await callGemini(apiKey, model, userPrompt);
        break;
      default:
        return NextResponse.json({ error: 'Provider não suportado' }, { status: 400 });
    }

    return NextResponse.json({ description: text });
  } catch (err) {
    console.error('Erro ao gerar descrição:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao chamar a IA' },
      { status: 500 }
    );
  }
}
