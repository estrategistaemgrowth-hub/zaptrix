'use client';

import { useEffect, useRef } from 'react';

// Liga .is-in quando o bloco entra na tela (uma vez só); a animação em si é CSS (.lp-reveal em globals.css).
export function Reveal({ children, className = '', ...rest }: React.HTMLAttributes<HTMLElement>) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('is-in');
          io.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section ref={ref} className={`lp-reveal ${className}`} {...rest}>
      {children}
    </section>
  );
}
