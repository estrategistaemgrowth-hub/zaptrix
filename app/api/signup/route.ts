import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isAsaasConfigured, createAsaasCustomer, createAsaasPayment, getAsaasPixQrCode } from '@/lib/asaas';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

/**
 * Cadastro público de lojista — usado pelo link de assinatura ("/assinar")
 * e pelo link de teste grátis ("/assinar?trial=1"). Sem autenticação prévia
 * (é o próprio visitante criando a conta), então usa sempre o service role
 * (createAdminClient), nunca signUp client-side.
 *
 * Rota totalmente anônima que cria usuário + workspace + (se pago) cobrança
 * real no Asaas — por isso tem rate limit por IP (5/hora), pra um script não
 * conseguir gerar cadastros/cobranças em massa.
 */
export async function POST(request: NextRequest) {
  const allowed = await checkRateLimit({
    bucket: 'signup',
    identifier: getClientIp(request),
    maxHits: 5,
    windowSeconds: 3600,
  });

  if (!allowed) {
    return NextResponse.json(
      { error: 'Muitas tentativas de cadastro. Tente novamente em alguns minutos.' },
      { status: 429 }
    );
  }

  const { storeName, email, password, cpfCnpj, planId, isTrial } = await request.json();

  if (!storeName || !email || !password) {
    return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 });
  }

  if (!isTrial && !planId) {
    return NextResponse.json({ error: 'Selecione um plano' }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: newUser, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createError || !newUser.user) {
    return NextResponse.json(
      { error: createError?.message || 'Erro ao criar usuário' },
      { status: 400 }
    );
  }

  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + (isTrial ? 7 : 30));

  // Cadastro pago começa "overdue" (bloqueado) até o webhook do Asaas
  // confirmar o primeiro pagamento — só o teste grátis libera na hora.
  const subscriptionStatus = isTrial ? 'trial' : 'overdue';

  const { data: workspace, error: workspaceError } = await admin
    .from('workspaces')
    .insert([
      {
        name: storeName,
        owner_user_id: newUser.user.id,
        created_by: newUser.user.id,
        status: 'active',
        plan_id: planId || null,
        subscription_status: subscriptionStatus,
        subscription_expires_at: expiresAt.toISOString(),
        cpf_cnpj: cpfCnpj || null,
      },
    ])
    .select()
    .single();

  if (workspaceError || !workspace) {
    await admin.auth.admin.deleteUser(newUser.user.id);
    return NextResponse.json({ error: workspaceError?.message || 'Erro ao criar workspace' }, { status: 400 });
  }

  const { error: memberError } = await admin
    .from('workspace_members')
    .insert([{ workspace_id: workspace.id, user_id: newUser.user.id, role: 'owner' }]);

  if (memberError) {
    await admin.from('workspaces').delete().eq('id', workspace.id);
    await admin.auth.admin.deleteUser(newUser.user.id);
    return NextResponse.json({ error: memberError.message }, { status: 400 });
  }

  // Teste grátis não gera cobrança — libera direto, sem depender do Asaas.
  if (isTrial) {
    return NextResponse.json({ workspaceId: workspace.id, requiresPayment: false });
  }

  if (!isAsaasConfigured() || !cpfCnpj) {
    // Sem Asaas configurado (ou sem CPF/CNPJ pra criar cliente no Asaas):
    // conta fica criada mas bloqueada até o super admin liberar manualmente
    // pelo Painel Master — nunca quebra o cadastro por causa disso.
    return NextResponse.json({
      workspaceId: workspace.id,
      requiresPayment: true,
      paymentUrl: null,
      warning: 'Cadastro criado. Aguarde o contato do suporte para liberar o acesso.',
    });
  }

  try {
    const { data: plan } = await admin.from('plans').select('name, price_cents').eq('id', planId).maybeSingle();

    const customer = await createAsaasCustomer(storeName, cpfCnpj, email);
    await admin.from('workspaces').update({ asaas_customer_id: customer.id }).eq('id', workspace.id);

    const dueDate = new Date(now);
    dueDate.setDate(dueDate.getDate() + 3); // 3 dias pra pagar a primeira fatura

    const { data: invoice } = await admin
      .from('invoices')
      .insert([
        {
          workspace_id: workspace.id,
          amount_cents: plan?.price_cents || 0,
          due_date: dueDate.toISOString().slice(0, 10),
          status: 'pending',
          notes: `Assinatura Zaptrix — ${plan?.name || 'plano'}`,
          created_by: newUser.user.id,
        },
      ])
      .select()
      .single();

    const payment = await createAsaasPayment({
      customerId: customer.id,
      value: (plan?.price_cents || 0) / 100,
      dueDate: dueDate.toISOString().slice(0, 10),
      description: `Assinatura Zaptrix — ${plan?.name || 'plano'}`,
      externalReference: invoice.id,
    });

    const pixQrCode = await getAsaasPixQrCode(payment.id).catch(() => null);

    await admin
      .from('invoices')
      .update({
        asaas_payment_id: payment.id,
        asaas_invoice_url: payment.invoiceUrl,
        asaas_pix_payload: pixQrCode?.payload || null,
        asaas_pix_qrcode: pixQrCode?.encodedImage || null,
      })
      .eq('id', invoice.id);

    return NextResponse.json({
      workspaceId: workspace.id,
      requiresPayment: true,
      paymentUrl: payment.invoiceUrl,
      pixQrCode: pixQrCode?.encodedImage || null,
      pixPayload: pixQrCode?.payload || null,
    });
  } catch (err) {
    console.error('Erro ao gerar cobrança de cadastro no Asaas:', err);
    return NextResponse.json({
      workspaceId: workspace.id,
      requiresPayment: true,
      paymentUrl: null,
      warning: 'Cadastro criado, mas houve um erro ao gerar a cobrança. Aguarde o contato do suporte.',
    });
  }
}
