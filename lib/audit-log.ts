import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Grava uma linha no log de auditoria do painel master (admin_audit_log).
 * Best-effort: nunca lança — uma falha em logar não pode derrubar a ação
 * real que estava sendo executada.
 */
export async function logAdminAction({
  admin,
  adminUserId,
  action,
  targetWorkspaceId,
  details,
}: {
  admin: ReturnType<typeof createAdminClient>;
  adminUserId: string;
  action: string;
  targetWorkspaceId?: string | null;
  details?: Record<string, unknown>;
}) {
  try {
    await admin.from('admin_audit_log').insert([
      {
        admin_user_id: adminUserId,
        action,
        target_workspace_id: targetWorkspaceId || null,
        details: details || null,
      },
    ]);
  } catch (err) {
    console.error('Erro ao gravar log de auditoria (ignorado):', err);
  }
}
