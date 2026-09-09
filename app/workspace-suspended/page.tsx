'use client';

import { useRouter } from 'next/navigation';
import { Lock } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function WorkspaceSuspendedPage() {
  const router = useRouter();
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-8">
      <div className="max-w-md w-full">
        <div className="bg-card border border-destructive rounded-lg p-12 text-center">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center">
              <Lock className="w-8 h-8 text-destructive" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-foreground mb-2">Workspace Suspenso</h1>
          <p className="text-muted-foreground mb-6">
            Sua conta foi suspensa temporariamente. Entre em contato com o suporte para mais informações.
          </p>

          <div className="bg-muted/50 rounded-lg p-4 mb-8 text-sm text-muted-foreground">
            <p>Se acredita que isso é um erro, envie um email para:</p>
            <p className="font-semibold text-foreground mt-2">suporte@zaptrix.com.br</p>
          </div>

          <button
            onClick={handleLogout}
            className="w-full px-6 py-2 border border-border text-foreground rounded-md font-medium hover:bg-muted transition-colors"
          >
            Sair
          </button>
        </div>
      </div>
    </div>
  );
}
