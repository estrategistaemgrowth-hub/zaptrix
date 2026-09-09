import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isAsaasConfigured, createAsaasCustomer, createAsaasPayment, getAsaasPixQrCode } from '@/lib/asaas';

// Documento financeiro — limite conservador, mesmo espírito do
// app/api/whatsapp/send-media/route.ts (rejeita cedo, antes do upload).
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
// Bucket "invoices" é privado (diferente de product-images/message-media):
// getPublicUrl não serve, cada GET gera uma signed URL de curta duração.
const SIGNED_URL_TTL_SECONDS = 300;

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

export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get('workspaceId');

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

  const admin = createAdminClient();

  const { data: invoices, error } = await admin
    .from('invoices')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('due_date', { ascending: false });

  if (error) {
    console.error('Erro ao listar faturas (master):', error);
    return NextResponse.json({ error: 'Erro ao buscar faturas' }, { status: 400 });
  }

  // file_url guarda o PATH dentro do bucket privado, não a URL final — a
  // signed URL é gerada aqui, na hora da consulta, com validade curta.
  const withUrls = await Promise.all(
    (invoices || []).map(async (invoice) => {
      if (!invoice.file_url) {
        return { ...invoice, downloadUrl: null };
      }
      const { data: signed } = await admin.storage
        .from('invoices')
        .createSignedUrl(invoice.file_url, SIGNED_URL_TTL_SECONDS);
      return { ...invoice, downloadUrl: signed?.signedUrl || null };
    })
  );

  return NextResponse.json({ invoices: withUrls });
}

export async function POST(request: NextRequest) {
  const {
    workspaceId,
    amountCents,
    dueDate,
    status,
    notes,
    base64,
    fileName,
    mimeType,
    generateAsaasCharge,
    cpfCnpj,
  } = await request.json();

  if (!workspaceId || !amountCents || !dueDate) {
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
  let filePath: string | null = null;

  if (base64 && fileName) {
    // Estimativa de tamanho a partir do base64, suficiente pra rejeitar cedo.
    const approxBytes = Math.floor((String(base64).length * 3) / 4);
    if (approxBytes > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json({ error: 'Arquivo muito grande. O limite é 10MB.' }, { status: 413 });
    }

    const safeFileName = String(fileName).trim() || `fatura-${Date.now()}.pdf`;
    filePath = `${workspaceId}/${Date.now()}-${safeFileName}`;
    const buffer = Buffer.from(base64, 'base64');

    // Upload via admin client: bypassa RLS, a policy de escrita do bucket
    // "invoices" já exige is_platform_admin() — validado acima.
    const { error: uploadError } = await admin.storage
      .from('invoices')
      .upload(filePath, buffer, {
        contentType: mimeType || 'application/octet-stream',
        upsert: false,
      });

    if (uploadError) {
      console.error('Erro ao subir fatura para o storage:', uploadError);
      return NextResponse.json({ error: 'Não foi possível salvar o arquivo.' }, { status: 500 });
    }
  }

  const { data: invoice, error: insertError } = await admin
    .from('invoices')
    .insert([
      {
        workspace_id: workspaceId,
        amount_cents: amountCents,
        due_date: dueDate,
        status: status || 'pending',
        file_url: filePath,
        notes: notes || null,
        created_by: user.id,
      },
    ])
    .select()
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 400 });
  }

  if (!generateAsaasCharge) {
    return NextResponse.json({ invoice });
  }

  if (!isAsaasConfigured()) {
    return NextResponse.json({
      invoice,
      asaasWarning: 'ASAAS_API_KEY não configurada no ambiente. Fatura salva sem cobrança automática.',
    });
  }

  try {
    const { data: workspace } = await admin
      .from('workspaces')
      .select('name, owner_user_id, asaas_customer_id, cpf_cnpj')
      .eq('id', workspaceId)
      .maybeSingle();

    if (!workspace) {
      return NextResponse.json({ invoice, asaasWarning: 'Workspace não encontrado para gerar cobrança.' });
    }

    let asaasCustomerId = workspace.asaas_customer_id as string | null;

    if (!asaasCustomerId) {
      const finalCpfCnpj = cpfCnpj || workspace.cpf_cnpj;
      if (!finalCpfCnpj) {
        return NextResponse.json({
          invoice,
          asaasWarning: 'Informe o CPF/CNPJ do lojista para gerar a primeira cobrança no Asaas.',
        });
      }

      const { data: ownerUser } = await admin.auth.admin.getUserById(workspace.owner_user_id);
      const customer = await createAsaasCustomer(
        workspace.name,
        finalCpfCnpj,
        ownerUser.user?.email || ''
      );
      asaasCustomerId = customer.id;

      await admin
        .from('workspaces')
        .update({ asaas_customer_id: asaasCustomerId, cpf_cnpj: finalCpfCnpj })
        .eq('id', workspaceId);
    }

    const payment = await createAsaasPayment({
      customerId: asaasCustomerId,
      value: amountCents / 100,
      dueDate,
      description: notes || `Assinatura Zaptrix — ${workspace.name}`,
      externalReference: invoice.id,
    });

    const pixQrCode = await getAsaasPixQrCode(payment.id).catch(() => null);

    const { data: updatedInvoice } = await admin
      .from('invoices')
      .update({
        asaas_payment_id: payment.id,
        asaas_invoice_url: payment.invoiceUrl,
        asaas_pix_payload: pixQrCode?.payload || null,
        asaas_pix_qrcode: pixQrCode?.encodedImage || null,
      })
      .eq('id', invoice.id)
      .select()
      .single();

    return NextResponse.json({ invoice: updatedInvoice || invoice });
  } catch (err) {
    console.error('Erro ao gerar cobrança no Asaas:', err);
    return NextResponse.json({
      invoice,
      asaasWarning: err instanceof Error ? err.message : 'Erro ao gerar cobrança no Asaas.',
    });
  }
}

export async function PATCH(request: NextRequest) {
  const { invoiceId, status } = await request.json();

  if (!invoiceId || !status) {
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
  const { error } = await admin.from('invoices').update({ status }).eq('id', invoiceId);

  if (error) {
    console.error('Erro ao atualizar fatura (master):', error);
    return NextResponse.json({ error: 'Erro ao atualizar fatura' }, { status: 400 });
  }

  return NextResponse.json({ status: 'ok' });
}
