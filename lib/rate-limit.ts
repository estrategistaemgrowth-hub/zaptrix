import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Rate limit em banco (janela deslizante) — funciona entre instâncias
 * serverless (memória local não serve pra isso na Vercel). Cada chamada
 * conta os hits do mesmo bucket+identifier dentro da janela e, se ainda
 * houver espaço, registra o hit atual. Best-effort: se o banco falhar, deixa
 * passar (nunca derruba uma rota por causa do rate limiter).
 */
export async function checkRateLimit({
  bucket,
  identifier,
  maxHits,
  windowSeconds,
}: {
  bucket: string;
  identifier: string;
  maxHits: number;
  windowSeconds: number;
}): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const windowStart = new Date(Date.now() - windowSeconds * 1000).toISOString();

    const { count, error: countError } = await admin
      .from('rate_limit_hits')
      .select('id', { count: 'exact', head: true })
      .eq('bucket', bucket)
      .eq('identifier', identifier)
      .gte('created_at', windowStart);

    if (countError) {
      console.error('Erro ao checar rate limit (deixando passar):', countError);
      return true;
    }

    if ((count || 0) >= maxHits) {
      return false;
    }

    await admin.from('rate_limit_hits').insert([{ bucket, identifier }]);
    return true;
  } catch (err) {
    console.error('Erro inesperado no rate limiter (deixando passar):', err);
    return true;
  }
}

/** IP do cliente a partir dos headers que a Vercel/proxy repassa. */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip') || 'unknown';
}
