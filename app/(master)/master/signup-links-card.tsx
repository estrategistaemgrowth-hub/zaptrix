'use client';

import { useState } from 'react';
import { Check, Copy, Link2 } from 'lucide-react';

/**
 * Links evergreen de cadastro público — não precisam de "geração" (não há
 * token por link, é sempre a mesma URL): /assinar (paga, com seleção de
 * plano) e /assinar?trial=1 (teste grátis de 7 dias, sem cobrança).
 */
export function SignupLinksCard() {
  const [copied, setCopied] = useState<'paid' | 'trial' | null>(null);

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const paidUrl = `${baseUrl}/assinar`;
  const trialUrl = `${baseUrl}/assinar?trial=1`;

  function handleCopy(url: string, which: 'paid' | 'trial') {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(which);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  return (
    <div className="bg-card border border-border rounded-2xl p-6 mb-8">
      <div className="flex items-center gap-2 mb-4">
        <Link2 className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground">Links de cadastro</h2>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-3 p-3 bg-muted rounded-xl">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-foreground">Cadastro com pagamento</p>
            <p className="text-xs text-muted-foreground truncate">{paidUrl}</p>
          </div>
          <button
            onClick={() => handleCopy(paidUrl, 'paid')}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-xs font-medium bg-white hover:border-primary/40 hover:text-primary flex-shrink-0"
          >
            {copied === 'paid' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied === 'paid' ? 'Copiado' : 'Copiar'}
          </button>
        </div>

        <div className="flex items-center gap-3 p-3 bg-muted rounded-xl">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-foreground">Teste grátis (7 dias, sem cobrança)</p>
            <p className="text-xs text-muted-foreground truncate">{trialUrl}</p>
          </div>
          <button
            onClick={() => handleCopy(trialUrl, 'trial')}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-xs font-medium bg-white hover:border-primary/40 hover:text-primary flex-shrink-0"
          >
            {copied === 'trial' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied === 'trial' ? 'Copiado' : 'Copiar'}
          </button>
        </div>
      </div>
    </div>
  );
}
