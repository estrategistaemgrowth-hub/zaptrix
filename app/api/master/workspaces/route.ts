import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateInvoiceWithAsaasCharge } from '@/lib/generate-invoice';

/**
 * Confere que quem chama é super admin da plataforma. A API nunca confia só
 * no middleware (que já protege /master/**) — toda rota se protege sozinha.
 */
async function requirePlatformAdmin(supabase: Awaited<ReturnType<typeof createServerClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, isAdmin: false as const };
  }

  const { data: adminRow } = await supabase
    .from('platform_admins')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();

  return { user, isAdmin: !!adminRow };
}

export async function GET() {
  const supabase = await createServerClient();
  const { user, isAdmin } = await requirePlatformAdmin(supabase);

  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }
  if (!isAdmin) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  }

  // Client admin (service role) porque o super admin não é workspace_member
  // de nenhum lojista — sem isso, RLS de products/workspace_members bloqueia
  // a contagem de uso mesmo com is_platform_admin() liberando workspaces/invoices.
  const admin = createAdminClient();

  const { data: workspaces, error } = await admin
    .from('workspaces')
    .select('*, plan:plans(*)')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Erro ao listar workspaces (master):', error);
    return NextResponse.json({ error: 'Erro ao buscar lojas' }, { status: 400 });
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const enriched = await Promise.all(
    (workspaces || []).map(async (ws) => {
      const [
        { data: ownerData },
        { count: productCount },
        { count: memberCount },
        { count: connectedCount },
        { count: messages7d },
      ] = await Promise.all([
        admin.auth.admin.getUserById(ws.owner_user_id),
        admin.from('products').select('id', { count: 'exact', head: true }).eq('workspace_id', ws.id),
        admin
          .from('workspace_members')
          .select('id', { count: 'exact', head: true })
          .eq('workspace_id', ws.id),
        admin
          .from('whatsapp_connections')
          .select('id', { count: 'exact', head: true })
          .eq('workspace_id', ws.id)
          .eq('status', 'connected'),
        // Proxy de "quanto o lojista usa o sistema": volume de mensagens
        // (enviadas/recebidas) nos últimos 7 dias — mais fiel ao uso real de
        // um produto de atendimento via WhatsApp do que login no painel.
        admin
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('workspace_id', ws.id)
          .gte('created_at', sevenDaysAgo),
      ]);

      return {
        ...ws,
        ownerEmail: ownerData.user?.email || null,
        productCount: productCount || 0,
        memberCount: memberCount || 0,
        whatsappConnected: (connectedCount || 0) > 0,
        messages7d: messages7d || 0,
      };
    })
  );

  const today = new Date().toISOString().slice(0, 10);
  const { data: openInvoices } = await admin
    .from('invoices')
    .select('id, status, due_date')
    .in('status', ['pending', 'overdue']);

  const overdueInvoiceCount = (openInvoices || []).filter(
    (inv) => inv.status === 'overdue' || inv.due_date < today
  ).length;

  const now = new Date();
  const summary = {
    totalWorkspaces: enriched.length,
    whatsappConnectedCount: enriched.filter((w) => w.whatsappConnected).length,
    withProductsCount: enriched.filter((w) => w.productCount > 0).length,
    trialCount: enriched.filter((w) => w.subscription_status === 'trial').length,
    complimentaryCount: enriched.filter((w) => w.is_complimentary).length,
    blockedCount: enriched.filter((w) => w.status !== 'active').length,
    expiredSubscriptionCount: enriched.filter(
      (w) =>
        !w.is_complimentary &&
        w.subscription_expires_at &&
        new Date(w.subscription_expires_at) < now
    ).length,
    overdueInvoiceCount,
  };

  return NextResponse.json({ workspaces: enriched, summary });
}

