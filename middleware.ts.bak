import { createServerClient, parseCookieHeader, serializeCookieHeader } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public routes (no auth required)
  if (pathname.startsWith('/login') || pathname.startsWith('/signup')) {
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

  const { data: { session } } = await supabase.auth.getSession();

  // No session = redirect to login
  if (!session) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Master routes require platform admin
  if (pathname.startsWith('/master')) {
    const { data: platformAdmin } = await supabase
      .from('platform_admins')
      .select('id')
      .eq('user_id', session.user.id)
      .single();

    if (!platformAdmin) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  // Dashboard routes require workspace membership
  if (pathname.startsWith('/dashboard') && pathname !== '/dashboard') {
    const { data: workspace } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', session.user.id)
      .single();

    if (!workspace) {
      return NextResponse.redirect(new URL('/onboarding', request.url));
    }

    // Check if workspace is active
    const { data: workspaceStatus } = await supabase
      .from('workspaces')
      .select('status')
      .eq('id', workspace.workspace_id)
      .single();

    if (workspaceStatus?.status !== 'active') {
      return NextResponse.redirect(new URL('/workspace-suspended', request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
};
