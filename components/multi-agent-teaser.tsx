'use client';

import { Lock } from 'lucide-react';

/**
 * Convite pra contratar uma instância adicional de WhatsApp — mostrado no
 * lugar das abas de agente (Construtor de Agente, Base de Conhecimento,
 * Atendimento) quando o workspace só tem 1 número, pra quem nunca teria
 * outro jeito de descobrir que dá pra ter um agente/conhecimento por número.
 * É intencionalmente clicável (não só um aviso) — vira sinal de intenção de
 * compra.
 */
export function MultiAgentTeaser({ onClick, label }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mb-6 w-full flex items-center gap-3 p-4 rounded-2xl border border-dashed border-primary/30 bg-primary/5 text-left hover:bg-primary/10 transition-colors duration-150"
    >
      <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
        <Lock className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">
          {label || 'Quer um agente diferente para cada função (vendas, suporte, atendimento geral)?'}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Contrate uma instância adicional de WhatsApp (R$ 39,90/mês) — cada número pode ter seu próprio
          agente e sua própria base de conhecimento. Clique para contratar.
        </p>
      </div>
    </button>
  );
}