export async function POST(request: NextRequest) {
  const {
    storeName,
    siteUrl,
    segment,
    email,
    password,
    planId,
    expiresAt,
    isComplimentary,
    cpfCnpj,
    generateAsaasCharge,
  } = await request.json();

  if (!storeName || !email || !password || !planId || !expiresAt) {
    return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 });
  }

  const supabase = await createServerClient();
  const { user, isAdmin } = await requirePlatformAdmin(supabase);

  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }
  if (!isAdmin) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  }

  const admin = createAdminClient();

  // Criação via service role no servidor — signUp direto do client (o bug
  // original) desloga o próprio super admin, porque o Supabase Auth
  // client-side loga automaticamente como o usuário recém-criado. Mesmo
  // padrão de app/api/workspace/members/route.ts.
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

  const { data: workspace, error: wsError } = await admin
    .from('workspaces')
    .insert([
      {
        name: storeName,
        site_url: siteUrl || null,
        segment: segment || null,
        owner_user_id: newUser.user.id,
        created_by: user.id,
        status: 'active',
        plan_id: planId,
        subscription_status: 'active',
        subscription_expires_at: expiresAt,
        is_complimentary: !!isComplimentary,
        cpf_cnpj: cpfCnpj || null,
      },
    ])
    .select()
    .single();

  if (wsError || !workspace) {
    // Evita usuário órfão sem workspace se o insert falhar depois de já criado no Auth.
    await admin.auth.admin.deleteUser(newUser.user.id);
    return NextResponse.json(
      { error: wsError?.message || 'Erro ao criar workspace' },
      { status: 400 }
    );
  }

  const { error: memberError } = await admin.from('workspace_members').insert([
    {
      workspace_id: workspace.id,
      user_id: newUser.user.id,
      role: 'owner',
    },
  ]);

  if (memberError) {
    await admin.from('workspaces').delete().eq('id', workspace.id);
    await admin.auth.admin.deleteUser(newUser.user.id);
    return NextResponse.json({ error: memberError.message }, { status: 400 });
  }

  // Acesso privilegiado (cortesia) nunca gera cobrança — não faz sentido
  // cobrar e ao mesmo tempo marcar como isento de cobrança.
  if (!generateAsaasCharge || isComplimentary) {
    return NextResponse.json({ workspaceId: workspace.id, email, password });
  }

  const { data: plan } = await admin
    .from('plans')
    .select('name, price_cents')
    .eq('id', planId)
    .maybeSingle();

  if (!plan) {
    return NextResponse.json({ workspaceId: workspace.id, email, password });
  }

  const { invoice, asaasWarning } = await generateInvoiceWithAsaasCharge({
    admin,
    workspaceId: workspace.id,
    amountCents: plan.price_cents,
    dueDate: expiresAt,
    notes: `Assinatura Zaptrix — ${plan.name}`,
    cpfCnpj,
    createdBy: user.id,
  });

  return NextResponse.json({ workspaceId: workspace.id, email, password, invoice, asaasWarning });
}

export async function PATCH(request: NextRequest) {
  const { workspaceId, planId, expiresAt, status, statusReason, isComplimentary } = await request.json();

  if (!workspaceId) {
    return NextResponse.json({ error: 'workspaceId obrigatório' }, { status: 400 });
  }

  const supabase = await createServerClient();
  const { user, isAdmin } = await requirePlatformAdmin(supabase);

  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }
  if (!isAdmin) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  }

  const updates: Record<string, unknown> = {};
  if (planId !== undefined) updates.plan_id = planId || null;
  if (expiresAt !== undefined) updates.subscription_expires_at = expiresAt || null;
  if (isComplimentary !== undefined) updates.is_complimentary = !!isComplimentary;
  if (status !== undefined) {
    updates.status = status;
    updates.status_changed_at = new Date().toISOString();
    updates.status_changed_by = user.id;
    updates.status_reason = statusReason ?? null;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nada para atualizar' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from('workspaces').update(updates).eq('id', workspaceId);

  if (error) {
    console.error('Erro ao atualizar workspace (master):', error);
    return NextResponse.json({ error: 'Erro ao atualizar loja' }, { status: 400 });
  }

  return NextResponse.json({ status: 'ok' });
}
