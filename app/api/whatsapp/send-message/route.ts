import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { sendTextMessage } from '@/lib/evolution-api';

export async function POST(request: NextRequest) {
  const { conversationId, text } = await request.json();

  if (!conversationId || !text?.trim()) {
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

  // Manda primeiro pelo WhatsApp (quando há conexão) pra já capturar o
  // key.id retornado pela Evolution API e gravar como external_message_id —
  // sem isso, o rastreamento de entregue/lido (wa_status) nunca teria como
  // casar a atualização vinda do webhook MESSAGES_UPDATE com esta mensagem.
  let externalMessageId: string | null = null;
  let waStatus = 'sent';
  let warning: string | undefined;

  if (!connection || !phone) {
    waStatus = 'failed';
    warning = 'Mensagem salva no histórico, mas não há WhatsApp conectado para enviar.';
  } else {
    try {
      const sendResult = await sendTextMessage(connection.instance_name, phone, text);
      externalMessageId = sendResult?.key?.id || null;
    } catch (err) {
      console.error('Erro ao enviar mensagem pelo WhatsApp:', err);
      waStatus = 'failed';
      warning = 'Mensagem salva, mas o WhatsApp não confirmou o envio.';
    }
  }

  const { error: messageError } = await supabase.from('messages').insert([
    {
      workspace_id: membership.workspace_id,
      conversation_id: conversationId,
      sender_type: 'human',
      direction: 'outbound',
      content: text,
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
