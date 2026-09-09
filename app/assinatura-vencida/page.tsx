'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Lock, RefreshCw } from 'lucide-react';

interface PendingInvoice {
  amount_cents: number;
  due_date: string;
  asaas_invoice_url: string | null;
  asaas_pix_qrcode: string | null;
  asaas_pix_payload: string | null;
}

export default function SubscriptionExpiredPage() {
  const router = useRouter();
  const supabase = createClient();
  const [invoice, setInvoice] = useState<PendingInvoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);

  async function load() {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) {
      setLoading(false);
      return;
    }

    const { data: membership } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', session.user.id)
      .limit(1)
      .maybeSingle();

    if (!membership) {
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from('invoices')
      .select('amount_cents, due_date, asaas_invoice_url, asaas_pix_qrcode, asaas_pix_payload')
      .eq('workspace_id', membership.workspace_id)
      .eq('status', 'pending')
      .order('due_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    setInvoice(data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCheckPayment() {
    setChecking(true);
    // O webhook do Asaas já atualiza o status sozinho — aqui só recarregamos
    // a página, o middleware decide se libera (subscription_expires_at futuro).
    router.refresh();
    window.location.href = '/dashboard';
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-8">
      <div className="max-w-md w-full bg-card border border-destructive/30 rounded-2xl shadow-sm p-10 text-center">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center">
            <Lock className="w-8 h-8 text-destructive" />
          </div>
        </div>

        <h1 className="text-xl font-bold text-foreground mb-2">Assinatura pendente</h1>
        <p className="text-muted-foreground text-sm mb-6">
          Seu acesso está bloqueado até a confirmação do pagamento. Assim que o PIX for identificado,
          o acesso libera automaticamente.
        </p>

        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : invoice ? (
          <div className="space-y-4 text-left">
            <p className="text-sm text-foreground">
              <span className="font-medium">Valor: </span>
              {(invoice.amount_cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </p>

            {invoice.asaas_pix_qrcode && (
              <div className="flex justify-center">
                <img
                  src={`data:image/png;base64,${invoice.asaas_pix_qrcode}`}
                  alt="QR Code PIX"
                  className="w-48 h-48"
                />
              </div>
            )}

            {invoice.asaas_invoice_url && (
              <a
                href={invoice.asaas_invoice_url}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full text-center btn-gradient font-medium py-2.5"
              >
                Pagar com PIX
              </a>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground mb-4">
            Nenhuma fatura pendente encontrada. Entre em contato com o suporte.
          </p>
        )}

        <button
          onClick={handleCheckPayment}
          disabled={checking}
          className="w-full flex items-center justify-center gap-2 mt-6 px-6 py-2 border border-border text-foreground rounded-xl font-medium hover:bg-muted transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
          Já paguei, verificar
        </button>

        <button
          onClick={handleLogout}
          className="w-full mt-2 px-6 py-2 text-sm text-muted-foreground hover:text-foreground"
        >
          Sair
        </button>
      </div>
    </div>
  );
}
