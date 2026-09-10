'use client';

import { useState, useEffect, Suspense } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Check, Loader2, Package, Users, ArrowLeft, Smartphone, Minus, Plus } from 'lucide-react';

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

const EXTRA_INSTANCE_PRICE_CENTS = 3990;

const STEPS = ['Escolha o plano', 'Seus dados', 'Pagamento'];

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {STEPS.slice(0, total).map((label, i) => (
        <div key={label} className="flex items-center">
          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-all duration-200 ${
              i < current
                ? 'gradient-brand text-white'
                : i === current
                ? 'bg-primary/10 text-primary border-2 border-primary'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            {i < current ? <Check className="w-3.5 h-3.5" /> : i + 1}
          </div>
          {i < total - 1 && (
            <div className={`w-8 h-0.5 mx-1 ${i < current ? 'bg-primary' : 'bg-border'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

function SignupForm() {
  const searchParams = useSearchParams();
  const isTrial = searchParams.get('trial') === '1';
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep] = useState(isTrial ? 1 : 0);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [extraInstances, setExtraInstances] = useState(0);
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

  const selectedPlan = plans.find((p) => p.id === selectedPlanId);
  const totalMonthlyCents = (selectedPlan?.price_cents || 0) + extraInstances * EXTRA_INSTANCE_PRICE_CENTS;

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
          extraInstances: isTrial ? 0 : extraInstances,
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

      setPaymentInfo({
        paymentUrl: result.paymentUrl,
        pixQrCode: result.pixQrCode,
        warning: result.warning,
      });
      setStep(2);
    } catch (err) {
      setError('Erro inesperado ao criar conta');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-8">
      <div
        className={`w-full bg-card border border-border rounded-2xl shadow-sm p-8 transition-[max-width] duration-200 ${
          step === 0 ? 'max-w-2xl' : 'max-w-lg'
        }`}
      >
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

        <StepIndicator current={step} total={isTrial ? 2 : 3} />

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Etapa 1 (só assinatura paga) — escolha do plano */}
        {step === 0 && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2.5">
              {plans.map((plan) => {
                const isRecommended = plan.name === 'Profissional';
                return (
                  <div
                    key={plan.id}
                    className={`relative h-full ${isRecommended ? 'plan-card-recommended' : ''}`}
                  >
                    {isRecommended && (
                      <span className="plan-card-recommended__badge">Recomendado</span>
                    )}
                    <button
                      type="button"
                      onClick={() => setSelectedPlanId(plan.id)}
                      className={`w-full h-full p-4 rounded-2xl border bg-card text-left transition-all duration-200 ${
                        selectedPlanId === plan.id
                          ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                          : 'border-border hover:border-primary/40'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-semibold text-foreground text-sm">{plan.name}</p>
                        {selectedPlanId === plan.id && <Check className="w-4 h-4 text-primary flex-shrink-0" />}
                      </div>
                      <p className="text-lg font-bold text-primary leading-tight">
                        {formatCents(plan.price_cents)}
                        <span className="text-xs font-normal text-muted-foreground">/mês</span>
                      </p>
                      <div className="mt-3 space-y-1.5">
                        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                          <Package className="w-3 h-3 flex-shrink-0 mt-0.5" /> até {plan.product_limit} produtos
                        </p>
                        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                          <Users className="w-3 h-3 flex-shrink-0 mt-0.5" /> até {plan.member_limit} usuários/atendentes
                        </p>
                        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                          <Smartphone className="w-3 h-3 flex-shrink-0 mt-0.5" /> 1 WhatsApp incluso
                        </p>
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="p-3 rounded-2xl border border-border bg-muted/50 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">Instâncias adicionais de WhatsApp</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Uma instância é 1 número de WhatsApp conectado ao Zaptrix. O plano já inclui 1 — adicione
                  mais só se atender por outros números (ex: vendas e suporte separados).
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setExtraInstances((n) => Math.max(0, n - 1))}
                  disabled={extraInstances === 0}
                  className="w-8 h-8 flex items-center justify-center border border-border rounded-lg text-foreground hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="w-5 text-center text-sm font-semibold text-foreground">{extraInstances}</span>
                <button
                  type="button"
                  onClick={() => setExtraInstances((n) => n + 1)}
                  className="w-8 h-8 flex items-center justify-center border border-border rounded-lg text-foreground hover:bg-white"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            {extraInstances > 0 && (
              <p className="text-xs text-muted-foreground px-1">
                + {formatCents(extraInstances * EXTRA_INSTANCE_PRICE_CENTS)}/mês ({extraInstances}{' '}
                instância{extraInstances > 1 ? 's' : ''} adicional{extraInstances > 1 ? 'is' : ''}) — total{' '}
                <strong className="text-foreground font-semibold">{formatCents(totalMonthlyCents)}/mês</strong>
              </p>
            )}

            <ul className="text-xs text-muted-foreground space-y-1 px-1">
              <li>• Atendimento via WhatsApp com IA, respondendo seus clientes automaticamente</li>
              <li>• Catálogo de produtos, base de conhecimento e Kanban de vendas</li>
              <li>• Cancele quando quiser — sem fidelidade</li>
            </ul>

            <button
              type="button"
              onClick={() => setStep(1)}
              disabled={!selectedPlanId}
              className="w-full btn-gradient font-medium py-2.5 disabled:opacity-50"
            >
              Continuar
            </button>
          </div>
        )}

        {/* Etapa 2 — cadastro */}
        {step === 1 && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isTrial && selectedPlan && (
              <div className="p-3 bg-primary/5 border border-primary/20 rounded-2xl mb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Plano escolhido</p>
                    <p className="text-sm font-semibold text-foreground">{selectedPlan.name}</p>
                  </div>
                  <p className="text-sm font-bold text-primary">
                    {formatCents(totalMonthlyCents)}
                    <span className="text-xs font-normal text-muted-foreground">/mês</span>
                  </p>
                </div>
                {extraInstances > 0 && (
                  <p className="text-xs text-muted-foreground mt-1.5 pt-1.5 border-t border-primary/10">
                    Inclui {extraInstances} instância{extraInstances > 1 ? 's' : ''} adicional
                    {extraInstances > 1 ? 'is' : ''} de WhatsApp ({formatCents(EXTRA_INSTANCE_PRICE_CENTS)}/mês
                    cada)
                  </p>
                )}
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

            <div className="flex items-center gap-3">
              {!isTrial && (
                <button
                  type="button"
                  onClick={() => setStep(0)}
                  className="flex items-center gap-1.5 px-4 py-2.5 border border-border text-foreground rounded-xl font-medium hover:bg-muted"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
              )}
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 flex items-center justify-center gap-2 btn-gradient font-medium py-2.5 disabled:opacity-50"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {submitting
                  ? 'Criando conta...'
                  : isTrial
                  ? 'Começar teste grátis'
                  : 'Criar conta e gerar cobrança'}
              </button>
            </div>
          </form>
        )}

        {/* Etapa 3 (só assinatura paga) — pagamento */}
        {step === 2 && paymentInfo && (
          <div className="text-center space-y-4">
            <p className="text-sm text-muted-foreground">
              {paymentInfo.warning || 'Conta criada! Escaneie o QR code para pagar com PIX.'}
            </p>

            {paymentInfo.pixQrCode && (
              <div className="flex justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`data:image/png;base64,${paymentInfo.pixQrCode}`}
                  alt="QR Code PIX"
                  className="w-48 h-48"
                />
              </div>
            )}

            {paymentInfo.paymentUrl && (
              <a
                href={paymentInfo.paymentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full btn-gradient font-medium py-2.5"
              >
                Abrir cobrança
              </a>
            )}

            <button
              onClick={() => router.push('/dashboard')}
              className="w-full px-6 py-2 border border-border text-foreground rounded-xl font-medium hover:bg-muted"
            >
              Já paguei / continuar
            </button>
          </div>
        )}
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
