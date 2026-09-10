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
    .limit(1)
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

  // A 1ª credencial do workspace vira principal automaticamente. Da 2ª em
  // diante, entra sem marcação — o lojista escolhe principal/fallback pela
  // tela (evita que adicionar um 2º provedor derrube sem querer o que já
  // estava funcionando como principal).
  const { count: existingCount } = await supabase
    .from('llm_credentials')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', membership.workspace_id);

  const { error: insertError } = await supabase.from('llm_credentials').insert([
    {
      workspace_id: membership.workspace_id,
      provider,
      encrypted_api_key: encryptSecret(apiKey),
      key_hint: maskKey(apiKey),
      model_id: modelId || null,
      is_primary: !existingCount,
      enabled: true,
    },
  ]);

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 400 });
  }

  return NextResponse.json({ status: 'ok' });
}

export async function PATCH(request: NextRequest) {
  const { credentialId, role } = await request.json();

  if (!credentialId || !['primary', 'fallback'].includes(role)) {
    return NextResponse.json({ error: 'credentialId e role (primary|fallback) são obrigatórios' }, { status: 400 });
  }

  const membership = await getMembership();
  if (!membership || !['owner', 'admin'].includes(membership.role)) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  }

  const supabase = await createServerClient();

  // Confere que a credencial é do próprio workspace antes de qualquer coisa.
  const { data: target } = await supabase
    .from('llm_credentials')
    .select('id')
    .eq('id', credentialId)
    .eq('workspace_id', membership.workspace_id)
    .maybeSingle();

  if (!target) {
    return NextResponse.json({ error: 'Credencial não encontrada' }, { status: 404 });
  }

  const column = role === 'primary' ? 'is_primary' : 'is_fallback';

  // Só uma credencial em cada papel por workspace: desmarca as outras antes.
  await supabase
    .from('llm_credentials')
    .update({ [column]: false })
    .eq('workspace_id', membership.workspace_id);

  // Uma credencial não pode ser principal e fallback ao mesmo tempo.
  const otherColumn = role === 'primary' ? 'is_fallback' : 'is_primary';
  const { error: updateError } = await supabase
    .from('llm_credentials')
    .update({ [column]: true, [otherColumn]: false })
    .eq('id', credentialId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 });
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

  const { data: deletedRow } = await supabase
    .from('llm_credentials')
    .select('is_primary')
    .eq('id', credentialId)
    .eq('workspace_id', membership.workspace_id)
    .maybeSingle();

  const { error: deleteError } = await supabase
    .from('llm_credentials')
    .delete()
    .eq('id', credentialId)
    .eq('workspace_id', membership.workspace_id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 400 });
  }

  // Removeu a principal e sobrou uma fallback? Promove ela — senão o
  // workspace fica sem nenhuma credencial ativa e a IA para de responder.
  if (deletedRow?.is_primary) {
    const { data: fallback } = await supabase
      .from('llm_credentials')
      .select('id')
      .eq('workspace_id', membership.workspace_id)
      .eq('is_fallback', true)
      .maybeSingle();

    if (fallback) {
      await supabase
        .from('llm_credentials')
        .update({ is_primary: true, is_fallback: false })
        .eq('id', fallback.id);
    }
  }

  return NextResponse.json({ status: 'ok' });
}
