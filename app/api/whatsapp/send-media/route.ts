import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendMediaMessage, mimeToMediaCategory } from '@/lib/evolution-api';

// Limite comum do WhatsApp para mídia.
const MAX_FILE_SIZE_BYTES = 16 * 1024 * 1024;

function extensionFromMime(mimeType: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'video/mp4': 'mp4',
    'audio/ogg': 'ogg',
    'audio/mpeg': 'mp3',
    'audio/mp4': 'm4a',
    'application/pdf': 'pdf',
  };
  if (map[mimeType]) return map[mimeType];
  const subtype = mimeType.split('/')[1]?.split(';')[0];
  return subtype || 'bin';
}

export async function POST(request: NextRequest) {
  const { conversationId, base64, mimeType, fileName, caption } = await request.json();

  if (!conversationId || !base64 || !mimeType) {
    return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 });
  }

  // Estimativa de tamanho a partir do base64 (sem descontar padding, mas
  // suficiente pra rejeitar cedo, antes de gastar upload/round-trip).
  const approxBytes = Math.floor((base64.length * 3) / 4);
  if (approxBytes > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json({ error: 'Arquivo muito grande. O limite é 16MB.' }, { status: 413 });
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

  const trimmedCaption = typeof caption === 'string' ? caption.trim() : '';
  const messageType = mimeToMediaCategory(mimeType);
  const safeFileName =
    typeof fileName === 'string' && fileName.trim()
      ? fileName.trim()
      : `arquivo.${extensionFromMime(mimeType)}`;

  // Upload via admin client: bypassa RLS (o storage do bucket message-media
  // exige is_workspace_member, já validado acima via membership).
  const admin = createAdminClient();
  const path = `${membership.workspace_id}/${conversationId}/${Date.now()}-${safeFileName}`;
  const buffer = Buffer.from(base64, 'base64');

  const { error: uploadError } = await admin.storage
    .from('message-media')
    .upload(path, buffer, { contentType: mimeType, upsert: false });

  if (uploadError) {
    console.error('Erro ao subir mídia para o storage:', uploadError);
    return NextResponse.json({ error: 'Não foi possível salvar o arquivo.' }, { status: 500 });
  }

  const { data: publicUrlData } = admin.storage.from('message-media').getPublicUrl(path);
  const mediaUrl = publicUrlData.publicUrl;

  const { data: connection } = await supabase
    .from('whatsapp_connections')
    .select('instance_name')
    .eq('workspace_id', membership.workspace_id)
    .eq('status', 'connected')
    .maybeSingle();

  const contact = Array.isArray(conversation.contact) ? conversation.contact[0] : conversation.contact;
  const phone = contact?.phone;

  // Mesmo padrão do send-message: envia primeiro pra capturar o key.id da
  // Evolution API e gravar como external_message_id, senão o rastreamento de
  // entregue/lido nunca casa a mensagem com o evento MESSAGES_UPDATE.
  let externalMessageId: string | null = null;
  let waStatus = 'sent';
  let warning: string | undefined;

  if (!connection || !phone) {
    waStatus = 'failed';
    warning = 'Arquivo salvo no histórico, mas não há WhatsApp conectado para enviar.';
  } else {
    try {
      const sendResult = await sendMediaMessage(
        connection.instance_name,
        phone,
        messageType,
        mimeType,
        safeFileName,
        base64,
        trimmedCaption || undefined
      );
      externalMessageId = sendResult?.key?.id || null;
    } catch (err) {
      console.error('Erro ao enviar mídia pelo WhatsApp:', err);
      waStatus = 'failed';
      warning = 'Arquivo salvo, mas o WhatsApp não confirmou o envio.';
    }
  }

  const { error: messageError } = await supabase.from('messages').insert([
    {
      workspace_id: membership.workspace_id,
      conversation_id: conversationId,
      sender_type: 'human',
      direction: 'outbound',
      message_type: messageType,
      content: trimmedCaption || null,
      media_url: mediaUrl,
      media_mime_type: mimeType,
      media_caption: trimmedCaption || null,
      external_message_id: externalMessageId,
      wa_status: waStatus,
    },
  ]);

  if (messageError) {
    return NextResponse.json({ error: messageError.message }, { status: 400 });
  }

  await supabase
    .from('conversations')
    .update({
      last_message_at: new Date().toISOString(),
      last_human_message_at: new Date().toISOString(),
    })
    .eq('id', conversationId);

  return NextResponse.json(warning ? { sent: false, warning } : { sent: true });
}
