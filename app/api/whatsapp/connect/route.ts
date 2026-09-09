import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createInstance, generateInstanceName, setWebhook, deleteInstance } from '@/lib/evolution-api';

function generateWebhookSecret() {
  return crypto.randomUUID().replace(/-/g, '');
}

export async function POST(request: NextRequest) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const { data: membership } = await supabase
    .from('workspace_members')
    .select('workspace_id, role')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();

  if (!membership || !['owner', 'admin'].includes(membership.role)) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  }

  const instanceName = generateInstanceName(membership.workspace_id);
  const webhookSecret = generateWebhookSecret();

  try {
    const result = await createInstance(instanceName);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    try {
      await setWebhook(instanceName, `${appUrl}/api/webhooks/whatsapp`, webhookSecret);
    } catch (webhookErr) {
      // Não bloqueia a conexão se o webhook falhar (pode ser configurado depois)
      console.error('Erro ao configurar webhook:', webhookErr);
    }

    const { data: connection, error: insertError } = await supabase
      .from('whatsapp_connections')
      .insert([
        {
          workspace_id: membership.workspace_id,
          instance_name: instanceName,
          status: 'connecting',
          webhook_secret: webhookSecret,
        },
      ])
      .select('id')
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 400 });
    }

    return NextResponse.json({
      connectionId: connection.id,
      instanceName,
      qrcode: result.qrcode?.base64 || null,
    });
  } catch (err) {
    console.error('Erro ao criar instância na Evolution API:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao conectar com a Evolution API' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const { connectionId } = await request.json();

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const { data: membership } = await supabase
    .from('workspace_members')
    .select('workspace_id, role')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();

  if (!membership || !['owner', 'admin'].includes(membership.role)) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  }

  const { data: connection } = await supabase
    .from('whatsapp_connections')
    .select('instance_name')
    .eq('id', connectionId)
    .eq('workspace_id', membership.workspace_id)
    .maybeSingle();

  if (connection) {
    try {
      await deleteInstance(connection.instance_name);
    } catch (err) {
      // Instância pode já não existir na Evolution API (ex: nunca conectou) — não bloqueia a remoção local
      console.error('Erro ao deletar instância na Evolution API (ignorado):', err);
    }
  }

  const { error: deleteError } = await supabase
    .from('whatsapp_connections')
    .delete()
    .eq('id', connectionId)
    .eq('workspace_id', membership.workspace_id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 400 });
  }

  return NextResponse.json({ status: 'ok' });
}
