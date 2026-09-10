'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, ChevronUp, StickyNote, Paperclip, Brain, FileText, X } from 'lucide-react';

interface PanelMessage {
  id: string;
  is_internal_note?: boolean | null;
  content: string | null;
  message_type?: string | null;
  media_url?: string | null;
  media_caption?: string | null;
  created_at: string;
}

interface Props {
  contactName: string;
  phone: string | null;
  statusLabel: string;
  statusDotClass: string;
  assignedLabel: string | null;
  aiMemory: string | null;
  messages: PanelMessage[];
  onClose: () => void;
}

function CollapsibleSection({
  title,
  icon: Icon,
  count,
  defaultOpen = false,
  children,
}: {
  title: string;
  icon: typeof Brain;
  count?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-border last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-muted/50 transition-colors duration-150"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Icon className="w-4 h-4 text-primary flex-shrink-0" />
          {title}
          {count !== undefined && count > 0 && (
            <span className="w-5 h-5 flex items-center justify-center bg-muted text-muted-foreground text-[11px] font-medium rounded-full">
              {count}
            </span>
          )}
        </span>
        {open ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        )}
      </button>
      {open && <div className="px-5 pb-4 space-y-2">{children}</div>}
    </div>
  );
}

/**
 * Painel de contexto da conversa — drawer que desliza por CIMA da tela (não
 * uma coluna fixa no flex) de propósito: o modo Kanban já reserva pouco
 * espaço horizontal pro chat (w-96), então virar uma 3ª coluna espremeria
 * tudo e recriaria o mesmo problema de layout cortando conteúdo. Fechado,
 * só o ícone de abrir fica visível no cabeçalho do chat.
 *
 * Estrutura modelada a partir de referência (lista | chat | painel de
 * contexto colapsável) com o design system do próprio Zaptrix (gradiente
 * azul, não a paleta da referência) e dados reais do produto — sem seção
 * copiada sem equivalente real (ex: "Shared Links"/"Documentations" da
 * referência viraram Memória da IA + Arquivos compartilhados, que já
 * existem no banco).
 */
export function ConversationInfoPanel({
  contactName,
  phone,
  statusLabel,
  statusDotClass,
  assignedLabel,
  aiMemory,
  messages,
  onClose,
}: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const notes = messages.filter((m) => m.is_internal_note);
  const files = messages.filter((m) => m.message_type && m.message_type !== 'text' && m.media_url);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/20 animate-backdrop-in" onClick={onClose} />

      <div className="relative w-80 max-w-[85vw] h-full bg-card border-l border-border shadow-lg flex flex-col overflow-hidden animate-modal-in">
        <div className="p-5 border-b border-border flex-shrink-0">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground">Informações gerais</h3>
            <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground flex-shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-11 h-11 rounded-full gradient-brand text-white flex items-center justify-center font-semibold flex-shrink-0">
              {contactName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-foreground truncate">{contactName}</p>
              {phone && <p className="text-xs text-muted-foreground">{phone}</p>}
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Status</span>
              <span className="flex items-center gap-1.5 font-medium text-foreground">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${statusDotClass}`} />
                {statusLabel}
              </span>
            </div>
            {assignedLabel && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Atribuído a</span>
                <span className="font-medium text-foreground">{assignedLabel}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {aiMemory && (
            <CollapsibleSection title="Memória da IA" icon={Brain} defaultOpen>
              <p className="text-xs text-foreground/80 whitespace-pre-line break-words leading-relaxed">
                {aiMemory}
              </p>
            </CollapsibleSection>
          )}

          <CollapsibleSection title="Notas internas" icon={StickyNote} count={notes.length} defaultOpen={!aiMemory}>
            {notes.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhuma nota ainda.</p>
            ) : (
              notes.map((n) => (
                <div key={n.id} className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-xs text-foreground whitespace-pre-wrap break-words">{n.content}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {new Date(n.created_at).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              ))
            )}
          </CollapsibleSection>

          <CollapsibleSection title="Arquivos compartilhados" icon={Paperclip} count={files.length}>
            {files.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhum arquivo ainda.</p>
            ) : (
              files.map((f) => (
                <a
                  key={f.id}
                  href={f.media_url || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 p-2 border border-border rounded-lg hover:bg-muted transition-colors duration-150 text-xs text-foreground min-w-0"
                >
                  <FileText className="w-3.5 h-3.5 flex-shrink-0 text-primary" />
                  <span className="truncate">{f.media_caption || f.message_type}</span>
                </a>
              ))
            )}
          </CollapsibleSection>
        </div>
      </div>
    </div>,
    document.body
  );
}
