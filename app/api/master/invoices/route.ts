import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

// Documento financeiro — limite conservador, mesmo espírito do
// app/api/whatsapp/send-media/route.ts (rejeita cedo, antes do upload).
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
// Bucket "invoices" é privado (diferente de product-images/message-media):
// getPublicUrl não serve, cada GET gera uma signed URL de curta duração.
const SIGNED_URL_TTL_SECONDS = 300;

async function requirePlatformAdmin(supabase: Awaited<ReturnType<typeof createServerClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, isAdmin: false as const };
  }

  const { data: adminRow } = await supabase
    .from('platform_admins')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();

  return { user, isAdmin: !!adminRow };
}

export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get('workspaceId');

  if (!workspaceId) {
    return NextResponse.json({ error: 'workspaceId obrigatório' }, { status: 400 });
  }

  const supabase = await createServerClient();
  const { user, isAdmin } = await requirePlatformAdmin(supabase);

  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }
  if (!isAdmin) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  }

  const admin = createAdminClient();

  const { data: invoices, error } = await admin
    .from('invoices')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('due_date', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // file_url guarda o PATH dentro do bucket privado, não a URL final — a
  // signed URL é gerada aqui, na hora da consulta, com validade curta.
  const withUrls = await Promise.all(
    (invoices || []).map(async (invoice) => {
      if (!invoice.file_url) {
        return { ...invoice, downloadUrl: null };
      }
      const { data: signed } = await admin.storage
        .from('invoices')
        .createSignedUrl(invoice.file_url, SIGNED_URL_TTL_SECONDS);
      return { ...invoice, downloadUrl: signed?.signedUrl || null };
    })
  );

  return NextResponse.json({ invoices: withUrls });
}

export async function POST(request: NextRequest) {
  const { workspaceId, amountCents, dueDate, status, notes, base64, fileName, mimeType } =
    await request.json();

  if (!workspaceId || !amountCents || !dueDate) {
    return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 });
  }

  const supabase = await createServerClient();
  const { user, isAdmin } = await requirePlatformAdmin(supabase);

  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }
  if (!isAdmin) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  }

  const admin = createAdminClient();
  let filePath: string | null = null;

  if (base64 && fileName) {
    // Estimativa de tamanho a partir do base64, suficiente pra rejeitar cedo.
    const approxBytes = Math.floor((String(base64).length * 3) / 4);
    if (approxBytes > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json({ error: 'Arquivo muito grande. O limite é 10MB.' }, { status: 413 });
    }

    const safeFileName = String(fileName).trim() || `fatura-${Date.now()}.pdf`;
    filePath = `${workspaceId}/${Date.now()}-${safeFileName}`;
    const buffer = Buffer.from(base64, 'base64');

    // Upload via admin client: bypassa RLS, a policy de escrita do bucket
    // "invoices" já exige is_platform_admin() — validado acima.
    const { error: uploadError } = await admin.storage
      .from('invoices')
      .upload(filePath, buffer, {
        contentType: mimeType || 'application/octet-stream',
        upsert: false,
      });

    if (uploadError) {
      console.error('Erro ao subir fatura para o storage:', uploadError);
      return NextResponse.json({ error: 'Não foi possível salvar o arquivo.' }, { status: 500 });
    }
  }

  const { data: invoice, error: insertError } = await admin
    .from('invoices')
    .insert([
      {
        workspace_id: workspaceId,
        amount_cents: amountCents,
        due_date: dueDate,
        status: status || 'pending',
        file_url: filePath,
        notes: notes || null,
        created_by: user.id,
      },
    ])
    .select()
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 400 });
  }

  return NextResponse.json({ invoice });
}

export async function PATCH(request: NextRequest) {
  const { invoiceId, status } = await request.json();

  if (!invoiceId || !status) {
    return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 });
  }

  const supabase = await createServerClient();
  const { user, isAdmin } = await requirePlatformAdmin(supabase);

  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }
  if (!isAdmin) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from('invoices').update({ status }).eq('id', invoiceId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ status: 'ok' });
}
