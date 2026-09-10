'use client';

import { useEffect } from 'react';

/** Registra o service worker mínimo (public/sw.js) — condição pro Chrome
 *  considerar o app instalável ("Adicionar à tela inicial"). Best-effort:
 *  navegadores sem suporte (ou HTTP local) simplesmente ignoram. */
export function PwaRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // best-effort — não impede o app de funcionar sem PWA
      });
    }
  }, []);

  return null;
}
