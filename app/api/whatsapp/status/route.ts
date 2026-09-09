import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { getConnectionState, fetchInstancePhoneNumber } from '@/lib/evolution-api';

const STATE_MAP: Record<string, string> = {
  open: 'connected',
  connecting: 'connecting',
  close: 'disconnected',
};

export async function GET(request: NextRequest) {
  const connectionId = request.nextUrl.searchParams.get('connectionId');
  if (!connectionId) {
    return NextResponse.json({ error: 'connectionId é obrigatório' }, { status: 400 });
  }

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const { data: connection } = await supabase
    .from('whatsapp_connections')
    .select('id, workspace_id, instance_name, status, phone_number')
    .eq('id', connectionId)
    .maybeSingle();

  if (!connection) {
    return NextResponse.json({ error: 'Conexão não encontrada' }, { status: 404 });
  }

  try {
    const result = await getConnectionState(connection.instance_name);
    const newStatus = STATE_MAP[result.instance.state] || 'disconnected';

    if (newStatus !== connection.status || (newStatus === 'connected' && !connection.phone_number)) {
      const phoneNumber =
        newStatus === 'connected'
          ? await fetchInstancePhoneNumber(connection.instance_name).catch(() => null)
          : connection.phone_number;

      await supabase
        .from('whatsapp_connections')
        .update({
          status: newStatus,
          last_connection_at: new Date().toISOString(),
          ...(phoneNumber ? { phone_number: phoneNumber } : {}),
        })
        .eq('id', connectionId);
    }

    return NextResponse.json({ status: newStatus });
  } catch (err) {
    console.error('Erro ao consultar status da instância:', err);
    return NextResponse.json({ status: connection.status });
  }
}
