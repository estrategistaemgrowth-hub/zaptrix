import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendTextMessage, getMediaBase64 } from '@/lib/evolution-api';
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
    'Responda sempre em português do Brasil, de forma natural para WhatsApp (mensagens curtas, sem markdown). ' +
      'Nunca invente informações, preços ou prazos que não tenha recebido de contexto.'
  );
  return lines.join('\n');
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
  instanceName: string;
  phone: string;
  inputMessageId: string | null;
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
  instanceName,
  phone,
  inputMessageId,
}: AutoReplyParams) {
  const startedAt = Date.now();

  try {
    const { data: conversation } = await admin
      .from('conversations')
      .select('ai_enabled')
      .eq('id', conversationId)
      .maybeSingle();

    if (!conversation?.ai_enabled) return;

    const { data: profile } = await admin
      .from('ai_profiles')
      .select('*')
      .eq('workspace_id', workspaceId)
      .maybeSingle();

    if (!profile || !profile.enabled) return;

    if (profile.business_hours_enabled && !isWithinBusinessHours(profile.business_hours)) {
      if (profile.out_of_hours_message) {
        await sendTextMessage(instanceName, phone, profile.out_of_hours_message);
        await admin.from('messages').insert([
          {
            workspace_id: workspaceId,
            conversation_id: conversationId,
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

    const systemPrompt = buildSystemPrompt(profile);
    const apiKey = decryptSecret(credential.encrypted_api_key);

    const replyText = await callLlm(
      credential.provider as AiProvider,
      apiKey,
      credential.model_id || '',
      systemPrompt,
      history
    );

    await sendTextMessage(instanceName, phone, replyText);

    await admin.from('messages').insert([
      {
        workspace_id: workspaceId,
        conversation_id: conversationId,
        direction: 'outbound',
        sender_type: 'ai',
        content: replyText,
      },
    ]);

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

export async function POST(request: NextRequest) {
  try {
    const payload: EvolutionWebhookPayload = await request.json();

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

    // Reaproveita conversa aberta existente; se não houver, cria uma nova
    const { data: existingConversation } = await admin
      .from('conversations')
      .select('id, unread_count')
      .eq('workspace_id', workspaceId)
      .eq('contact_id', contactId)
      .eq('status', 'open')
      .maybeSingle();

    let conversationId: string;
    let nextUnreadCount = 1;

    if (existingConversation) {
      conversationId = existingConversation.id;
      nextUnreadCount = (existingConversation.unread_count || 0) + 1;
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
