'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, ExternalLink, FileText, Loader2, QrCode, Upload, X } from 'lucide-react';

interface Invoice {
  id: string;
  amount_cents: number;
  due_date: string;
  status: 'pending' | 'paid' | 'overdue';
  file_url: string | null;
  downloadUrl: string | null;
  notes: string | null;
  created_at: string;
  asaas_payment_id: string | null;
  asaas_invoice_url: string | null;
  asaas_pix_qrcode: string | null;
}

interface Props {
  workspaceId: string;
  workspaceName: string;
  onClose: () => void;
}

const STATUS_LABEL: Record<Invoice['status'], string> = {
  pending: 'Pendente',
  paid: 'Paga',
  overdue: 'Vencida',
};

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1] || '');
    };
    reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
    reader.readAsDataURL(file);
  });
}

/**
 * Lista + upload de faturas de um workspace. Portal pra `document.body`,
 * mesmo padrão de whatsapp-qr-modal.tsx / product-detail-modal.tsx (evita o
 * bug de centralização do `.animate-fade-in` com `transform` no keyframe).
 */
export function InvoicesModal({ workspaceId, workspaceName, onClose }: Props) {
  const [mounted, setMounted] = useState(false);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ amount: '', dueDate: '', notes: '' });
  const [generateAsaasCharge, setGenerateAsaasCharge] = useState(false);
  const [cpfCnpj, setCpfCnpj] = useState('');
  const [asaasWarning, setAsaasWarning] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const loadInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/master/invoices?workspaceId=${workspaceId}`);
      const result = await res.json();
      setInvoices(result.invoices || []);
    } catch (err) {
      console.error('Erro ao carregar faturas:', err);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  async function handleUpload() {
    if (!form.amount || !form.dueDate) {
      setError('Informe valor e vencimento da fatura');
      return;
    }

    setUploading(true);
    setError('');
    setAsaasWarning('');

    try {
      const file = fileInputRef.current?.files?.[0];
      let base64: string | undefined;
      let fileName: string | undefined;
      let mimeType: string | undefined;

      if (file) {
        base64 = await fileToBase64(file);
        fileName = file.name;
        mimeType = file.type;
      }

      const res = await fetch('/api/master/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          amountCents: Math.round(parseFloat(form.amount) * 100),
          dueDate: form.dueDate,
          notes: form.notes || undefined,
          base64,
          fileName,
          mimeType,
          generateAsaasCharge,
          cpfCnpj: cpfCnpj || undefined,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        setError(result.error || 'Erro ao anexar fatura');
        return;
      }

      if (result.asaasWarning) setAsaasWarning(result.asaasWarning);

      setForm({ amount: '', dueDate: '', notes: '' });
      setCpfCnpj('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      loadInvoices();
    } catch (err) {
      setError('Erro inesperado ao anexar fatura');
    } finally {
      setUploading(false);
    }
  }

  async function handleStatusChange(invoiceId: string, status: Invoice['status']) {
    await fetch('/api/master/invoices', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invoiceId, status }),
    });
    loadInvoices();
  }

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 animate-backdrop-in">
      <div className="bg-card rounded-2xl shadow-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-modal-in">
        <div className="flex items-center justify-between p-6 border-b border-border sticky top-0 bg-card rounded-t-2xl">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Faturas</h2>
            <p className="text-sm text-muted-foreground">{workspaceName}</p>
          </div>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="p-4 bg-muted rounded-xl space-y-3">
            <p className="text-sm font-medium text-foreground">Anexar nova fatura</p>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Valor (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  className="w-full px-4 py-2 border border-border rounded-xl bg-white text-foreground"
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Vencimento</label>
                <input
                  type="date"
                  value={form.dueDate}
                  onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                  className="w-full px-4 py-2 border border-border rounded-xl bg-white text-foreground"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-muted-foreground mb-1">Observações</label>
              <input
                type="text"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full px-4 py-2 border border-border rounded-xl bg-white text-foreground"
                placeholder="opcional"
              />
            </div>

            <div>
              <label className="block text-xs text-muted-foreground mb-1">
                Arquivo (opcional — PDF/imagem anexado manualmente)
              </label>
              <input ref={fileInputRef} type="file" accept="application/pdf,image/*" className="text-sm" />
            </div>

            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={generateAsaasCharge}
                onChange={(e) => setGenerateAsaasCharge(e.target.checked)}
                className="w-4 h-4"
              />
              Gerar cobrança automática no Asaas (PIX com confirmação automática)
            </label>

            {generateAsaasCharge && (
              <div>
                <label className="block text-xs text-muted-foreground mb-1">
                  CPF/CNPJ do lojista (só na primeira cobrança)
                </label>
                <input
                  type="text"
                  value={cpfCnpj}
                  onChange={(e) => setCpfCnpj(e.target.value)}
                  className="w-full px-4 py-2 border border-border rounded-xl bg-white text-foreground"
                  placeholder="000.000.000-00"
                />
              </div>
            )}

            {asaasWarning && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                {asaasWarning}
              </div>
            )}

            <button
              type="button"
              onClick={handleUpload}
              disabled={uploading}
              className="flex items-center gap-2 px-4 py-2 btn-gradient text-sm font-medium disabled:opacity-50"
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {uploading ? 'Enviando...' : 'Anexar fatura'}
            </button>
          </div>

          <div>
            <p className="text-sm font-medium text-foreground mb-3">Histórico</p>
            {loading ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : invoices.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma fatura anexada ainda</p>
            ) : (
              <div className="space-y-2">
                {invoices.map((invoice) => (
                  <div
                    key={invoice.id}
                    className="flex items-center justify-between gap-3 p-3 border border-border rounded-xl"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <FileText className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">
                          R$ {(invoice.amount_cents / 100).toFixed(2)}{' '}
                          <span className="text-muted-foreground font-normal">
                            · vence {new Date(invoice.due_date).toLocaleDateString('pt-BR')}
                          </span>
                        </p>
                        {invoice.notes && (
                          <p className="text-xs text-muted-foreground truncate">{invoice.notes}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <select
                        value={invoice.status}
                        onChange={(e) => handleStatusChange(invoice.id, e.target.value as Invoice['status'])}
                        className="px-2 py-1 border border-border rounded-lg bg-white text-xs text-foreground"
                      >
                        {(Object.keys(STATUS_LABEL) as Invoice['status'][]).map((status) => (
                          <option key={status} value={status}>
                            {STATUS_LABEL[status]}
                          </option>
                        ))}
                      </select>

                      {invoice.asaas_invoice_url && (
                        <a
                          href={invoice.asaas_invoice_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 text-primary hover:bg-primary/10 rounded-lg"
                          title="Abrir cobrança no Asaas"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                      {invoice.asaas_pix_qrcode && (
                        <a
                          href={`data:image/png;base64,${invoice.asaas_pix_qrcode}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 text-primary hover:bg-primary/10 rounded-lg"
                          title="Ver QR code PIX"
                        >
                          <QrCode className="w-4 h-4" />
                        </a>
                      )}
                      {invoice.downloadUrl && (
                        <a
                          href={invoice.downloadUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 text-primary hover:bg-primary/10 rounded-lg"
                          title="Baixar fatura"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
