'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Check, Loader2, Package, Users } from 'lucide-react';

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

interface SubscribeResult {
  pixQrCode: string | null;
  paymentUrl: string | null;
  warning?: string | null;
}

/**
 * Seletor de plano + geração de cobrança PIX para o próprio lojista já
 * logado (chama /api/subscription/upgrade) — usado tanto em "Minha
 * Assinatura" (upgrade voluntário) quanto em /assinatura-vencida (teste
 * grátis expirado sem fatura nenhuma, que antes ficava sem saída própria).
 */
export function PlanPicker({ onSubscribed }: { onSubscribed: (result: SubscribeResult) => void }) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [cpfCnpj, setCpfCnpj] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from('plans')
      .select('id, name, price_cents, product_limit, member_limit')
      .order('price_cents', { ascending: true })
      .then(({ data }) => {
        setPlans(data || []);
        if (data && data.length > 0) setSelectedPlanId(data[0].id);
      });
  }, []);

  async function handleSubscribe() {
    if (!selectedPlanId) {
      setError('Selecione um plano.');
      return;
    }
    if (!cpfCnpj.trim()) {
      setError('Informe o CPF/CNPJ para gerar a cobrança PIX.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/subscription/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: selectedPlanId, cpfCnpj: cpfCnpj.trim() }),
      });

      const result = await res.json();

      if (!res.ok) {
        setError(result.error || 'Erro ao gerar cobrança');
        return;
      }

      onSubscribed({
        pixQrCode: result.invoice?.asaas_pix_qrcode || null,
        paymentUrl: result.invoice?.asaas_invoice_url || null,
        warning: result.asaasWarning,
      });
    } catch (err) {
      console.error('Erro ao assinar plano:', err);
      setError('Erro inesperado ao gerar cobrança');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4 text-left">
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
              {selectedPlanId === plan.id && <Check className="w-4 h-4 text-primary flex-shrink-0" />}
            </div>
            <p className="text-lg font-bold text-primary leading-tight">
              {formatCents(plan.price_cents)}
              <span className="text-xs font-normal text-muted-foreground">/mês</span>
            </p>
            <div className="mt-3 space-y-1.5">
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Package className="w-3 h-3 flex-shrink-0" /> até {plan.product_limit} produtos
              </p>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Users className="w-3 h-3 flex-shrink-0" /> até {plan.member_limit} usuários/atendentes
              </p>
            </div>
          </button>
        ))}
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-2">CPF/CNPJ</label>
        <input
          type="text"
          value={cpfCnpj}
          onChange={(e) => setCpfCnpj(e.target.value)}
          placeholder="Necessário para gerar a cobrança PIX"
          className="w-full px-4 py-2 border border-border rounded-xl bg-white text-foreground"
        />
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}

      <button
        type="button"
        onClick={handleSubscribe}
        disabled={submitting || !selectedPlanId}
        className="w-full flex items-center justify-center gap-2 btn-gradient font-medium py-2.5 disabled:opacity-50"
      >
        {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
        {submitting ? 'Gerando cobrança...' : 'Assinar e gerar cobrança PIX'}
      </button>
    </div>
  );
}
