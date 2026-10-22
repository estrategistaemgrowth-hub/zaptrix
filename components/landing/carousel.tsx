'use client';

import { Children, useEffect, useRef, useState } from 'react';

const GAP = 16;

// Celular: um card por vez (largura cheia, sem "pontinha" do próximo), com bolinhas,
// setas e troca automática até a pessoa interagir. md+: vira a grade normal (`grid`).
export function Carousel({ children, grid, spans = [] }: { children: React.ReactNode; grid: string; spans?: string[] }) {
  const items = Children.toArray(children);
  const ref = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const touched = useRef(false);

  const go = (i: number) => {
    const el = ref.current;
    if (!el) return;
    const n = (i + items.length) % items.length;
    el.scrollTo({ left: n * (el.clientWidth + GAP), behavior: 'smooth' });
  };

  useEffect(() => {
    const mobile = window.matchMedia('(max-width: 767px)').matches;
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!mobile || calm) return;
    const id = setInterval(() => {
      const el = ref.current;
      if (touched.current || !el) return;
      // só anda quando o carrossel está na tela
      const r = el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight) return;
      go(Math.round(el.scrollLeft / (el.clientWidth + GAP)) + 1);
    }, 5000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stop = () => {
    touched.current = true;
  };

  return (
    // min-w-0: dentro de grid/flex o scroller não pode crescer até a soma dos cards
    <div className="min-w-0">
      <div
        ref={ref}
        onScroll={(e) => setIndex(Math.round(e.currentTarget.scrollLeft / (e.currentTarget.clientWidth + GAP)))}
        onTouchStart={stop}
        onPointerDown={stop}
        className={`lp-scroll flex snap-x snap-mandatory gap-4 overflow-x-auto md:grid md:overflow-visible ${grid}`}
      >
        {items.map((child, i) => (
          <div key={i} className={`w-full flex-none snap-center [&>*]:h-full md:w-auto ${spans[i] ?? ''}`}>
            {child}
          </div>
        ))}
      </div>

      <div className="mt-5 flex items-center justify-center gap-4 md:hidden">
        <button
          type="button"
          aria-label="Anterior"
          onClick={() => {
            stop();
            go(index - 1);
          }}
          className="grid h-10 w-10 place-items-center rounded-full border border-border bg-card text-foreground"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden><path d="M10 3L5 8l5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <div className="flex items-center gap-1.5">
          {items.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Ir para o card ${i + 1}`}
              onClick={() => {
                stop();
                go(i);
              }}
              className={`h-2 rounded-full transition-all duration-300 ${i === index ? 'w-6 bg-primary' : 'w-2 bg-border'}`}
            />
          ))}
        </div>
        <button
          type="button"
          aria-label="Próximo"
          onClick={() => {
            stop();
            go(index + 1);
          }}
          className="grid h-10 w-10 place-items-center rounded-full border border-border bg-card text-foreground"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden><path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      </div>
    </div>
  );
}
