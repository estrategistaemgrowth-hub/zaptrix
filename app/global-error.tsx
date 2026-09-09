'use client';

import { useEffect } from 'react';
import './globals.css';

/**
 * Fallback pra erro dentro do próprio root layout (raro — o error.tsx normal
 * cobre o resto da árvore). Precisa renderizar <html>/<body> porque substitui
 * o layout inteiro quando ativado.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Erro crítico na aplicação:', error);
  }, [error]);

  return (
    <html lang="pt-BR" data-theme="light">
      <body className="min-h-screen flex items-center justify-center bg-background p-8">
        <div className="max-w-md w-full text-center">
          <h1 className="text-xl font-bold text-foreground mb-2">Algo deu errado</h1>
          <p className="text-muted-foreground text-sm mb-8">
            Ocorreu um erro inesperado ao carregar o Zaptrix. Tente novamente.
          </p>
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 btn-gradient font-medium px-6 py-2.5"
          >
            Tentar novamente
          </button>
        </div>
      </body>
    </html>
  );
}
