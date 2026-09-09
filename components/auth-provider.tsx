'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { bootstrapPlatformAdmin } from '@/lib/auth/bootstrap-admin';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        // Bootstrap platform admin if email is in whitelist
        await bootstrapPlatformAdmin(session.user.id, session.user.email || '');
      }

      // Listen for auth changes
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_OUT') {
          router.push('/login');
        } else if (event === 'SIGNED_IN' && session?.user) {
          await bootstrapPlatformAdmin(session.user.id, session.user.email || '');
        }
      });

      return () => {
        subscription?.unsubscribe();
      };
    };

    checkSession();
  }, [supabase, router]);

  return <>{children}</>;
}
