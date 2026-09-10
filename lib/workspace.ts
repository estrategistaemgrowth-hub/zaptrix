import { SupabaseClient } from '@supabase/supabase-js';

export interface WorkspaceContext {
  workspaceId: string;
  role: 'owner' | 'admin' | 'atendente';
}

/**
 * Retorna o workspace do usuário logado, criando um automaticamente
 * se ele ainda não pertencer a nenhum (ex: signup direto, sem passar
 * pelo fluxo do Master Panel). Sem isso, todo INSERT/SELECT que dependa
 * de workspace_id falha silenciosamente porque a query de membership
 * não encontra nada.
 */
export async function ensureWorkspace(
  supabase: SupabaseClient,
  userId: string,
  userEmail?: string | null
): Promise<WorkspaceContext | null> {
  const { data: existing, error: existingError } = await supabase
    .from('workspace_members')
    .select('workspace_id, role')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();

  if (existingError) {
    console.error('Erro ao buscar workspace do usuário:', existingError);
  }

  if (existing) {
    return { workspaceId: existing.workspace_id, role: existing.role };
  }

  // Super admin (platform_admin) nunca deve ganhar um workspace de lojista
  // automaticamente — ele não é lojista. Sem essa checagem, uma corrida no
  // roteamento client-side (a página do dashboard chegando a montar por um
  // instante antes do middleware redirecionar pro /master) cria workspaces
  // fantasmas em nome do super admin (bug real, já aconteceu em produção).
  const { data: adminRow } = await supabase
    .from('platform_admins')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (adminRow) {
    return null;
  }

  // Usuário sem workspace: criar um automaticamente (dono), já com teste
  // grátis de 7 dias — sem subscription_expires_at definido, o middleware
  // nunca bloqueia por vencimento (bug real que isso corrige: alguém que
  // chegasse aqui sem passar por /assinar ganhava acesso grátis pra sempre).
  const workspaceName = userEmail ? `Workspace de ${userEmail.split('@')[0]}` : 'Meu Workspace';
  const trialExpiresAt = new Date();
  trialExpiresAt.setDate(trialExpiresAt.getDate() + 7);

  const { data: newWorkspace, error: createError } = await supabase
    .from('workspaces')
    .insert([
      {
        name: workspaceName,
        owner_user_id: userId,
        created_by: userId,
        subscription_status: 'trial',
        subscription_expires_at: trialExpiresAt.toISOString(),
      },
    ])
    .select('id')
    .single();

  if (createError || !newWorkspace) {
    console.error('Erro ao criar workspace:', createError);
    return null;
  }

  const { error: memberError } = await supabase
    .from('workspace_members')
    .insert([{ workspace_id: newWorkspace.id, user_id: userId, role: 'owner' }]);

  if (memberError) {
    console.error('Erro ao vincular usuário ao workspace:', memberError);
    return null;
  }

  return { workspaceId: newWorkspace.id, role: 'owner' };
}
