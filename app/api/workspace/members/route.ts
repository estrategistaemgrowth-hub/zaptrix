import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

function generateTempPassword() {
  return Math.random().toString(36).slice(-6) + Math.random().toString(36).slice(-6).toUpperCase() + '!1';
}

export async function POST(request: NextRequest) {
  const { email, role } = await request.json();

  if (!email || !['admin', 'atendente'].includes(role)) {
    return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 });
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
    .maybeSingle();

  if (!membership || !['owner', 'admin'].includes(membership.role)) {
    return NextResponse.json({ error: 'Sem permissão para adicionar membros' }, { status: 403 });
  }

  const admin = createAdminClient();
  const tempPassword = generateTempPassword();

  const { data: newUser, error: createError } = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
  });

  if (createError || !newUser.user) {
    return NextResponse.json(
      { error: createError?.message || 'Erro ao criar usuário' },
      { status: 400 }
    );
  }

  const { error: memberError } = await admin.from('workspace_members').insert([
    {
      workspace_id: membership.workspace_id,
      user_id: newUser.user.id,
      role,
    },
  ]);

  if (memberError) {
    return NextResponse.json({ error: memberError.message }, { status: 400 });
  }

  return NextResponse.json({ email, tempPassword });
}

export async function DELETE(request: NextRequest) {
  const { memberId } = await request.json();

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
    .maybeSingle();

  if (!membership || !['owner', 'admin'].includes(membership.role)) {
    return NextResponse.json({ error: 'Sem permissão para remover membros' }, { status: 403 });
  }

  const { error: deleteError } = await supabase
    .from('workspace_members')
    .delete()
    .eq('id', memberId)
    .eq('workspace_id', membership.workspace_id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 400 });
  }

  return NextResponse.json({ status: 'ok' });
}
