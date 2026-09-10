'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface BuyInstanceResult {
  pixQrCode: string | null;
  paymentUrl: string | null;
  warning?: string | null;
}

interface BuyInstanceModalProps {
  open: boolean;
  onClose: () => void;
  /** Disparado quando a cobrança PIX é gerada (não quando é paga — isso só
   *  acontece via webhook do Asaas). Útil pra recarregar contadores de
   *  faturas na tela que abriu o modal. */
  onGenerated?: () => void;
}

/**
 * Modal de compra de instância adicional de WhatsApp (R$39,90/mês) —
 * autocontido: busca o CPF/CNPJ já cadastrado no workspace pra pré-preencher,
 * gera a cobrança PIX via /api/subscription/buy-whatsapp-instance e mostra o
 * QR code ali mesmo. Reaproveitável em qualquer tela (Configurações,
 * Construtor de Agente, Base de Conhecimento, Atendimento) sem duplicar
 * estado — cada chamador só controla `open`.
 */
export function BuyInstanceModal({ open, onClose, onGenerated }: BuyInstanceModalProps) {
  const [mounted, setMounted] = useState(false);
  const [cpfCnpj, setCpfCnpj] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<BuyInstanceResult | null>(null);
  const supabase = createClient();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    setError('');
    setResult(null);

    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) return;

      const { data: membership } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', session.user.id)
        .limit(1)
        .maybeSingle();
      if (!membership) return;

      const { data: workspace } = await supabase
        .from('workspaces')
        .select('cpf_cnpj')
        .eq('id', membership.workspace_id)
        .maybeSingle();

      setCpfCnpj(workspace?.cpf_cnpj || '');
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!mounted || !open) return null;

  async function handleSubmit() {
    if (!cpfCnpj.trim()) {
      setError('Informe o CPF/CNPJ para gerar a cobrança PIX.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/subscription/buy-whatsapp-instance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cpfCnpj: cpfCnpj.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Erro ao gerar cobrança');
        return;
      }

      setResult({
        pixQrCode: data.invoice?.asaas_pix_qrcode || null,
        paymentUrl: data.invoice?.asaas_invoice_url || null,
        warning: data.asaasWarning,
      });
      onGenerated?.();
    } catch (err) {
      setError('Erro inesperado ao gerar cobrança');
    } finally {
      setSubmitting(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 animate-backdrop-in">
      <div className="bg-card rounded-2xl shadow-lg w-full max-w-sm p-6 animate-modal-in">
        <h3 className="text-lg font-semibold text-foreground mb-1">Instância adicional de WhatsApp</h3>
        <p className="text-sm text-muted-foreground mb-5">
          R$ 39,90/mês, cobrado a cada 30 dias via PIX enquanto a instância estiver ativa.
        </p>

        {result ? (
          <div className="text-center space-y-3">
            <p className="text-sm text-muted-foreground">
              {result.warning || 'Cobrança gerada! Escaneie o QR code para pagar com PIX.'}
            </p>
            {result.pixQrCode && (
              <div className="flex justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`data:image/png;base64,${result.pixQrCode}`} alt="QR Code PIX" className="w-40 h-40" />
              </div>
            )}
            {result.paymentUrl && (
              <a
                href={result.paymentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full text-center btn-gradient font-medium py-2.5"
              >
                Pagar com PIX
              </a>
            )}
            <p className="text-xs text-muted-foreground">
              A instância extra é liberada automaticamente assim que o pagamento for confirmado — a próxima
              cobrança acontece em 30 dias, também por PIX.
            </p>
            <button type="button" onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground">
              Fechar
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
            )}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">CPF/CNPJ</label>
              <input
                type="text"
                value={cpfCnpj}
                onChange={(e) => setCpfCnpj(e.target.value)}
                placeholder="Necessário para gerar a cobrança PIX"
                autoFocus
                className="w-full px-4 py-2 border border-border rounded-xl bg-white text-foreground"
              />
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 flex items-center justify-center gap-2 btn-gradient font-medium py-2.5 disabled:opacity-50"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {submitting ? 'Gerando cobrança...' : 'Gerar cobrança PIX'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 border border-border text-foreground rounded-xl font-medium hover:bg-background"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
