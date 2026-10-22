'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

// Barra fixa só no celular: aparece quando o CTA do topo (#hero-cta) sai da tela.
export function MobileCta() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const target = document.getElementById('hero-cta');
    if (!target) return;
    const io = new IntersectionObserver(([e]) => setShow(!e.isIntersecting && e.boundingClientRect.top < 0));
    io.observe(target);
    return () => io.disconnect();
  }, []);

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card/95 px-4 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3 backdrop-blur transition-transform duration-300 md:hidden ${
        show ? 'translate-y-0' : 'translate-y-full'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1 leading-tight">
          <p className="text-sm font-semibold">7 dias grátis</p>
          <p className="text-xs text-muted-foreground">sem cartão de crédito</p>
        </div>
        <Link href="/assinar?trial=1" className="btn-gradient px-5 py-3 text-sm font-semibold">
          Começar agora
        </Link>
      </div>
    </div>
  );
}
