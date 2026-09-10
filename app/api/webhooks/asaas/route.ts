import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Webhook do Asaas — configurar no painel do Asaas apontando para
 * `{APP_URL}/api/webhooks/asaas?token=ASAAS_WEBHOOK_TOKEN`. Validação em duas
 * camadas: token na própria URL (mesmo padrão do webhook do WhatsApp em
 * app/api/webhooks/whatsapp/route.ts, garante funcionamento mesmo se o nome
 * do cabeçalho mudar) + o "asaas-access-token" que a própria Asaas envia
 * (ASAAS_WEBHOOK_AUTH_TOKEN), gerado automaticamente ao criar o webhook.
 */

interface AsaasWebhookPayload {
  event: string;
  payment?: {
    id: string;
    status: string;
    value: number;
  };
}

export async function POST(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  if (token !== process.env.ASAAS_WEBHOOK_TOKEN) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  // Segunda camada: se ASAAS_WEBHOOK_AUTH_TOKEN estiver configurada, exige
  // também o cabeçalho que a Asaas envia — mas nunca bloqueia só por causa
  // dela se a variável não estiver definida (o token da URL já basta).
  const expectedAuthToken = process.env.ASAAS_WEBHOOK_AUTH_TOKEN;
  if (expectedAuthToken) {
    const receivedAuthToken = request.headers.get('asaas-access-token');
    if (receivedAuthToken !== expectedAuthToken) {
      return NextResponse.json({ error: 'Invalid auth token' }, { status: 401 });
    }
  }

  try {
    const payload: AsaasWebhookPayload = await request.json();
    const payment = payload.payment;

    if (!payment?.id) {
      return NextResponse.json({ status: 'ignored_incomplete' });
    }

    const admin = createAdminClient();

    let newStatus: 'paid' | 'overdue' | null = null;
    if (payload.event === 'PAYMENT_RECEIVED' || payload.event === 'PAYMENT_CONFIRMED') {
      newStatus = 'paid';
    } else if (payload.event === 'PAYMENT_OVERDUE') {
      newStatus = 'overdue';
    } else {
      return NextResponse.json({ status: 'ignored_event' });
    }

    const { data: invoice } = await admin
      .from('invoices')
      .select('id, workspace_id, kind, status')
      .eq('asaas_payment_id', payment.id)
      .maybeSingle();

    if (!invoice) {
      console.error('Webhook Asaas: fatura não encontrada para payment', payment.id);
      return NextResponse.json({ status: 'invoice_not_found' });
    }

    // Idempotência: Asaas pode reenviar o mesmo evento (retry) — sem essa
    // checagem, uma fatura de instância extra que já processou o incremento
    // ganharia mais 1 instância a cada reentrega.
    const alreadyPaid = invoice.status === 'paid';

    await admin.from('invoices').update({ status: newStatus }).eq('id', invoice.id);

    if (newStatus === 'paid' && !alreadyPaid) {
      if (invoice.kind === 'extra_whatsapp_instance') {
        await admin.rpc('increment_extra_whatsapp_connections', { p_workspace_id: invoice.workspace_id });
      } else {
        // Pagamento confirmado reativa a assinatura e empurra o vencimento
        // pra frente (30 dias a partir de hoje) — é isso que o middleware
        // usa pra decidir se bloqueia o acesso, não o status da fatura
        // isoladamente.
        const nextExpiry = new Date();
        nextExpiry.setDate(nextExpiry.getDate() + 30);

        await admin
          .from('workspaces')
          .update({
            subscription_status: 'active',
            subscription_expires_at: nextExpiry.toISOString(),
          })
          .eq('id', invoice.workspace_id);
      }
    }

    return NextResponse.json({ status: 'success' });
  } catch (error) {
    console.error('Erro no webhook do Asaas:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
