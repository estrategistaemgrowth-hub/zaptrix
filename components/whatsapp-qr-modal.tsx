'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { QrCode, X } from 'lucide-react';

interface Props {
  qrCode: string;
  onClose: () => void;
}

export function WhatsappQrModal({ qrCode, onClose }: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-backdrop-in">
      <div className="relative w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl animate-modal-in">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg z-10"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="gradient-brand px-8 pt-8 pb-14 text-center">
          <div className="w-14 h-14 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
            <QrCode className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-lg font-semibold text-white mb-1.5">Conectar WhatsApp</h2>
          <p className="text-sm text-white/80 leading-relaxed">
            Abra o WhatsApp no celular, toque em <strong>Aparelhos conectados</strong> →{' '}
            <strong>Conectar um aparelho</strong> e escaneie o código abaixo
          </p>
        </div>

        <div className="bg-card -mt-8 mx-4 rounded-2xl p-6 relative z-[1] shadow-lg flex flex-col items-center">
          <div className="relative w-56 h-56">
            <div
              className="absolute inset-0 rounded-[28px] animate-spin-slow"
              style={{
                background:
                  'conic-gradient(from 0deg, #22d3ee, #3b82f6, #1d4ed8, #3b82f6, #22d3ee)',
              }}
            />
            <div className="absolute inset-[4px] rounded-[24px] bg-white flex items-center justify-center overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrCode} alt="QR Code WhatsApp" className="w-[86%] h-[86%]" />
              <div
                className="absolute left-0 right-0 h-10 animate-qr-scan pointer-events-none"
                style={{
                  background:
                    'linear-gradient(to bottom, transparent, rgba(37,99,235,0.35), transparent)',
                }}
              />
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 mt-6 py-3 px-4 rounded-xl bg-muted text-sm text-muted-foreground w-full">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
            </span>
            Aguardando conexão...
          </div>
        </div>

        <div className="h-6 bg-card" />
      </div>
    </div>,
    document.body
  );
}
