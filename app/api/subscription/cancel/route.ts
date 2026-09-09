import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Cancelar/reativar a própria assinatura (autoatendimento). Cancelar só
 * sinaliza intenção — não derruba o acesso na hora, o lojista continua
 * usando até subscription_expires_at (mesma regra que já bloqueia vencidos
 * no middleware). Sem cobrança recorrente automática hoje, então "cancelar"
 * na prática impede o super admin de gerar a próxima fatura sem confirmar
 * com o lojista antes.
 */
export async function POST(request: NextRequest) {
  const { action } = await request.json();

  if (action !== 'cancel' && action !== 'reactivate') {
    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });
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

  if (membership.role !== 'owner' && membership.role !== 'admin') {
    return NextResponse.json({ error: 'Sem permissão para gerenciar a assinatura' }, { status: 403 });
  }

  const admin = createAdminClient();

  const { data: workspace } = await admin
    .from('workspaces')
    .select('is_complimentary, subscription_status')
    .eq('id', membership.workspace_id)
    .maybeSingle();

  if (workspace?.is_complimentary) {
    return NextResponse.json(
      { error: 'Este workspace tem acesso privilegiado — fale com o suporte.' },
      { status: 400 }
    );
  }

  const newStatus = action === 'cancel' ? 'canceled' : 'active';

  const { error } = await admin
    .from('workspaces')
    .update({ subscription_status: newStatus })
    .eq('id', membership.workspace_id);

  if (error) {
    console.error('Erro ao atualizar status de assinatura:', error);
    return NextResponse.json({ error: 'Erro ao atualizar assinatura' }, { status: 400 });
  }

  return NextResponse.json({ status: 'ok', subscription_status: newStatus });
}
