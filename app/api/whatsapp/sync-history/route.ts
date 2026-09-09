import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  findMessages,
  getMediaBase64,
  reduceWaStatusFromUpdates,
  type EvolutionHistoryRecord,
} from '@/lib/evolution-api';

type MediaMessageType = 'image' | 'video' | 'document' | 'audio' | 'sticker';

interface MediaInfo {
  mediaType: MediaMessageType | null;
  mimeType: string | null;
  caption: string | null;
}

/** Mesma lógica de extractText/extractMedia de app/api/webhooks/whatsapp/route.ts,
 *  replicada aqui porque opera sobre o registro de /chat/findMessages (mesmo
 *  formato de `message`, mas sem o wrapper do payload do webhook). */
function extractText(message: EvolutionHistoryRecord['message']): string | null {
  return message?.conversation || message?.extendedTextMessage?.text || null;
}

function extractMedia(message: EvolutionHistoryRecord['message']): MediaInfo {
  const empty: MediaInfo = { mediaType: null, mimeType: null, caption: null };
  if (!message) return empty;

  if (message.imageMessage) {
    return {
      mediaType: 'image',
      mimeType: message.imageMessage.mimetype || 'image/jpeg',
      caption: message.imageMessage.caption || null,
    };
  }
  if (message.videoMessage) {
    return {
      mediaType: 'video',
      mimeType: message.videoMessage.mimetype || 'video/mp4',
      caption: message.videoMessage.caption || null,
    };
  }
  if (message.documentMessage) {
    return {
      mediaType: 'document',
      mimeType: message.documentMessage.mimetype || 'application/octet-stream',
      caption: message.documentMessage.caption || message.documentMessage.title || null,
    };
  }
  if (message.audioMessage) {
    return { mediaType: 'audio', mimeType: message.audioMessage.mimetype || 'audio/ogg', caption: null };
  }
  if (message.stickerMessage) {
    return { mediaType: 'sticker', mimeType: message.stickerMessage.mimetype || 'image/webp', caption: null };
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

export async function POST(request: NextRequest) {
  const { conversationId } = await request.json();

  if (!conversationId) {
    return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 });
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
    .limit(1)
    .maybeSingle();

  if (!membership) {
    return NextResponse.json({ error: 'Workspace não encontrado' }, { status: 404 });
  }

  const { data: conversation } = await supabase
    .from('conversations')
    .select('id, workspace_id, contact:contacts(phone)')
    .eq('id', conversationId)
    .eq('workspace_id', membership.workspace_id)
    .maybeSingle();

  if (!conversation) {
    return NextResponse.json({ error: 'Conversa não encontrada' }, { status: 404 });
  }

  const { data: connection } = await supabase
    .from('whatsapp_connections')
    .select('instance_name')
    .eq('workspace_id', membership.workspace_id)
    .eq('status', 'connected')
    .maybeSingle();

  const contact = Array.isArray(conversation.contact) ? conversation.contact[0] : conversation.contact;
  const phone = contact?.phone;

  if (!connection || !phone) {
    return NextResponse.json(
      { error: 'Nenhum WhatsApp conectado para sincronizar o histórico.' },
      { status: 400 }
    );
  }

  let records: EvolutionHistoryRecord[];
  try {
    records = await findMessages(connection.instance_name, phone);
  } catch (err) {
    console.error('Erro ao buscar histórico na Evolution API:', err);
    return NextResponse.json({ error: 'Não foi possível buscar o histórico no WhatsApp.' }, { status: 502 });
  }

  if (!records || records.length === 0) {
    return NextResponse.json({ imported: 0 });
  }

  // records vem em ordem DECRESCENTE (mais recente primeiro) — inverte para
  // manter ordem cronológica ao inserir.
  const chronological = [...records].reverse();

  const admin = createAdminClient();

  const externalIds = chronological.map((r) => r.key?.id).filter(Boolean) as string[];
  const { data: existing } = await admin
    .from('messages')
    .select('external_message_id')
    .eq('conversation_id', conversationId)
    .in('external_message_id', externalIds.length > 0 ? externalIds : ['']);

  const existingIds = new Set((existing || []).map((m) => m.external_message_id));

  const toInsert: Record<string, unknown>[] = [];

  for (const record of chronological) {
    const externalId = record.key?.id;
    if (!externalId || existingIds.has(externalId)) continue;

    const text = extractText(record.message);
    const media = extractMedia(record.message);
    const isFromMe = !!record.key?.fromMe;
    const remoteJid = record.key?.remoteJid;
    const createdAt = record.messageTimestamp
      ? new Date(record.messageTimestamp * 1000).toISOString()
      : new Date().toISOString();

    // Mídia de mensagem histórica: baixa e sobe pro storage do workspace,
    // igual ao fluxo do webhook — best-effort, se falhar a mensagem ainda
    // entra (sem media_url, com o texto/legenda que tiver).
    let mediaUrl: string | null = null;
    if (media.mediaType && remoteJid) {
      try {
        const downloaded = await getMediaBase64(connection.instance_name, externalId, remoteJid);
        if (downloaded) {
          const mimeType = downloaded.mimetype || media.mimeType || 'application/octet-stream';
          const ext = extensionFromMime(mimeType);
          const path = `${membership.workspace_id}/${conversationId}/history-${Date.now()}-${externalId}.${ext}`;
          const buffer = Buffer.from(downloaded.base64, 'base64');

          const { error: uploadError } = await admin.storage
            .from('message-media')
            .upload(path, buffer, { contentType: mimeType, upsert: false });

          if (!uploadError) {
            // Bucket privado — signed URL de validade longa (ver nota em
            // app/api/webhooks/whatsapp/route.ts).
            const { data: signedUrlData } = await admin.storage
              .from('message-media')
              .createSignedUrl(path, 60 * 60 * 24 * 365);
            mediaUrl = signedUrlData?.signedUrl || null;
          } else {
            console.error('Erro ao salvar mídia histórica no storage:', uploadError);
          }
        }
      } catch (mediaError) {
        console.error('Erro ao baixar mídia histórica do WhatsApp:', mediaError);
      }
    }

    toInsert.push({
      workspace_id: membership.workspace_id,
      conversation_id: conversationId,
      external_message_id: externalId,
      direction: isFromMe ? 'outbound' : 'inbound',
      sender_type: isFromMe ? 'human' : 'customer',
      message_type: media.mediaType || 'text',
      content: text || media.caption || null,
      media_url: mediaUrl,
      media_mime_type: media.mimeType,
      media_caption: media.caption,
      wa_status: isFromMe ? reduceWaStatusFromUpdates(record.MessageUpdate) : null,
      created_at: createdAt,
    });
  }

  if (toInsert.length === 0) {
    return NextResponse.json({ imported: 0 });
  }

  const { error: insertError } = await admin.from('messages').insert(toInsert);

  if (insertError) {
    console.error('Erro ao importar histórico de mensagens:', insertError);
    return NextResponse.json({ error: 'Erro ao salvar o histórico importado.' }, { status: 500 });
  }

  return NextResponse.json({ imported: toInsert.length });
}
