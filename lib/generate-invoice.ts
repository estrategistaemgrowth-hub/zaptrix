import { createAdminClient } from '@/lib/supabase/admin';
import { isAsaasConfigured, createAsaasCustomer, createAsaasPayment, getAsaasPixQrCode } from '@/lib/asaas';

/**
 * Cria uma fatura + (se o Asaas estiver configurado e houver CPF/CNPJ) a
 * cobrança PIX correspondente. Extraído de app/api/master/invoices/route.ts
 * pra ser reaproveitado também na criação de lojista (app/api/master/workspaces/route.ts),
 * sem duplicar a lógica de cliente/pagamento/QR do Asaas.
 */
export async function generateInvoiceWithAsaasCharge({
  admin,
  workspaceId,
  amountCents,
  dueDate,
  notes,
  cpfCnpj,
  createdBy,
  kind = 'subscription',
}: {
  admin: ReturnType<typeof createAdminClient>;
  workspaceId: string;
  amountCents: number;
  dueDate: string;
  notes?: string | null;
  cpfCnpj?: string | null;
  createdBy: string;
  /** 'subscription' (padrão) reativa a assinatura ao ser paga (webhook do
   *  Asaas); 'extra_whatsapp_instance' só incrementa o contador de instâncias
   *  extras — ver app/api/webhooks/asaas/route.ts. */
  kind?: 'subscription' | 'extra_whatsapp_instance';
}) {
  const { data: invoice, error: insertError } = await admin
    .from('invoices')
    .insert([
      {
        workspace_id: workspaceId,
        amount_cents: amountCents,
        due_date: dueDate,
        status: 'pending',
        notes: notes || null,
        created_by: createdBy,
        kind,
      },
    ])
    .select()
    .single();

  if (insertError || !invoice) {
    console.error('Erro ao criar fatura:', insertError);
    return { invoice: null, asaasWarning: 'Erro ao criar fatura.' };
  }

  if (!isAsaasConfigured()) {
    return {
      invoice,
      asaasWarning: 'ASAAS_API_KEY não configurada no ambiente. Fatura salva sem cobrança automática.',
    };
  }

  try {
    const { data: workspace } = await admin
      .from('workspaces')
      .select('name, owner_user_id, asaas_customer_id, cpf_cnpj')
      .eq('id', workspaceId)
      .maybeSingle();

    if (!workspace) {
      return { invoice, asaasWarning: 'Workspace não encontrado para gerar cobrança.' };
    }

    let asaasCustomerId = workspace.asaas_customer_id as string | null;

    if (!asaasCustomerId) {
      const finalCpfCnpj = cpfCnpj || workspace.cpf_cnpj;
      if (!finalCpfCnpj) {
        return {
          invoice,
          asaasWarning: 'Informe o CPF/CNPJ do lojista para gerar a cobrança no Asaas.',
        };
      }

      const { data: ownerUser } = await admin.auth.admin.getUserById(workspace.owner_user_id);
      const customer = await createAsaasCustomer(workspace.name, finalCpfCnpj, ownerUser.user?.email || '');
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

    return { invoice: updatedInvoice || invoice, asaasWarning: null };
  } catch (err) {
    console.error('Erro ao gerar cobrança no Asaas:', err);
    return {
      invoice,
      asaasWarning: err instanceof Error ? err.message : 'Erro ao gerar cobrança no Asaas.',
    };
  }
}
