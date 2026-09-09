'use client';

import { useState, useEffect, Suspense } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Check, Loader2 } from 'lucide-react';

interface Plan {
  id: string;
  name: string;
  price_cents: number;
  product_limit: number;
  member_limit: number;
}

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function SignupForm() {
  const searchParams = useSearchParams();
  const isTrial = searchParams.get('trial') === '1';
  const router = useRouter();
  const supabase = createClient();

  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [storeName, setStoreName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [cpfCnpj, setCpfCnpj] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [paymentInfo, setPaymentInfo] = useState<{
    paymentUrl: string | null;
    pixQrCode: string | null;
    warning?: string;
  } | null>(null);

  useEffect(() => {
    supabase
      .from('plans')
      .select('id, name, price_cents, product_limit, member_limit')
      .order('price_cents', { ascending: true })
      .then(({ data }) => {
        setPlans(data || []);
        if (data && data.length > 0) setSelectedPlanId(data[0].id);
      });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeName,
          email,
          password,
          cpfCnpj: cpfCnpj || undefined,
          planId: isTrial ? undefined : selectedPlanId,
          isTrial,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        setError(result.error || 'Erro ao criar conta');
        return;
      }

      // Loga o usuário recém-criado (o servidor não emite sessão — o client
      // já sabe email/senha porque foi ele mesmo que digitou no formulário).
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        setError('Conta criada, mas houve um erro ao entrar. Tente fazer login manualmente.');
        return;
      }

      if (!result.requiresPayment) {
        router.push('/dashboard');
        return;
      }

      if (!result.paymentUrl && !result.pixQrCode) {
        setPaymentInfo({ paymentUrl: null, pixQrCode: null, warning: result.warning });
        return;
      }

      router.push('/assinatura-vencida');
    } catch (err) {
      setError('Erro inesperado ao criar conta');
    } finally {
      setSubmitting(false);
    }
  }

  if (paymentInfo) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-8">
        <div className="max-w-md w-full bg-card border border-border rounded-2xl shadow-sm p-8 text-center">
          <h1 className="text-xl font-bold text-foreground mb-2">Conta criada!</h1>
          <p className="text-muted-foreground text-sm">
            {paymentInfo.warning || 'Aguarde o contato do suporte para liberar o acesso.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-8">
      <div className="max-w-lg w-full bg-card border border-border rounded-2xl shadow-sm p-8">
        <div className="flex justify-center mb-6">
          <Image src="/zaptrix-logo-light.png" alt="Zaptrix" width={150} height={48} priority />
        </div>

        <h1 className="text-xl font-bold text-foreground text-center mb-1">
          {isTrial ? 'Teste grátis por 7 dias' : 'Assine o Zaptrix'}
        </h1>
        <p className="text-sm text-muted-foreground text-center mb-6">
          {isTrial
            ? 'Sem cartão de crédito. Crie sua conta e comece a usar agora.'
            : 'Automação de vendas e atendimento via WhatsApp com IA'}
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isTrial && plans.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {plans.map((plan) => (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => setSelectedPlanId(plan.id)}
                  className={`p-4 rounded-xl border text-left transition-all duration-200 ${
                    selectedPlanId === plan.id
                      ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                      : 'border-border hover:border-primary/40'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-semibold text-foreground text-sm">{plan.name}</p>
                    {selectedPlanId === plan.id && <Check className="w-4 h-4 text-primary" />}
                  </div>
                  <p className="text-lg font-bold text-primary">{formatCents(plan.price_cents)}</p>
                  <p className="text-xs text-muted-foreground">até {plan.product_limit} produtos</p>
                </button>
              ))}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Nome da loja</label>
            <input
              type="text"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              required
              className="w-full px-4 py-2 border border-border rounded-xl bg-white text-foreground"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2 border border-border rounded-xl bg-white text-foreground"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-4 py-2 border border-border rounded-xl bg-white text-foreground"
            />
          </div>

          {!isTrial && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">CPF/CNPJ</label>
              <input
                type="text"
                value={cpfCnpj}
                onChange={(e) => setCpfCnpj(e.target.value)}
                required
                placeholder="Necessário para gerar a cobrança PIX"
                className="w-full px-4 py-2 border border-border rounded-xl bg-white text-foreground"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 btn-gradient font-medium py-2.5 disabled:opacity-50"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {submitting ? 'Criando conta...' : isTrial ? 'Começar teste grátis' : 'Criar conta e pagar'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function SignupPlanPage() {
  return (
    <Suspense fallback={null}>
      <SignupForm />
    </Suspense>
  );
}
