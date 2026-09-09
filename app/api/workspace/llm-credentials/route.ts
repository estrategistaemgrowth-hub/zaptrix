import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { encryptSecret, maskKey } from '@/lib/security/encrypt';

async function getMembership() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: membership } = await supabase
    .from('workspace_members')
    .select('workspace_id, role')
    .eq('user_id', user.id)
    .maybeSingle();

  return membership;
}

export async function POST(request: NextRequest) {
  const { provider, apiKey, modelId } = await request.json();

  if (!provider || !apiKey) {
    return NextResponse.json({ error: 'Provider e API key são obrigatórios' }, { status: 400 });
  }

  const membership = await getMembership();
  if (!membership || !['owner', 'admin'].includes(membership.role)) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  }

  const supabase = await createServerClient();

  // Só uma credencial "primary" por workspace: desmarca as outras antes de inserir
  await supabase
    .from('llm_credentials')
    .update({ is_primary: false })
    .eq('workspace_id', membership.workspace_id);

  const { error: insertError } = await supabase.from('llm_credentials').insert([
    {
      workspace_id: membership.workspace_id,
      provider,
      encrypted_api_key: encryptSecret(apiKey),
      key_hint: maskKey(apiKey),
      model_id: modelId || null,
      is_primary: true,
      enabled: true,
    },
  ]);

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 400 });
  }

  return NextResponse.json({ status: 'ok' });
}

export async function DELETE(request: NextRequest) {
  const { credentialId } = await request.json();

  const membership = await getMembership();
  if (!membership || !['owner', 'admin'].includes(membership.role)) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  }

  const supabase = await createServerClient();
  const { error: deleteError } = await supabase
    .from('llm_credentials')
    .delete()
    .eq('id', credentialId)
    .eq('workspace_id', membership.workspace_id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 400 });
  }

  return NextResponse.json({ status: 'ok' });
}
