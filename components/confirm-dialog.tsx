'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle } from 'lucide-react';

export interface ConfirmState {
  title?: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
}

/**
 * Substitui o `window.confirm()` nativo (popup feio do navegador, com o
 * domínio do site escrito em cima) por um modal no estilo do resto do app.
 * Portal pra `document.body` — mesmo padrão de whatsapp-qr-modal.tsx (evita o
 * bug de centralização de `position: fixed` dentro de `.animate-fade-in`).
 *
 * Uso: `const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);`
 * no componente da página, dispara com `setConfirmState({ message, onConfirm })`
 * e renderiza `<ConfirmDialog state={confirmState} onClose={() => setConfirmState(null)} />`.
 */
export function ConfirmDialog({
  state,
  onClose,
}: {
  state: ConfirmState | null;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !state) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 animate-backdrop-in">
      <div className="bg-card rounded-2xl shadow-lg w-full max-w-sm p-6 animate-modal-in">
        <div className="flex items-start gap-3 mb-4">
          <div
            className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
              state.danger ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div className="min-w-0 pt-1">
            {state.title && <p className="font-semibold text-foreground mb-1">{state.title}</p>}
            <p className="text-sm text-muted-foreground">{state.message}</p>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => {
              state.onConfirm();
              onClose();
            }}
            className={`flex-1 px-4 py-2 rounded-xl font-medium text-sm text-white transition-colors duration-150 ${
              state.danger ? 'bg-destructive hover:opacity-90' : 'btn-gradient'
            }`}
          >
            {state.confirmLabel || 'Confirmar'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-border text-foreground rounded-xl font-medium text-sm hover:bg-muted"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
