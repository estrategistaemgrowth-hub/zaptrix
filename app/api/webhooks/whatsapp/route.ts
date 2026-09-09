import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendTextMessage, getMediaBase64, sendImageByUrl, markMessageAsRead, mapAckToWaStatus } from '@/lib/evolution-api';
import { decryptSecret } from '@/lib/security/encrypt';
import { callLlm, ChatMessage } from '@/lib/llm-client';
import { AiProvider } from '@/lib/ai-models';
import { transcribeAudio } from '@/lib/transcription';

interface BusinessHoursDay {
  enabled: boolean;
  start: string;
  end: string;
}

function isWithinBusinessHours(businessHours: Record<string, BusinessHoursDay> | null): boolean {
  if (!businessHours) return true;

  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);

  const weekdayName = parts.find((p) => p.type === 'weekday')?.value.toLowerCase() || '';
  const hour = parts.find((p) => p.type === 'hour')?.value || '00';
  const minute = parts.find((p) => p.type === 'minute')?.value || '00';
  const currentTime = `${hour}:${minute}`;

  const dayConfig = businessHours[weekdayName];
  if (!dayConfig || !dayConfig.enabled) return false;

  return currentTime >= dayConfig.start && currentTime <= dayConfig.end;
}

function buildSystemPrompt(profile: {
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
}): string {
  const lines: string[] = [];
  lines.push(
    `Você é ${profile.agent_name || 'um assistente de atendimento'} do WhatsApp${
      profile.company_name ? ` da empresa ${profile.company_name}` : ''
    }.`
  );
  if (profile.persona) lines.push(`Persona: ${profile.persona}`);
  if (profile.objective) lines.push(`Objetivo: ${profile.objective}`);
  const tone = profile.tone === 'personalizado' && profile.custom_tone ? profile.custom_tone : profile.tone;
  if (tone) lines.push(`Tom de voz: ${tone}`);
  if (profile.response_style) lines.push(`Estilo de resposta: ${profile.response_style}`);
  if (profile.allowed_topics) lines.push(`Tópicos permitidos: ${profile.allowed_topics}`);
  if (profile.forbidden_topics) lines.push(`Tópicos proibidos (nunca falar disso): ${profile.forbidden_topics}`);
  if (profile.business_rules) lines.push(`Regras de negócio: ${profile.business_rules}`);
  lines.push(
    'Responda sempre em português do Brasil, como uma pessoa real digitando no WhatsApp, nunca como um ' +
      'catálogo ou menu robótico. Escreva de forma humanizada e natural, com frases curtas e o tom de quem ' +
      'realmente está conversando. Nunca use markdown de blog/documento: não use **negrito com dois ' +
      'asteriscos**, não use listas com "-" ou "*" no início da linha, não use headers com "#". Se quiser dar ' +
      'destaque a algo, use no máximo 1 ou 2 vezes por mensagem a sintaxe nativa do WhatsApp: um único ' +
      'asterisco de cada lado, tipo *assim*. Nunca invente informações, preços ou prazos que não tenha recebido de contexto. ' +
      'Fale apenas sobre os produtos e categorias reais desta loja, listados na Base de Conhecimento e no ' +
      'catálogo de produtos abaixo — nunca mencione produto, categoria ou segmento que não esteja nessa lista. ' +
      'Se o cliente perguntar sobre frete, prazo de entrega ou valor de envio, nunca invente ou estime um ' +
      'valor — envie o link do produto (campo "Link" do catálogo) e peça para ele calcular o frete direto no ' +
      'site, que já tem cálculo de frete em tempo real pelo CEP. Nunca mencione frete grátis, desconto, cupom ' +
      'ou qualquer promoção que não esteja explicitamente escrita na Base de Conhecimento ou no catálogo — ' +
      'você não tem acesso ao site da loja em tempo real, então promoções e políticas só existem se estiverem ' +
      'escritas abaixo. Nunca despeje o catálogo inteiro de uma vez: se o cliente pedir algo genérico ("tem ' +
      'roupa feminina?"), cite no máximo 2 ou 3 opções relevantes e faça uma pergunta pra entender melhor o ' +
      'que ele quer, em vez de listar dezenas de produtos.'
  );
  return lines.join('\n');
}

const PHOTO_MARKER_RE = /\[FOTO:\s*(.+?)\]/gi;

/**
 * Rede de segurança mecânica: mesmo com a instrução no prompt, o modelo às
 * vezes ainda escreve markdown de blog. Converte pro que o WhatsApp realmente
 * renderiza (ou apenas remove, quando não há equivalente nativo).
 */
