import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();

    // Validar que é um evento de mensagem
    if (payload.event !== 'messages.upsert') {
      return NextResponse.json({ status: 'ignored' });
    }

    console.log('Webhook recebido:', {
      from: payload.data?.sender?.pushName,
      message: payload.data?.message?.conversation?.substring(0, 50),
      instance: payload.data?.instanceName,
    });

    // TODO: Integrar com Supabase quando a Evolution API estiver configurada
    // Por enquanto, apenas fazer log da mensagem recebida

    return NextResponse.json({ status: 'success' });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Validar webhook (GET com token)
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  const WEBHOOK_TOKEN = process.env.WEBHOOK_SECRET;

  if (token === WEBHOOK_TOKEN) {
    return NextResponse.json({ status: 'ok' });
  }

  return NextResponse.json(
    { error: 'Unauthorized' },
    { status: 401 }
  );
}
