import { createServerClient, parseCookieHeader } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = ['/login', '/signup', '/assinar'];
const NO_WORKSPACE_CHECK_PATHS = ['/onboarding', '/workspace-suspended', '/assinatura-vencida'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Rotas de API fazem sua própria checagem de auth (createServerClient().auth.getUser()
  // dentro de cada handler) — e o webhook do WhatsApp É chamado pela Evolution API sem
  // sessão nenhuma, então nunca pode passar por um redirect de "sem sessão = /login".
  if (pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return parseCookieHeader(request.headers.get('cookie') ?? '');
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const { data: platformAdmin } = await supabase
    .from('platform_admins')
    .select('id')
    .eq('user_id', session.user.id)
    .maybeSingle();

  const isPlatformAdmin = !!platformAdmin;

  // Rotas do painel master exigem platform_admin — não passam pela checagem de
  // workspace/plano abaixo (super admin não pertence a nenhum workspace de lojista).
  if (pathname.startsWith('/master')) {
    if (!isPlatformAdmin) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return response;
  }

  // .limit(1) antes de .maybeSingle(): se o usuário tiver mais de uma linha em
  // workspace_members (não deveria, mas já aconteceu em teste — .maybeSingle()
  // sozinho erra com "multiple rows" e o erro descartado vira `null`,
  // mandando um usuário com workspace de verdade pro /onboarding por engano).
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', session.user.id)
    .limit(1)
    .maybeSingle();

  // Super admin sem workspace nenhum (o caso comum — ele não é lojista) nunca
  // deve cair no fluxo de onboarding/dashboard de lojista: vai direto pro
  // painel master, em qualquer rota que não seja /master (já tratada acima).
  if (!membership && isPlatformAdmin) {
    return NextResponse.redirect(new URL('/master', request.url));
  }

  if (NO_WORKSPACE_CHECK_PATHS.some((p) => pathname.startsWith(p))) {
    return response;
  }

  if (!membership) {
    return NextResponse.redirect(new URL('/onboarding', request.url));
  }

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('status, subscription_status, subscription_expires_at, is_complimentary')
    .eq('id', membership.workspace_id)
    .maybeSingle();

  if (workspace?.status !== 'active') {
    return NextResponse.redirect(new URL('/workspace-suspended', request.url));
  }

  // "overdue" = cadastro pago cuja 1ª cobrança nunca foi confirmada (ou
  // assinatura que atrasou depois) — bloqueia na hora, independente da data
  // de vencimento. Sem essa checagem, subscription_expires_at sozinho não
  // bloqueava: o signup grava vencimento 30 dias à frente já na criação
  // (pra já existir uma data quando o pagamento confirmar), então um cadastro
  // pago que nunca pagou tinha acesso livre por 30 dias.
  if (!workspace.is_complimentary && workspace.subscription_status === 'overdue') {
    return NextResponse.redirect(new URL('/assinatura-vencida', request.url));
  }

  // Assinatura vencida (teste grátis acabou, ou assinatura ativa que lapsou
  // sem renovar) bloqueia o acesso até o pagamento cair — workspaces sem data
  // de vencimento definida (ex: criados manualmente sem plano) nunca bloqueiam
  // por esta regra. Acesso privilegiado (cortesia/parceria) nunca é bloqueado
  // por vencimento, mesmo com data no passado — só o status manual acima
  // ainda pode suspendê-lo.
  if (
    !workspace.is_complimentary &&
    workspace.subscription_expires_at &&
    new Date(workspace.subscription_expires_at) < new Date()
  ) {
    return NextResponse.redirect(new URL('/assinatura-vencida', request.url));
  }

  return response;
}

export const config = {
  // Exclui assets internos do Next E qualquer arquivo estático servido de /public
  // (ex: /zaptrix-icon.png) — sem isso, a própria tela de login ficava sem logo
  // porque a imagem também passava pela checagem de sessão.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