function stripMarkdownForWhatsapp(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '*$1*') // **negrito** -> *negrito* (sintaxe nativa do WhatsApp)
    .replace(/^#{1,6}\s+/gm, '') // headers markdown
    .replace(/^[-*]\s+/gm, '• ') // lista markdown -> bullet simples
    .replace(/`{1,3}/g, ''); // crases de código, sem equivalente no WhatsApp
}

/** Extrai os marcadores `[FOTO: nome do produto]` da resposta da IA e devolve
 *  o texto já limpo deles + a lista de nomes de produto pedidos. */
function extractPhotoRequests(replyText: string): { cleanedText: string; productNames: string[] } {
  const productNames: string[] = [];
  const cleanedText = stripMarkdownForWhatsapp(replyText)
    .replace(PHOTO_MARKER_RE, (_match, name) => {
      productNames.push(String(name).trim());
      return '';
    })
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return { cleanedText, productNames };
}

/**
 * Divide uma resposta longa em várias mensagens curtas, do jeito que uma
 * pessoa digitaria no WhatsApp (blocos de até ~350 caracteres), em vez de
 * mandar um único parágrafo gigante. Quebra primeiro por parágrafo (linha em
 * branco); se um parágrafo sozinho ainda for grande demais, quebra por frase.
 */
function splitIntoWhatsappMessages(text: string, maxLen = 300, maxChunks = 5): string[] {
  // Trata parágrafo (linha em branco) E linha simples como unidade candidata —
  // uma lista de produtos costuma vir uma linha por item, sem linha em branco
  // entre elas, e precisa quebrar igual a um parágrafo de verdade.
  const units = text
    .split(/\n+/)
    .map((u) => u.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = '';

  function flush() {
    if (current) {
      chunks.push(current);
      current = '';
    }
  }

  for (const unit of units) {
    if (unit.length > maxLen) {
      flush();
      // Unidade sozinha já estoura o limite — quebra por frase e, se ainda
      // assim uma "frase" for maior que o limite, força corte bruto (nunca
      // deixa uma mensagem sem limite nenhum de tamanho).
      const sentences = unit.split(/(?<=[.!?])\s+/);
      let piece = '';
      for (const sentence of sentences) {
        const candidate = piece ? `${piece} ${sentence}` : sentence;
        if (candidate.length > maxLen) {
          if (piece) chunks.push(piece);
          if (sentence.length > maxLen) {
            chunks.push(sentence.slice(0, maxLen));
            piece = '';
          } else {
            piece = sentence;
          }
        } else {
          piece = candidate;
        }
      }
      if (piece) chunks.push(piece);
      continue;
    }

    const candidate = current ? `${current}\n${unit}` : unit;
    if (candidate.length > maxLen) {
      flush();
      current = unit;
    } else {
      current = candidate;
    }
  }
  flush();

  if (chunks.length === 0) return [text];

  // Nunca manda mais que maxChunks mensagens — o excedente entra no último bloco.
  if (chunks.length > maxChunks) {
    const head = chunks.slice(0, maxChunks - 1);
    const tail = chunks.slice(maxChunks - 1).join('\n\n');
    return [...head, tail];
  }

  return chunks;
}

function formatPrice(value: number | null): string {
  if (value === null || value === undefined) return '';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * Busca a Base de Conhecimento e o catálogo de Produtos do workspace e monta
 * um bloco de contexto pra injetar no prompt da IA — só quando
 * ai_profiles.use_knowledge_base está ativo (toggle "Usar Conhecimento e
 * Produtos" da página de IA). Limita quantidade/tamanho pra não estourar o
 * contexto do modelo em catálogos grandes.
 */
async function buildKnowledgeContext(
  admin: ReturnType<typeof createAdminClient>,
  workspaceId: string
): Promise<{ contextText: string; productImages: Map<string, { productId: string; imageUrl: string; purchaseUrl: string | null }> }> {
  const [{ data: entries }, { data: products }] = await Promise.all([
    admin
      .from('knowledge_entries')
      .select('title, category, content')
      .eq('workspace_id', workspaceId)
      .eq('active', true)
      .order('updated_at', { ascending: false })
      .limit(20),
    admin
      .from('products')
      .select(
        'id, name, category, price, promotional_price, stock_quantity, description, image_url, purchase_url'
      )
      .eq('workspace_id', workspaceId)
      .eq('active', true)
      .order('updated_at', { ascending: false })
      .limit(60),
  ]);

  const blocks: string[] = [];
  const productImages = new Map<string, { productId: string; imageUrl: string; purchaseUrl: string | null }>();

  if (entries && entries.length > 0) {
    const lines = entries.map(
      (e) => `- ${e.title}${e.category ? ` (${e.category})` : ''}: ${(e.content || '').slice(0, 400)}`
    );
    blocks.push(`Base de Conhecimento da loja:\n${lines.join('\n')}`);
  }

  if (products && products.length > 0) {
    const lines = products.map((p) => {
      const price = formatPrice(p.price);
      const promo = p.promotional_price ? ` (promoção: ${formatPrice(p.promotional_price)})` : '';
      const stock =
        typeof p.stock_quantity === 'number'
          ? p.stock_quantity > 0
            ? `estoque: ${p.stock_quantity}`
            : 'sem estoque'
          : '';
      const desc = p.description ? ` — ${p.description.slice(0, 150)}` : '';
      const link = p.purchase_url ? ` — Link: ${p.purchase_url}` : '';

      if (p.image_url) {
        productImages.set(p.name.trim().toLowerCase(), {
          productId: p.id,
          imageUrl: p.image_url,
          purchaseUrl: p.purchase_url,
        });
      }

      return `- ${p.name}${p.category ? ` (${p.category})` : ''}: ${price}${promo}${
        stock ? `, ${stock}` : ''
      }${desc}${link}`;
    });
    blocks.push(`Catálogo de produtos da loja:\n${lines.join('\n')}`);
  }

  if (blocks.length === 0) return { contextText: '', productImages };

  const contextText =
    '\n\nUse as informações abaixo (Base de Conhecimento e catálogo de produtos) para responder o cliente ' +
    'com dados reais. Nunca invente preço, estoque ou informação que não esteja aqui. Quando o cliente pedir ' +
    'link do produto ou do site, use o "Link" do produto listado. Quando o cliente pedir foto ou imagem de um ' +
    'produto que tenha foto disponível (não precisa avisar quais têm foto — apenas tente), inclua ao final da ' +
    'sua resposta, em uma linha própria, exatamente: [FOTO: Nome Exato do Produto] — uma linha para cada foto ' +
    'pedida. Essas linhas são removidas antes de chegar ao cliente e disparam o envio real da imagem.\n\n' +
    blocks.join('\n\n');

  return { contextText, productImages };
}

interface EvolutionWebhookPayload {
  event: string;
  instance?: string;
  data: {
    instanceName?: string;
    key?: { remoteJid: string; fromMe: boolean; id: string };
    pushName?: string;
    message?: {
      conversation?: string;
      extendedTextMessage?: { text?: string };
      imageMessage?: { mimetype?: string; caption?: string };
      videoMessage?: { mimetype?: string; caption?: string };
      documentMessage?: { mimetype?: string; fileName?: string; caption?: string; title?: string };
      audioMessage?: { mimetype?: string; ptt?: boolean };
      stickerMessage?: { mimetype?: string };
    };
    messageTimestamp?: number;
  };
}

function extractText(data: EvolutionWebhookPayload['data']): string | null {
  return data.message?.conversation || data.message?.extendedTextMessage?.text || null;
}

type MediaMessageType = 'image' | 'video' | 'document' | 'audio' | 'sticker';

interface MediaInfo {
  mediaType: MediaMessageType | null;
  mimeType: string | null;
  caption: string | null;
  fileName: string | null;
}

/**
 * Detecta se a mensagem recebida é mídia, e de qual tipo — espelhando a
 * ordem de prioridade usada pelo Jurix (produto irmão que já roda contra a
 * mesma Evolution API compartilhada): imagem, vídeo, documento, áudio,
 * figurinha. Se nenhum desses existir na mensagem, é texto puro.
 */
function extractMedia(data: EvolutionWebhookPayload['data']): MediaInfo {
  const message = data.message;
  const empty: MediaInfo = { mediaType: null, mimeType: null, caption: null, fileName: null };
  if (!message) return empty;

  if (message.imageMessage) {
    return {
      mediaType: 'image',
      mimeType: message.imageMessage.mimetype || 'image/jpeg',
      caption: message.imageMessage.caption || null,
      fileName: null,
    };
  }
  if (message.videoMessage) {
    return {
      mediaType: 'video',
      mimeType: message.videoMessage.mimetype || 'video/mp4',
      caption: message.videoMessage.caption || null,
      fileName: null,
    };
  }
  if (message.documentMessage) {
    return {
      mediaType: 'document',
      mimeType: message.documentMessage.mimetype || 'application/octet-stream',
      caption: message.documentMessage.caption || message.documentMessage.title || null,
      fileName: message.documentMessage.fileName || message.documentMessage.title || null,
    };
  }
  if (message.audioMessage) {
    return {
      mediaType: 'audio',
      mimeType: message.audioMessage.mimetype || 'audio/ogg',
      caption: null,
      fileName: null,
    };
  }
  if (message.stickerMessage) {
    return {
      mediaType: 'sticker',
      mimeType: message.stickerMessage.mimetype || 'image/webp',
      caption: null,
      fileName: null,
    };
  }

  return empty;
}

function extensionFromMime(mimeType: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'video/mp4': 'mp4',
    'audio/ogg': 'ogg',
    'audio/mpeg': 'mp3',
    'application/pdf': 'pdf',
  };
  if (map[mimeType]) return map[mimeType];
  const subtype = mimeType.split('/')[1]?.split(';')[0];
  return subtype || 'bin';
}

interface AutoReplyParams {
  admin: ReturnType<typeof createAdminClient>;
  workspaceId: string;
  conversationId: string;
  contactId: string;
  instanceName: string;
  phone: string;
  inputMessageId: string | null;
}

/**
 * Best-effort: pede pro mesmo provider/modelo já configurado resumir o que
 * vale lembrar sobre este cliente (preferências, o que já comprou, dores,
 * objeções) e grava em contacts.ai_memory. É o equivalente nativo ao conceito
 * de memória de longo prazo do mem0 (github.com/mem0ai/mem0), sem depender de
 * um serviço externo — reaproveita o mesmo lib/llm-client.ts já usado pra
 * responder o cliente.
 */
async function updateContactMemory(
  admin: ReturnType<typeof createAdminClient>,
  contactId: string,
  existingMemory: string | null,
  provider: AiProvider,
  apiKey: string,
  model: string,
  latestExchange: string
) {
  try {
    const prompt =
      (existingMemory ? `Memória atual sobre este cliente:\n${existingMemory}\n\n` : '') +
      `Última troca de mensagens:\n${latestExchange}\n\n` +
      'Atualize a memória sobre este cliente em até 5 bullets curtos (preferências, o que já ' +
      'comprou ou perguntou, objeções, dados de contato mencionados). Mantenha o que ainda for ' +
      'relevante da memória atual e adicione o que for novo. Responda APENAS com os bullets, sem ' +
      'comentários. Se não houver nada relevante para lembrar, responda exatamente "sem novidades".';

    const updated = await callLlm(
      provider,
      apiKey,
      model,
      'Você mantém um resumo curto e útil sobre um cliente de e-commerce para o time de vendas/atendimento consultar depois.',
      [{ role: 'user', content: prompt }]
    );

    if (updated.trim().toLowerCase() === 'sem novidades') return;

    await admin
      .from('contacts')
      .update({ ai_memory: updated.trim(), ai_memory_updated_at: new Date().toISOString() })
      .eq('id', contactId);
  } catch (error) {
    console.error('Erro ao atualizar memória do contato:', error);
  }
}

/**
 * Best-effort: pede pro mesmo provider/modelo já configurado classificar o
 * estágio do negócio a partir da última troca de mensagens (sem histórico
 * completo — não vale o custo/latência extra para essa classificação curta).
 * GANHO/PERDIDO movem a conversa direto para a coluna correspondente do
 * Kanban; INCERTO liga a tag "Analisar conversa" sem mudar a coluna; qualquer
 * outra resposta (CONTINUAR ou fora do esperado) não faz nada — é o
 * comportamento atual, sem mudança.
 */
async function classifyDealStage(
  admin: ReturnType<typeof createAdminClient>,
  conversationId: string,
  provider: AiProvider,
  apiKey: string,
  model: string,
  latestExchange: string
) {
  try {
    const prompt =
      `Última troca de mensagens:\n${latestExchange}\n\n` +
      'Com base nesta conversa, o negócio deve ser considerado GANHO (cliente confirmou compra/fechou ' +
      'pedido), PERDIDO (cliente desistiu claramente, disse não ter interesse, ou pediu para não ser mais ' +
      'contatado), CONTINUAR (ainda em negociação/atendimento normal), ou você NÃO TEM CERTEZA. Responda com ' +
      'APENAS uma palavra: GANHO, PERDIDO, CONTINUAR ou INCERTO.';

    const raw = await callLlm(
      provider,
      apiKey,
      model,
      'Você classifica o estágio de um negócio de vendas a partir de uma troca de mensagens de WhatsApp. ' +
        'Responda com uma única palavra, sem pontuação e sem comentários.',
      [{ role: 'user', content: prompt }]
    );

    const verdict = raw.trim().toUpperCase();

    if (verdict.startsWith('GANHO')) {
      await admin.from('conversations').update({ status: 'won', needs_review: false }).eq('id', conversationId);
    } else if (verdict.startsWith('PERDIDO')) {
      await admin.from('conversations').update({ status: 'lost', needs_review: false }).eq('id', conversationId);
    } else if (verdict.startsWith('INCERTO')) {
      await admin.from('conversations').update({ needs_review: true }).eq('id', conversationId);
    }
    // CONTINUAR ou qualquer resposta fora do esperado: nenhuma mudança.
  } catch (error) {
    console.error('Erro ao classificar estágio do negócio:', error);
  }
}

/**
 * Best-effort: decide se esta troca deve ser transferida para um atendente
 * humano (Roleta de Atendimento, configurada em Configurações > Roleta de
 * Atendimento). Dispara em duas condições, qualquer uma basta:
 *   (a) o LLM responde SIM para o prompt de transferência — cliente pediu
 *       explicitamente um humano, demonstrou frustração/reclamação séria, ou
 *       bateu em algum dos gatilhos adicionais que a loja descreveu em
 *       `handoff_trigger_rules`;
 *   (b) a conversa já estava `needs_review = true` (classificação INCERTO de
 *       `classifyDealStage`) ANTES desta troca, e continua `true` depois dela
 *       — ou seja, ficou incerta 2 vezes seguidas. Não exige uma tabela de
 *       histórico nova: `classifyDealStage` só reseta `needs_review` para
 *       false em GANHO/PERDIDO, nunca em CONTINUAR, então dois INCERTO
 *       seguidos aparecem como o flag continuando `true` de uma chamada para
 *       a outra.
 * Quando dispara: desliga a IA na conversa e atribui o próximo atendente
 * (role 'atendente' ou 'admin') em round-robin, usando
 * `workspaces.last_assigned_member_id` como ponteiro da fila. Sem atendente
 * cadastrado, não atribui nada e não quebra o fluxo. Erro aqui é só logado —
 * a resposta da IA já foi enviada ao cliente antes desta função rodar.
 */
async function checkHumanHandoff(
  admin: ReturnType<typeof createAdminClient>,
  workspaceId: string,
  conversationId: string,
  profile: { handoff_enabled: boolean | null; handoff_trigger_rules: string | null },
  provider: AiProvider,
  apiKey: string,
  model: string,
  latestExchange: string,
  wasNeedsReviewBefore: boolean
) {
  if (!profile.handoff_enabled) return;

  try {
    const extraRules = profile.handoff_trigger_rules?.trim()
      ? profile.handoff_trigger_rules.trim()
      : 'nenhum gatilho adicional configurado pela loja';

    const prompt =
      `Última troca de mensagens:\n${latestExchange}\n\n` +
      'Considerando esta troca, o cliente está pedindo explicitamente para falar com um atendente humano, ' +
      'demonstrando frustração/reclamação séria, OU alguma destas situações específicas configuradas pela ' +
      `loja: ${extraRules}? Responda com APENAS uma palavra: SIM ou NAO.`;

    const raw = await callLlm(
      provider,
      apiKey,
      model,
      'Você decide se uma conversa de atendimento no WhatsApp precisa ser transferida para um atendente ' +
        'humano. Responda com uma única palavra, sem pontuação e sem comentários.',
      [{ role: 'user', content: prompt }]
    );

    const explicitHandoff = raw.trim().toUpperCase().startsWith('SIM');

    const { data: currentConversation } = await admin
      .from('conversations')
      .select('needs_review')
      .eq('id', conversationId)
      .maybeSingle();

    const consecutiveUncertain = wasNeedsReviewBefore && !!currentConversation?.needs_review;

    if (!explicitHandoff && !consecutiveUncertain) return;

    await admin.from('conversations').update({ ai_enabled: false }).eq('id', conversationId);

    const { data: attendants } = await admin
      .from('workspace_members')
      .select('user_id')
      .eq('workspace_id', workspaceId)
      .in('role', ['atendente', 'admin'])
      .order('created_at', { ascending: true });

    if (!attendants || attendants.length === 0) return;

    const { data: workspace } = await admin
      .from('workspaces')
      .select('last_assigned_member_id')
      .eq('id', workspaceId)
      .maybeSingle();

    const lastIndex = workspace?.last_assigned_member_id
      ? attendants.findIndex((m) => m.user_id === workspace.last_assigned_member_id)
      : -1;
    const nextAttendant = attendants[(lastIndex + 1) % attendants.length];

    await admin
      .from('conversations')
      .update({ assigned_to: nextAttendant.user_id })
      .eq('id', conversationId);
    await admin
      .from('workspaces')
      .update({ last_assigned_member_id: nextAttendant.user_id })
      .eq('id', workspaceId);
  } catch (error) {
    console.error('Erro no handoff automático para atendente humano:', error);
  }
}

/**
 * Gera e envia a resposta automática da IA para a mensagem recém-recebida.
 * Best-effort: qualquer falha aqui é logada mas não derruba o webhook, já que
 * a mensagem do cliente já foi salva com sucesso antes desta chamada.
 */
async function tryAutoReply({
  admin,
  workspaceId,
  conversationId,
  contactId,
  instanceName,
  phone,
  inputMessageId,
}: AutoReplyParams) {
  const startedAt = Date.now();

  try {
    const { data: conversation } = await admin
      .from('conversations')
      .select('ai_enabled, needs_review')
      .eq('id', conversationId)
      .maybeSingle();

    if (!conversation?.ai_enabled) return;

    const wasNeedsReviewBefore = !!conversation.needs_review;

    const { data: profile } = await admin
      .from('ai_profiles')
      .select('*')
      .eq('workspace_id', workspaceId)
      .maybeSingle();

    if (!profile || !profile.enabled) return;

    if (profile.business_hours_enabled && !isWithinBusinessHours(profile.business_hours)) {
      if (profile.out_of_hours_message) {
        const sendResult = await sendTextMessage(instanceName, phone, profile.out_of_hours_message);
        await admin.from('messages').insert([
          {
            workspace_id: workspaceId,
            conversation_id: conversationId,
            external_message_id: sendResult?.key?.id || null,
            direction: 'outbound',
            sender_type: 'system',
            content: profile.out_of_hours_message,
          },
        ]);
      }
      return;
    }

    const { data: credential } = await admin
      .from('llm_credentials')
      .select('provider, encrypted_api_key, model_id')
      .eq('workspace_id', workspaceId)
      .eq('is_primary', true)
      .eq('enabled', true)
      .maybeSingle();

    if (!credential) return;

    const { data: recentMessages } = await admin
      .from('messages')
      .select('sender_type, content, transcript')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(12);

    // content já recebe o transcript no momento da gravação (ver extractMedia +
    // transcribeAudio abaixo), mas mantemos o fallback aqui também — histórico
    // nunca some por causa de content nulo em mensagem de áudio.
    const history: ChatMessage[] = (recentMessages || [])
      .reverse()
      .filter((m) => m.content || m.transcript)
      .map((m) => ({
        role: m.sender_type === 'customer' ? 'user' : 'assistant',
        content: (m.content || m.transcript) as string,
      }));

    const { data: contact } = await admin
      .from('contacts')
      .select('ai_memory')
      .eq('id', contactId)
      .maybeSingle();

    const { contextText: knowledgeContext, productImages } = profile.use_knowledge_base
      ? await buildKnowledgeContext(admin, workspaceId)
      : { contextText: '', productImages: new Map<string, { productId: string; imageUrl: string; purchaseUrl: string | null }>() };
    const memoryContext = contact?.ai_memory
      ? `\n\nMemória sobre este cliente (o que já sabemos dele de conversas anteriores):\n${contact.ai_memory}`
      : '';
    const systemPrompt = buildSystemPrompt(profile) + knowledgeContext + memoryContext;
    const apiKey = decryptSecret(credential.encrypted_api_key);

    const rawReply = await callLlm(
      credential.provider as AiProvider,
      apiKey,
      credential.model_id || '',
      systemPrompt,
      history
    );

    const { cleanedText, productNames } = extractPhotoRequests(rawReply);

    // Fotos pedidas pela IA (marcador [FOTO: nome]) vão antes do texto —
    // sensação natural de "aqui estão as fotos, e..." em vez do contrário.
    for (const name of productNames) {
      const match = productImages.get(name.trim().toLowerCase());
      if (!match) continue;
      try {
        const sendResult = await sendImageByUrl(instanceName, phone, match.imageUrl, name);
        await admin.from('messages').insert([
          {
            workspace_id: workspaceId,
            conversation_id: conversationId,
            external_message_id: sendResult?.key?.id || null,
            direction: 'outbound',
            sender_type: 'ai',
            message_type: 'image',
            media_url: match.imageUrl,
            media_caption: name,
          },
        ]);

        // Registra o interesse no produto (base do card "Produtos mais procurados" do Dashboard).
        await admin.from('product_clicks').insert([
          {
            workspace_id: workspaceId,
            product_id: match.productId,
            conversation_id: conversationId,
            contact_id: contactId,
          },
        ]);
      } catch (err) {
        console.error('Erro ao enviar foto de produto solicitada pela IA:', err);
      }
    }

    const replyText = cleanedText || rawReply;
    const messageChunks = splitIntoWhatsappMessages(replyText);

    for (let i = 0; i < messageChunks.length; i++) {
      if (i > 0) await new Promise((resolve) => setTimeout(resolve, 1200));
      const sendResult = await sendTextMessage(instanceName, phone, messageChunks[i]);
      await admin.from('messages').insert([
        {
          workspace_id: workspaceId,
          conversation_id: conversationId,
          external_message_id: sendResult?.key?.id || null,
          direction: 'outbound',
          sender_type: 'ai',
          content: messageChunks[i],
        },
      ]);
    }

    // Best-effort: classifica o estágio do negócio com base só na última troca
    // (cliente + resposta que acabou de ser enviada) — sem histórico completo,
    // pra não pesar latência/custo. Roda antes do updateContactMemory (que usa
    // o mesmo par de mensagens) mas depois de a resposta já ter sido entregue
    // ao cliente — qualquer erro aqui nunca derruba o fluxo principal.
    const lastCustomerMessageForStage = [...history].reverse().find((m) => m.role === 'user')?.content || '';
    await classifyDealStage(
      admin,
      conversationId,
      credential.provider as AiProvider,
      apiKey,
      credential.model_id || '',
      `Cliente: ${lastCustomerMessageForStage}\nIA: ${replyText}`
    );

    await checkHumanHandoff(
      admin,
      workspaceId,
      conversationId,
      profile,
      credential.provider as AiProvider,
      apiKey,
      credential.model_id || '',
      `Cliente: ${lastCustomerMessageForStage}\nIA: ${replyText}`,
      wasNeedsReviewBefore
    );

    await admin
      .from('conversations')
      .update({
        last_message_at: new Date().toISOString(),
        last_ai_message_at: new Date().toISOString(),
      })
      .eq('id', conversationId);

    await admin.from('ai_runs').insert([
      {
        workspace_id: workspaceId,
        conversation_id: conversationId,
        input_message_id: inputMessageId,
        provider: credential.provider,
        model: credential.model_id,
        status: 'completed',
        latency_ms: Date.now() - startedAt,
      },
    ]);

    const lastCustomerMessage = [...history].reverse().find((m) => m.role === 'user')?.content || '';
    await updateContactMemory(
      admin,
      contactId,
      contact?.ai_memory || null,
      credential.provider as AiProvider,
      apiKey,
      credential.model_id || '',
      `Cliente: ${lastCustomerMessage}\nIA: ${replyText}`
    );
  } catch (error) {
    console.error('Erro na resposta automática da IA:', error);
    await admin
      .from('ai_runs')
      .insert([
        {
          workspace_id: workspaceId,
          conversation_id: conversationId,
          input_message_id: inputMessageId,
          status: 'failed',
          latency_ms: Date.now() - startedAt,
          error_message: error instanceof Error ? error.message.slice(0, 500) : 'Erro desconhecido',
        },
      ])
      .then(() => {});
  }
}

/**
 * Handler do evento MESSAGES_UPDATE (confirmação de entrega/leitura). Formato
 * do status CONFIRMADO ao vivo contra a instância já conectada (ver
 * `mapAckToWaStatus` em lib/evolution-api.ts): string, não número — o mapeamento
 * numérico do ack do Baileys (0-5) usado antes era suposição sem validação e
 * foi substituído. Best-effort puro: qualquer erro aqui é só logado, nunca
 * propagado.
 */
async function handleMessagesUpdate(payload: EvolutionWebhookPayload, request: NextRequest) {
  try {
    const instanceName = payload.instance || (payload.data as any)?.instanceName;
    if (!instanceName) return NextResponse.json({ status: 'ignored_no_instance' });

    const token = request.nextUrl.searchParams.get('token');
    const admin = createAdminClient();

    const { data: connection } = await admin
      .from('whatsapp_connections')
      .select('workspace_id, webhook_secret')
      .eq('instance_name', instanceName)
      .maybeSingle();

    if (!connection || token !== connection.webhook_secret) {
      return NextResponse.json({ status: 'ignored_unauthorized' });
    }

    // A Evolution API pode mandar `data` como um único objeto de update, um
    // array de updates, ou um objeto com `updates: [...]` dentro — normaliza
    // pra sempre iterar uma lista.
    const rawData: any = payload.data;
    const updates: any[] = Array.isArray(rawData)
      ? rawData
      : Array.isArray(rawData?.updates)
      ? rawData.updates
      : rawData
      ? [rawData]
      : [];

    for (const update of updates) {
      const externalId: string | undefined = update?.key?.id || update?.keyId || update?.id;
      const ackRaw = update?.update?.status ?? update?.status ?? update?.ack;
      const waStatus = mapAckToWaStatus(ackRaw);

      if (!externalId) continue;

      const { error: updateError } = await admin
        .from('messages')
        .update({ wa_status: waStatus })
        .eq('workspace_id', connection.workspace_id)
        .eq('external_message_id', externalId);

      if (updateError) {
        console.error('Erro ao atualizar wa_status da mensagem:', updateError);
      }
    }

    return NextResponse.json({ status: 'success' });
  } catch (error) {
    console.error('Erro ao processar messages.update:', error);
    return NextResponse.json({ status: 'error_ignored' });
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload: EvolutionWebhookPayload = await request.json();

    if (payload.event === 'messages.update') {
      return handleMessagesUpdate(payload, request);
    }

    if (payload.event !== 'messages.upsert') {
      return NextResponse.json({ status: 'ignored' });
    }

    // Mensagens enviadas pelo próprio número (fromMe) são ecos do que o agente/humano
    // já enviou — não processar como mensagem recebida do cliente.
    if (payload.data.key?.fromMe) {
      return NextResponse.json({ status: 'ignored_own_message' });
    }

    const instanceName = payload.instance || payload.data.instanceName;
    const remoteJid = payload.data.key?.remoteJid;

    // Mensagens de GRUPO (JID termina em @g.us) não são clientes falando com a
    // loja — são conversas de grupo que o número conectado participa (ex: um
    // grupo de família/trabalho). Sem esse filtro, cada mensagem de grupo virava
    // um "contato"/"conversa" falso no Atendimento, incluindo spam encaminhado.
    if (remoteJid?.endsWith('@g.us')) {
      return NextResponse.json({ status: 'ignored_group_message' });
    }
    const text = extractText(payload.data);
    const media = extractMedia(payload.data);

    if (!instanceName || !remoteJid || (!text && !media.mediaType)) {
      return NextResponse.json({ status: 'ignored_incomplete' });
    }

    const token = request.nextUrl.searchParams.get('token');
    const admin = createAdminClient();

    const { data: connection, error: connectionError } = await admin
      .from('whatsapp_connections')
      .select('workspace_id, webhook_secret')
      .eq('instance_name', instanceName)
      .maybeSingle();

    if (connectionError || !connection) {
      console.error('Webhook: conexão não encontrada para instância', instanceName);
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
    }

    if (token !== connection.webhook_secret) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const workspaceId = connection.workspace_id;
    const phone = remoteJid.replace(/@s\.whatsapp\.net$/, '').replace(/@g\.us$/, '');
    const pushName = payload.data.pushName || null;

    // Marca a mensagem como lida no WhatsApp do cliente (check azul) — best-effort,
    // não impede o processamento se a Evolution API rejeitar ou não suportar.
    if (payload.data.key?.id) {
      markMessageAsRead(instanceName, remoteJid, payload.data.key.id).catch((err) =>
        console.error('Erro ao marcar mensagem como lida:', err)
      );
    }

    // Upsert de contato (cria se novo, atualiza push_name/last_contact_at se já existe)
    const { data: existingContact } = await admin
      .from('contacts')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('phone', phone)
      .maybeSingle();

    let contactId: string;

    if (existingContact) {
      contactId = existingContact.id;
      await admin
        .from('contacts')
        .update({ push_name: pushName, last_contact_at: new Date().toISOString() })
        .eq('id', contactId);
    } else {
      const { data: newContact, error: createContactError } = await admin
        .from('contacts')
        .insert([{ workspace_id: workspaceId, phone, push_name: pushName }])
        .select('id')
        .single();

      if (createContactError || !newContact) {
        console.error('Erro ao criar contato:', createContactError);
        return NextResponse.json({ error: 'Failed to create contact' }, { status: 500 });
      }
      contactId = newContact.id;
    }

    // Reaproveita a conversa mais recente do contato, seja qual for o status —
    // sem isso, uma conversa fechada/perdida/ganha virava um card duplicado
    // sempre que o mesmo cliente escrevia de novo. Se estava fechada, reabre
    // e marca reopened_count (vira a tag "Reaberta" na UI).
    const { data: existingConversation } = await admin
      .from('conversations')
      .select('id, status, unread_count, reopened_count')
      .eq('workspace_id', workspaceId)
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let conversationId: string;
    let nextUnreadCount = 1;

    if (existingConversation) {
      conversationId = existingConversation.id;
      nextUnreadCount = (existingConversation.unread_count || 0) + 1;

      if (existingConversation.status !== 'open' && existingConversation.status !== 'follow_up') {
        await admin
          .from('conversations')
          .update({
            status: 'open',
            reopened_count: (existingConversation.reopened_count || 0) + 1,
          })
          .eq('id', conversationId);
      }
    } else {
      const { data: newConversation, error: createConvError } = await admin
        .from('conversations')
        .insert([{ workspace_id: workspaceId, contact_id: contactId, status: 'open' }])
        .select('id')
        .single();

      if (createConvError || !newConversation) {
        console.error('Erro ao criar conversa:', createConvError);
        return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 });
      }
      conversationId = newConversation.id;
    }

    // Mídia (imagem/áudio/vídeo/documento/figurinha): baixa da Evolution API,
    // sobe pro storage do workspace e, se for áudio, transcreve pra virar
    // contexto de texto pra IA. Tudo best-effort — se qualquer etapa falhar,
    // a mensagem ainda é salva (sem media_url/transcript), o texto continua
    // funcionando normalmente e o fluxo de auto-reply não trava.
    let mediaUrl: string | null = null;
    let transcript: string | null = null;

    if (media.mediaType) {
      const whatsappMsgId = payload.data.key?.id;
      if (whatsappMsgId) {
        try {
          const downloaded = await getMediaBase64(instanceName, whatsappMsgId, remoteJid);
          if (downloaded) {
            const mimeType = downloaded.mimetype || media.mimeType || 'application/octet-stream';
            const ext = extensionFromMime(mimeType);
            const path = `${workspaceId}/${conversationId}/${Date.now()}-${whatsappMsgId}.${ext}`;
            const buffer = Buffer.from(downloaded.base64, 'base64');

            const { error: uploadError } = await admin.storage
              .from('message-media')
              .upload(path, buffer, { contentType: mimeType, upsert: false });

            if (!uploadError) {
              const { data: publicUrlData } = admin.storage.from('message-media').getPublicUrl(path);
              mediaUrl = publicUrlData.publicUrl;

              if (media.mediaType === 'audio') {
                transcript = await transcribeAudio(downloaded.base64, mimeType, workspaceId, admin);
              }
            } else {
              console.error('Erro ao salvar mídia recebida no storage:', uploadError);
            }
          }
        } catch (mediaError) {
          console.error('Erro ao baixar mídia do WhatsApp:', mediaError);
        }
      }
    }

    // Texto explícito > transcrição de áudio > legenda de imagem/vídeo/documento.
    const messageContent = text || transcript || media.caption || null;

    const { data: insertedMessage, error: messageError } = await admin
      .from('messages')
      .insert([
        {
          workspace_id: workspaceId,
          conversation_id: conversationId,
          external_message_id: payload.data.key?.id || null,
          direction: 'inbound',
          sender_type: 'customer',
          message_type: media.mediaType || 'text',
          content: messageContent,
          media_url: mediaUrl,
          media_mime_type: media.mimeType,
          media_caption: media.caption,
          transcript,
        },
      ])
      .select('id')
      .single();

    if (messageError) {
      console.error('Erro ao inserir mensagem:', messageError);
      return NextResponse.json({ error: 'Failed to insert message' }, { status: 500 });
    }

    await admin
      .from('conversations')
      .update({
        last_message_at: new Date().toISOString(),
        unread_count: nextUnreadCount,
      })
      .eq('id', conversationId);

    await tryAutoReply({
      admin,
      workspaceId,
      conversationId,
      contactId,
      instanceName,
      phone,
      inputMessageId: insertedMessage?.id || null,
    });

    return NextResponse.json({ status: 'success' });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  const WEBHOOK_TOKEN = process.env.WEBHOOK_SECRET;

  if (token === WEBHOOK_TOKEN) {
    return NextResponse.json({ status: 'ok' });
  }

  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
