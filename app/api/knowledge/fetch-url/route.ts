import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/rate-limit';

// Endereços que nenhum lojista deveria conseguir fazer o servidor buscar por
// ele (SSRF) — rede local, loopback, metadata de nuvem. Checagem por texto no
// hostname: proporcional ao risco real de uma função serverless da Vercel
// (não tem acesso a rede interna corporativa), não uma defesa contra DNS
// rebinding sofisticado.
const BLOCKED_HOSTNAME_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^0\.0\.0\.0$/,
  /^169\.254\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^\[::1\]$/,
  /^::1$/,
];

const FETCH_TIMEOUT_MS = 10_000;
const MAX_CONTENT_CHARS = 20_000;

function stripHtmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n\n')
    .trim();
}

export async function POST(request: NextRequest) {
  const { url } = await request.json();

  if (!url || typeof url !== 'string') {
    return NextResponse.json({ error: 'URL é obrigatória' }, { status: 400 });
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
    .limit(1)
    .maybeSingle();

  if (!membership) {
    return NextResponse.json({ error: 'Workspace não encontrado' }, { status: 404 });
  }

  if (membership.role !== 'owner' && membership.role !== 'admin') {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  }

  const allowed = await checkRateLimit({
    bucket: 'knowledge-fetch-url',
    identifier: membership.workspace_id,
    maxHits: 20,
    windowSeconds: 3600,
  });

  if (!allowed) {
    return NextResponse.json({ error: 'Muitas buscas de URL. Tente novamente em alguns minutos.' }, { status: 429 });
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return NextResponse.json({ error: 'URL inválida' }, { status: 400 });
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return NextResponse.json({ error: 'A URL precisa ser http:// ou https://' }, { status: 400 });
  }

  if (BLOCKED_HOSTNAME_PATTERNS.some((pattern) => pattern.test(parsed.hostname))) {
    return NextResponse.json({ error: 'Este endereço não pode ser buscado' }, { status: 400 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(parsed.toString(), {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ZaptrixBot/1.0)' },
      redirect: 'follow',
    });

    if (!res.ok) {
      return NextResponse.json({ error: `A página respondeu com status ${res.status}` }, { status: 400 });
    }

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
      return NextResponse.json({ error: 'Só páginas HTML são suportadas' }, { status: 400 });
    }

    const html = await res.text();
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim().slice(0, 200) : parsed.hostname;

    const text = stripHtmlToText(html).slice(0, MAX_CONTENT_CHARS);

    if (!text || text.length < 20) {
      return NextResponse.json({ error: 'Não foi possível extrair conteúdo de texto dessa página' }, { status: 400 });
    }

    return NextResponse.json({ title, content: text });
  } catch (err) {
    console.error('Erro ao buscar URL para base de conhecimento:', err);
    const timedOut = err instanceof Error && err.name === 'AbortError';
    return NextResponse.json(
      { error: timedOut ? 'A página demorou demais para responder' : 'Não foi possível acessar essa URL' },
      { status: 400 }
    );
  } finally {
    clearTimeout(timeout);
  }
}
