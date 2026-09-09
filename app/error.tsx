'use client';

import { useEffect } from 'react';
import Image from 'next/image';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Erro não tratado na aplicação:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-8">
      <div className="max-w-md w-full text-center">
        <div className="flex justify-center mb-6">
          <Image src="/zaptrix-logo-light.png" alt="Zaptrix" width={150} height={48} priority />
        </div>

        <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertTriangle className="w-8 h-8 text-destructive" />
        </div>

        <h1 className="text-xl font-bold text-foreground mb-2">Algo deu errado</h1>
        <p className="text-muted-foreground text-sm mb-8">
          Ocorreu um erro inesperado. Tente novamente — se continuar acontecendo, entre em contato com o suporte.
        </p>

        <button
          onClick={reset}
          className="inline-flex items-center gap-2 btn-gradient font-medium px-6 py-2.5"
        >
          <RefreshCw className="w-4 h-4" />
          Tentar novamente
        </button>
      </div>
    </div>
  );
}
