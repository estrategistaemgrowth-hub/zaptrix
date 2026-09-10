import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateInvoiceWithAsaasCharge } from '@/lib/generate-invoice';
import { checkRateLimit } from '@/lib/rate-limit';

const EXTRA_INSTANCE_PRICE_CENTS = 3990;

/**
 * Autoatendimento de compra de instância extra de WhatsApp (R$39,90/mês) —
 * antes só o super admin conseguia liberar isso, manualmente, no painel
 * master. Gera a cobrança PIX pelo Asaas; o incremento em
 * extra_whatsapp_connections só acontece quando o pagamento é confirmado
 * (app/api/webhooks/asaas/route.ts), nunca na criação da cobrança.
 */
export async function POST(request: NextRequest) {
  const { cpfCnpj } = await request.json();

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

  if (!membership) {
    return NextResponse.json({ error: 'Workspace não encontrado' }, { status: 404 });
  }

  if (membership.role !== 'owner' && membership.role !== 'admin') {
    return NextResponse.json({ error: 'Sem permissão para gerenciar a assinatura' }, { status: 403 });
  }

  const allowed = await checkRateLimit({
    bucket: 'buy-whatsapp-instance',
    identifier: membership.workspace_id,
    maxHits: 5,
    windowSeconds: 3600,
  });

  if (!allowed) {
    return NextResponse.json(
      { error: 'Muitas tentativas. Tente novamente em alguns minutos.' },
      { status: 429 }
    );
  }

  const admin = createAdminClient();

  const { data: workspace } = await admin
    .from('workspaces')
    .select('name, is_complimentary, cpf_cnpj')
    .eq('id', membership.workspace_id)
    .maybeSingle();

  if (!workspace) {
    return NextResponse.json({ error: 'Workspace não encontrado' }, { status: 404 });
  }

  if (workspace.is_complimentary) {
    return NextResponse.json(
      { error: 'Este workspace tem acesso privilegiado — fale com o suporte para adicionar instâncias.' },
      { status: 400 }
    );
  }

  if (!cpfCnpj && !workspace.cpf_cnpj) {
    return NextResponse.json({ error: 'Informe o CPF/CNPJ para gerar a cobrança PIX.' }, { status: 400 });
  }

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 3);

  const { invoice, asaasWarning } = await generateInvoiceWithAsaasCharge({
    admin,
    workspaceId: membership.workspace_id,
    amountCents: EXTRA_INSTANCE_PRICE_CENTS,
    dueDate: dueDate.toISOString().slice(0, 10),
    notes: `Instância adicional de WhatsApp — ${workspace.name}`,
    cpfCnpj,
    createdBy: user.id,
    kind: 'extra_whatsapp_instance',
  });

  return NextResponse.json({ invoice, asaasWarning });
}
