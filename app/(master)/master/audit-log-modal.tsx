'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { SkeletonRow } from '@/components/skeleton';

interface LogEntry {
  id: string;
  action: string;
  details: Record<string, unknown> | null;
  created_at: string;
  workspaceName: string | null;
  adminEmail: string | null;
}

const ACTION_LABELS: Record<string, string> = {
  workspace_created: 'Criou lojista',
  workspace_updated: 'Atualizou lojista',
  invoice_created: 'Criou fatura',
  invoice_updated: 'Atualizou status de fatura',
};

export function AuditLogModal({ onClose }: { onClose: () => void }) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/master/audit-log')
      .then((res) => res.json())
      .then((result) => setLogs(result.logs || []))
      .catch((err) => console.error('Erro ao carregar log de auditoria:', err))
      .finally(() => setLoading(false));
  }, []);

  return createPortal(
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 animate-backdrop-in">
      <div className="bg-card rounded-2xl shadow-lg w-full max-w-2xl animate-modal-in max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-semibold text-foreground">Log de auditoria</h2>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-2">
          {loading ? (
            <>
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </>
          ) : logs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma ação registrada ainda</p>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="p-3 border border-border rounded-xl text-sm">
                <div className="flex items-center justify-between gap-4">
                  <p className="font-medium text-foreground">
                    {ACTION_LABELS[log.action] || log.action}
                    {log.workspaceName && <span className="text-muted-foreground"> — {log.workspaceName}</span>}
                  </p>
                  <p className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString('pt-BR')}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{log.adminEmail || 'admin'}</p>
                {log.details && Object.keys(log.details).length > 0 && (
                  <p className="text-xs text-muted-foreground mt-1 font-mono break-all">
                    {JSON.stringify(log.details)}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
