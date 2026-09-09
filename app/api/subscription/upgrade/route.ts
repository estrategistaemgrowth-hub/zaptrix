import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateInvoiceWithAsaasCharge } from '@/lib/generate-invoice';
import { checkRateLimit } from '@/lib/rate-limit';

/**
 * Autoatendimento de assinatura: o próprio lojista (owner/admin) escolhe um
 * plano e gera a cobrança PIX dele mesmo — sem precisar do super admin.
 * Cobre dois casos: teste grátis que quer virar pago, e assinatura vencida
 * que hoje ficava sem saída própria (só "fale com o suporte").
 */
export async function POST(request: NextRequest) {
  const { planId, cpfCnpj } = await request.json();

  if (!planId) {
    return NextResponse.json({ error: 'Selecione um plano' }, { status: 400 });
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
    .select('workspace_id, role')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();

  if (!membership) {
    return NextResponse.json({ error: 'Workspace não encontrado' }, { status: 404 });
  }

  // Só owner/admin decide assinatura — atendente não deve poder trocar
  // plano nem gerar cobrança pro workspace.
  if (membership.role !== 'owner' && membership.role !== 'admin') {
    return NextResponse.json({ error: 'Sem permissão para gerenciar a assinatura' }, { status: 403 });
  }

  const allowed = await checkRateLimit({
    bucket: 'subscription-upgrade',
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

  const { data: plan } = await admin
    .from('plans')
    .select('name, price_cents')
    .eq('id', planId)
    .maybeSingle();

  if (!plan) {
    return NextResponse.json({ error: 'Plano inválido' }, { status: 400 });
  }

  const { data: workspace } = await admin
    .from('workspaces')
    .select('is_complimentary')
    .eq('id', membership.workspace_id)
    .maybeSingle();

  if (workspace?.is_complimentary) {
    return NextResponse.json(
      { error: 'Este workspace tem acesso privilegiado — fale com o suporte para alterar o plano.' },
      { status: 400 }
    );
  }

  await admin.from('workspaces').update({ plan_id: planId }).eq('id', membership.workspace_id);

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 3);

  const { invoice, asaasWarning } = await generateInvoiceWithAsaasCharge({
    admin,
    workspaceId: membership.workspace_id,
    amountCents: plan.price_cents,
    dueDate: dueDate.toISOString().slice(0, 10),
    notes: `Assinatura Zaptrix — ${plan.name}`,
    cpfCnpj,
    createdBy: user.id,
  });

  return NextResponse.json({ invoice, asaasWarning });
}
