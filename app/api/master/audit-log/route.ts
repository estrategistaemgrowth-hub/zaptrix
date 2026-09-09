import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const { data: adminRow } = await supabase
    .from('platform_admins')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!adminRow) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  }

  const admin = createAdminClient();

  const { data: logs, error } = await admin
    .from('admin_audit_log')
    .select('id, action, target_workspace_id, details, created_at, admin_user_id')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    console.error('Erro ao listar log de auditoria:', error);
    return NextResponse.json({ error: 'Erro ao buscar log' }, { status: 400 });
  }

  const workspaceIds = Array.from(new Set((logs || []).map((l) => l.target_workspace_id).filter(Boolean)));
  const adminIds = Array.from(new Set((logs || []).map((l) => l.admin_user_id).filter(Boolean)));

  const [{ data: workspaces }, adminEmails] = await Promise.all([
    workspaceIds.length > 0
      ? admin.from('workspaces').select('id, name').in('id', workspaceIds as string[])
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    Promise.all(
      adminIds.map(async (id) => {
        const { data } = await admin.auth.admin.getUserById(id as string);
        return { id, email: data.user?.email || null };
      })
    ),
  ]);

  const workspaceNameById = new Map((workspaces || []).map((w) => [w.id, w.name]));
  const adminEmailById = new Map(adminEmails.map((a) => [a.id, a.email]));

  const enriched = (logs || []).map((log) => ({
    ...log,
    workspaceName: log.target_workspace_id ? workspaceNameById.get(log.target_workspace_id) || null : null,
    adminEmail: adminEmailById.get(log.admin_user_id) || null,
  }));

  return NextResponse.json({ logs: enriched });
}
