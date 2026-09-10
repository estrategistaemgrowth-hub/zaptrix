'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ensureWorkspace } from '@/lib/workspace';
import { Loader2 } from 'lucide-react';

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createClient();
  const [companyName, setCompanyName] = useState('');
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');

  async function handleStart() {
    setStarting(true);
    setError('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        router.push('/login');
        return;
      }

      const workspace = await ensureWorkspace(supabase, session.user.id, session.user.email);

      if (!workspace) {
        setError('Não foi possível configurar seu workspace. Tente novamente.');
        setStarting(false);
        return;
      }

      if (companyName.trim()) {
        await supabase
          .from('workspaces')
          .update({ name: companyName.trim() })
          .eq('id', workspace.workspaceId);
      }

      router.push('/dashboard');
    } catch (err) {
      console.error('Erro no onboarding:', err);
      setError('Ocorreu um erro inesperado. Tente novamente.');
      setStarting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-8">
      <div className="max-w-2xl w-full">
        <div className="bg-card border border-border rounded-lg p-12 text-center">
          <h1 className="text-3xl font-bold text-foreground mb-4">Bem-vindo ao Zaptrix!</h1>
          <p className="text-muted-foreground mb-8">Vamos configurar sua conta em poucos passos.</p>

          <div className="space-y-6">
            <div className="bg-muted/50 rounded-lg p-6 text-left">
              <div className="flex items-center gap-4 mb-4">
                <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold">
                  1
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Dados da empresa</h3>
                  <p className="text-sm text-muted-foreground">Como sua empresa se chama?</p>
                </div>
              </div>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="ex: Loja da Ana"
                className="w-full px-4 py-2 border border-border rounded-lg bg-white text-foreground"
              />
            </div>

            <div className="bg-muted/50 rounded-lg p-6 text-left opacity-50">
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-muted text-muted-foreground rounded-full flex items-center justify-center font-bold">
                  2
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Integrar WhatsApp</h3>
                  <p className="text-sm text-muted-foreground">Conecte seu número do WhatsApp</p>
                </div>
              </div>
            </div>

            <div className="bg-muted/50 rounded-lg p-6 text-left opacity-50">
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-muted text-muted-foreground rounded-full flex items-center justify-center font-bold">
                  3
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Configurar IA</h3>
                  <p className="text-sm text-muted-foreground">Personalize o agente de atendimento</p>
                </div>
              </div>
            </div>

            <div className="bg-muted/50 rounded-lg p-6 text-left opacity-50">
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-muted text-muted-foreground rounded-full flex items-center justify-center font-bold">
                  4
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Base de conhecimento</h3>
                  <p className="text-sm text-muted-foreground">Treinar a IA com seus produtos</p>
                </div>
              </div>
            </div>

            <div className="bg-muted/50 rounded-lg p-6 text-left opacity-50">
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-muted text-muted-foreground rounded-full flex items-center justify-center font-bold">
                  5
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Convidar usuários</h3>
                  <p className="text-sm text-muted-foreground">Adicione admin e atendentes</p>
                </div>
              </div>
            </div>
          </div>

          {error && (
            <p className="mt-6 text-sm text-destructive">{error}</p>
          )}

          <button
            onClick={handleStart}
            disabled={starting}
            className="mt-12 px-8 py-3 bg-primary text-primary-foreground rounded-md font-medium hover:opacity-90 cursor-pointer disabled:opacity-50 inline-flex items-center gap-2"
          >
            {starting && <Loader2 className="w-4 h-4 animate-spin" />}
            {starting ? 'Configurando...' : 'Começar agora'}
          </button>
        </div>
      </div>
    </div>
  );
}
