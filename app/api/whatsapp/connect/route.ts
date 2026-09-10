import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createInstance, generateInstanceName, setWebhook, deleteInstance, logoutInstance } from '@/lib/evolution-api';

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

  // Uma conexão "desconectada" (logout, ou sessão que caiu na Evolution API)
  // não deveria ocupar vaga nenhuma nem impedir reconectar o mesmo número —
  // reaproveita a linha em vez de inserir outra e acumular registros órfãos.
  const { data: existingConnections } = await supabase
    .from('whatsapp_connections')
    .select('id, status')
    .eq('workspace_id', membership.workspace_id);

  const disconnectedRow = (existingConnections || []).find((c) => c.status === 'disconnected');
  const activeCount = (existingConnections || []).filter((c) => c.status !== 'disconnected').length;

  if (!disconnectedRow) {
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('extra_whatsapp_connections')
      .eq('id', membership.workspace_id)
      .maybeSingle();

    const limit = 1 + (workspace?.extra_whatsapp_connections || 0);
    if (activeCount >= limit) {
      return NextResponse.json(
        {
          error: 'Limite de números atingido — contrate uma instância adicional para conectar mais um número.',
          limitReached: true,
        },
        { status: 403 }
      );
    }
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

    const { data: connection, error: saveError } = disconnectedRow
      ? await supabase
          .from('whatsapp_connections')
          .update({ instance_name: instanceName, status: 'connecting', webhook_secret: webhookSecret })
          .eq('id', disconnectedRow.id)
          .select('id')
          .single()
      : await supabase
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

    if (saveError) {
      return NextResponse.json({ error: saveError.message }, { status: 400 });
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

/** Desconecta a sessão do WhatsApp (logout) sem apagar o histórico da conexão
 *  — diferente do DELETE, que remove o registro inteiro. Depois de
 *  desconectar, o lojista pode reconectar o mesmo número escaneando um novo
 *  QR code. */
export async function PATCH(request: NextRequest) {
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

  if (!connection) {
    return NextResponse.json({ error: 'Conexão não encontrada' }, { status: 404 });
  }

  try {
    await logoutInstance(connection.instance_name);
  } catch (err) {
    // Instância já pode não existir mais na Evolution API (ex: caiu por conflito
    // de sessão, servidor reiniciou) — mesmo tratamento tolerante do DELETE
    // logo abaixo. Nesse caso não há nada pra "desconectar" de verdade, mas o
    // registro local ainda deve refletir que não está mais conectado.
    const message = err instanceof Error ? err.message : String(err);
    const notFound = /404|does not exist|not found/i.test(message);
    console.error('Erro ao desconectar instância na Evolution API' + (notFound ? ' (ignorado, instância já não existe)' : '') + ':', err);
    if (!notFound) {
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  const { error: updateError } = await supabase
    .from('whatsapp_connections')
    .update({ status: 'disconnected', phone_number: null })
    .eq('id', connectionId)
    .eq('workspace_id', membership.workspace_id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  return NextResponse.json({ status: 'ok' });
}
