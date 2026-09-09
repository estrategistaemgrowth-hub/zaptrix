import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Webhook do Asaas — configurar no painel do Asaas apontando para
 * `{APP_URL}/api/webhooks/asaas?token=ASAAS_WEBHOOK_TOKEN`. A validação é por
 * token na própria URL (mesmo padrão já usado no webhook do WhatsApp em
 * app/api/webhooks/whatsapp/route.ts) em vez de depender de um cabeçalho
 * específico do Asaas, pra manter controle total sobre a validação.
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
      .select('id, workspace_id')
      .eq('asaas_payment_id', payment.id)
      .maybeSingle();

    if (!invoice) {
      console.error('Webhook Asaas: fatura não encontrada para payment', payment.id);
      return NextResponse.json({ status: 'invoice_not_found' });
    }

    await admin.from('invoices').update({ status: newStatus }).eq('id', invoice.id);

    // Pagamento confirmado reativa a assinatura e empurra o vencimento pra
    // frente (30 dias a partir de hoje) — é isso que o middleware usa pra
    // decidir se bloqueia o acesso, não o status da fatura isoladamente.
    if (newStatus === 'paid') {
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

    return NextResponse.json({ status: 'success' });
  } catch (error) {
    console.error('Erro no webhook do Asaas:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
