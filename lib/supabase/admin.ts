import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * Client com a service_role key — só pode ser usado em código server-side
 * (API routes, server actions). Bypassa RLS, então todo caller precisa
 * validar autenticação/autorização antes de usar este client.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
