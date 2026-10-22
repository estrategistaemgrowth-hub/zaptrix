'use client';

import Link from 'next/link';
import { useState } from 'react';
import { BIG_PLANS, SMALL_PLANS } from '@/lib/landing-plans';

const SMALL = SMALL_PLANS;
const BIG = BIG_PLANS;

const brl = (cents: number) => (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 });

const INCLUDED = ['IA respondendo no seu WhatsApp', 'Catálogo com foto e link de pagamento', 'Base de conhecimento e quadro de vendas'];

function Check({ light }: { light?: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden className="mt-0.5 flex-none">
      <circle cx="8" cy="8" r="8" className={light ? 'fill-white/20' : 'fill-[#2563eb]/10'} />
      <path d="M4.5 8.2l2.2 2.2 4.8-4.8" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={light ? 'stroke-white' : 'stroke-[#2563eb]'} />
    </svg>
  );
}

export function Pricing() {
  const [i, setI] = useState(0);
  const plan = SMALL[i];

  return (
    <div className="grid gap-5">
      {/* Plano por quantidade */}
      <div className="grid gap-6 rounded-[32px] border border-border bg-card p-5 sm:p-8 lg:grid-cols-[1.2fr_1fr] lg:items-center">
        <div>
          <span className="inline-block rounded-full bg-[#22d3ee]/15 px-3 py-1 text-xs font-semibold text-[#1d4ed8]">
            Pra quem está começando
          </span>
          <h3 className="mt-3 text-2xl font-bold">Essencial: você escolhe quantos produtos tem</h3>
          <p className="mt-2 text-muted-foreground">
            Até 50 produtos, você paga pelo tamanho do seu catálogo. Arraste e veja o valor.
          </p>
          <div className="mt-6">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-medium">Produtos no catálogo</span>
              <span className="text-sm font-semibold text-primary">até {plan.products}</span>
            </div>
            <input
              type="range"
              min={0}
              max={SMALL.length - 1}
              value={i}
              onChange={(e) => setI(Number(e.target.value))}
              aria-label="Quantidade de produtos"
              className="lp-range mt-3 w-full"
              style={{ '--p': `${(i / (SMALL.length - 1)) * 100}%` } as React.CSSProperties}
            />
            <div className="mt-2 flex justify-between text-xs text-muted-foreground">
              {SMALL.map((s, k) => (
                <button key={s.products} type="button" onClick={() => setI(k)} className={k === i ? 'font-semibold text-foreground' : ''}>
                  {s.products}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="rounded-3xl bg-background p-6">
          <p className="text-sm text-muted-foreground">Essencial {plan.products}</p>
          <p className="mt-1 flex items-baseline gap-1">
            <span className="text-sm font-semibold">R$</span>
            <span key={plan.cents} className="lp-price text-5xl font-bold tracking-tight">
              {brl(plan.cents)}
            </span>
            <span className="text-sm text-muted-foreground">/mês</span>
          </p>
          <ul className="mt-4 grid gap-2 text-sm">
            <li className="flex gap-2"><Check /> até {plan.products} produtos</li>
            <li className="flex gap-2"><Check /> 1 usuário · 1 WhatsApp incluso</li>
            {INCLUDED.map((t) => (
              <li key={t} className="flex gap-2"><Check /> {t}</li>
            ))}
          </ul>
          <Link href={`/assinar?produtos=${plan.products}`} className="btn-gradient mt-6 block py-3 text-center font-semibold">
            Assinar Essencial {plan.products}
          </Link>
        </div>
      </div>

      {/* Planos fixos */}
      <div className="lp-scroll -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 pt-3 md:mx-0 md:grid md:grid-cols-3 md:gap-5 md:overflow-visible md:px-0 md:pt-0">
        {BIG.map((p) => (
          <div
            key={p.name}
            className={`lp-lift relative flex w-[82%] flex-none snap-center flex-col rounded-[32px] p-6 md:w-auto ${
              p.featured ? 'banner-card-surface text-white md:-translate-y-3' : 'border border-border bg-card'
            }`}
          >
            {p.featured && (
              <span className="gradient-brand absolute right-5 top-5 rounded-full px-3 py-1 text-[11px] font-semibold text-white">
                Mais escolhido
              </span>
            )}
            <p className={`font-semibold ${p.featured ? 'text-white' : ''}`}>{p.name}</p>
            <p className="mt-3 flex items-baseline gap-1">
              <span className="text-sm font-semibold">R$</span>
              <span className="text-4xl font-bold tracking-tight">{brl(p.cents)}</span>
              <span className={`text-sm ${p.featured ? 'text-white/70' : 'text-muted-foreground'}`}>/mês</span>
            </p>
            <ul className={`mt-5 grid flex-1 gap-2 text-sm ${p.featured ? 'text-white/90' : ''}`}>
              <li className="flex gap-2"><Check light={p.featured} /> até {p.products} produtos</li>
              <li className="flex gap-2"><Check light={p.featured} /> até {p.users} usuários/atendentes</li>
              <li className="flex gap-2"><Check light={p.featured} /> 1 WhatsApp incluso</li>
              <li className="flex gap-2"><Check light={p.featured} /> rodízio de atendimento na equipe</li>
            </ul>
            <Link
              href="/assinar"
              className={`mt-6 block rounded-full py-3 text-center font-semibold ${
                p.featured ? 'bg-white text-[#0f2a5c] banner-cta' : 'border border-border hover:border-primary/50'
              }`}
            >
              Assinar {p.name}
            </Link>
          </div>
        ))}
      </div>
      <p className="text-center text-sm text-muted-foreground">
        Número extra de WhatsApp: R$ 39,90/mês cada. Sem fidelidade, cancele quando quiser.
      </p>
    </div>
  );
}
