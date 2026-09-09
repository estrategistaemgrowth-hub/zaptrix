import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

interface EvolutionWebhookPayload {
  event: string;
  instance?: string;
  data: {
    instanceName?: string;
    key?: { remoteJid: string; fromMe: boolean; id: string };
    pushName?: string;
    message?: { conversation?: string; extendedTextMessage?: { text?: string } };
    messageTimestamp?: number;
  };
}

function extractText(data: EvolutionWebhookPayload['data']): string | null {
  return data.message?.conversation || data.message?.extendedTextMessage?.text || null;
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

    if (!instanceName || !remoteJid || !text) {
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

    const { error: messageError } = await admin.from('messages').insert([
      {
        workspace_id: workspaceId,
        conversation_id: conversationId,
        external_message_id: payload.data.key?.id || null,
        direction: 'inbound',
        sender_type: 'customer',
        content: text,
      },
    ]);

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
