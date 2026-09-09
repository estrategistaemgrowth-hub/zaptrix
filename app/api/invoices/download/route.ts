import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Gera uma signed URL (5 min) para o arquivo de uma fatura no bucket privado
 * `invoices`. O lojista só lê faturas (RLS de `invoices` já restringe SELECT a
 * is_workspace_member(workspace_id) OR is_platform_admin — ver
 * supabase/migrations/0024_plans_and_billing.sql), mas confirmamos aqui de
 * novo, no código, que a fatura pertence ao workspace do usuário autenticado
 * antes de gerar o link — nunca confia só no filtro implícito da RLS.
 */
export async function GET(request: NextRequest) {
  const invoiceId = request.nextUrl.searchParams.get('invoiceId');

  if (!invoiceId) {
    return NextResponse.json({ error: 'invoiceId é obrigatório' }, { status: 400 });
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
    .select('workspace_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();

  if (!membership) {
    return NextResponse.json({ error: 'Workspace não encontrado' }, { status: 404 });
  }

  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .select('id, workspace_id, file_url')
    .eq('id', invoiceId)
    .eq('workspace_id', membership.workspace_id)
    .maybeSingle();

  if (invoiceError || !invoice) {
    return NextResponse.json({ error: 'Fatura não encontrada' }, { status: 404 });
  }

  if (!invoice.file_url) {
    return NextResponse.json({ error: 'Esta fatura não tem arquivo anexado' }, { status: 404 });
  }

  const admin = createAdminClient();
  const { data: signed, error: signError } = await admin.storage
    .from('invoices')
    .createSignedUrl(invoice.file_url, 300);

  if (signError || !signed) {
    return NextResponse.json(
      { error: signError?.message || 'Erro ao gerar link de download' },
      { status: 400 }
    );
  }

  return NextResponse.json({ url: signed.signedUrl });
}
