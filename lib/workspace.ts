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

  // Usuário sem workspace: criar um automaticamente (dono)
  const workspaceName = userEmail ? `Workspace de ${userEmail.split('@')[0]}` : 'Meu Workspace';

  const { data: newWorkspace, error: createError } = await supabase
    .from('workspaces')
    .insert([{ name: workspaceName, owner_user_id: userId, created_by: userId }])
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
