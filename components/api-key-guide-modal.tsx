'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ExternalLink, Check } from 'lucide-react';
import { PROVIDER_LABELS, PROVIDER_INFO, AiProvider } from '@/lib/ai-models';

const TAG_STYLES: Record<string, string> = {
  free: 'bg-success/10 text-success',
  'free-tier': 'bg-amber-100 text-amber-700',
  paid: 'bg-muted text-muted-foreground',
};

/**
 * Guia "como conseguir a API key" dos 4 provedores suportados — pedido
 * explícito do usuário: ensinar de onde tirar a chave e mostrar quem tem
 * cota gratuita. Portal pra document.body: mesmo motivo dos outros modais
 * do projeto (transform no keyframe de .animate-fade-in quebra
 * position:fixed quando o modal nasce dentro desse wrapper).
 */
export function ApiKeyGuideModal({ onClose }: { onClose: () => void }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 animate-backdrop-in">
      <div className="bg-card rounded-2xl shadow-lg w-full max-w-2xl max-h-[85vh] overflow-y-auto animate-modal-in">
        <div className="flex items-center justify-between p-6 border-b border-border sticky top-0 bg-card rounded-t-2xl">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Como conseguir uma API key</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Escolha um provedor, crie a chave no site oficial e cole em &quot;Adicionar credencial&quot;.
            </p>
          </div>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground flex-shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {(Object.keys(PROVIDER_LABELS) as AiProvider[]).map((provider) => {
            const info = PROVIDER_INFO[provider];
            return (
              <div key={provider} className="border border-border rounded-xl p-4">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <h3 className="font-semibold text-foreground">{PROVIDER_LABELS[provider]}</h3>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${TAG_STYLES[info.tag]}`}>
                    {info.tagLabel}
                  </span>
                </div>

                <p className="text-sm text-muted-foreground mb-3">{info.note}</p>

                <ol className="space-y-1.5 mb-3">
                  {info.steps.map((step, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center mt-0.5">
                        {i + 1}
                      </span>
                      {step}
                    </li>
                  ))}
                </ol>

                <a
                  href={info.keysUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                >
                  Abrir site e criar chave
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            );
          })}

          <p className="text-xs text-muted-foreground flex items-start gap-1.5 pt-1">
            <Check className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            Preços e cotas gratuitas mudam com o tempo — o valor exato e atualizado está sempre na página oficial de cada provedor.
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
}
