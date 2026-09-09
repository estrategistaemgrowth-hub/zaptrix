import { createClient } from '@/lib/supabase/client';

const ADMIN_EMAILS = (process.env.NEXT_PUBLIC_PLATFORM_ADMIN_EMAILS ||
  process.env.PLATFORM_ADMIN_EMAILS || '').split(',').map(e => e.trim()).filter(Boolean);

export async function bootstrapPlatformAdmin(userId: string, userEmail: string) {
  if (!ADMIN_EMAILS.includes(userEmail)) {
    return false;
  }

  const supabase = createClient();

  const { data: existing } = await supabase
    .from('platform_admins')
    .select('id')
    .eq('user_id', userId)
    .single();

  if (existing) {
    return true;
  }

  const { error } = await supabase
    .from('platform_admins')
    .insert([{ user_id: userId }]);

  return !error;
}
