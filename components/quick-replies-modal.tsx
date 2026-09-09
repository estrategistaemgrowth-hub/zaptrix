'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Pencil, Trash2, Zap } from 'lucide-react';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface QuickReply {
  id: string;
  shortcut: string | null;
  title: string;
  content: string;
}

interface Props {
  supabase: SupabaseClient;
  workspaceId: string;
  quickReplies: QuickReply[];
  onClose: () => void;
  onChange: () => void;
}

/** Modal de gerenciar respostas rápidas (CRUD) — aberta a partir do link
 *  "Gerenciar respostas rápidas" dentro do popover de raio do composer
 *  (app/(dashboard)/atendimento/page.tsx). `position: fixed` via createPortal
 *  direto no body — wrapper com `transform` (ex: .animate-fade-in) quebra
 *  position:fixed simples, então o backdrop/modal aqui usam suas próprias
 *  classes de animação (.animate-backdrop-in / .animate-modal-in). */
export function QuickRepliesModal({ supabase, workspaceId, quickReplies, onClose, onChange }: Props) {
  const [mounted, setMounted] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [shortcut, setShortcut] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  function resetForm() {
    setEditingId(null);
    setShortcut('');
    setTitle('');
    setContent('');
  }

  function startEdit(reply: QuickReply) {
    setEditingId(reply.id);
    setShortcut(reply.shortcut || '');
    setTitle(reply.title);
    setContent(reply.content);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    setSaving(true);

    const payload = {
      workspace_id: workspaceId,
      shortcut: shortcut.trim() || null,
      title: title.trim(),
      content: content.trim(),
    };

    const { error } = editingId
      ? await supabase.from('quick_replies').update(payload).eq('id', editingId)
      : await supabase.from('quick_replies').insert([payload]);

    setSaving(false);

    if (error) {
      alert('Erro ao salvar resposta rápida: ' + error.message);
      return;
    }

    resetForm();
    onChange();
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir esta resposta rápida?')) return;

    const { error } = await supabase.from('quick_replies').delete().eq('id', id);

    if (error) {
      alert('Erro ao excluir resposta rápida: ' + error.message);
      return;
    }

    if (editingId === id) resetForm();
    onChange();
  }

  return createPortal(
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-backdrop-in">
      <div className="relative w-full max-w-lg max-h-[85vh] flex flex-col bg-card rounded-3xl shadow-2xl overflow-hidden animate-modal-in">
        <div className="p-5 border-b border-border bg-muted flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Respostas rápidas</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-card rounded-lg transition-colors duration-150"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-2">
          {quickReplies.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhuma resposta rápida cadastrada ainda.
            </p>
          ) : (
            quickReplies.map((reply) => (
              <div
                key={reply.id}
                className="p-3 border border-border rounded-xl flex items-start justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-foreground truncate">{reply.title}</p>
                    {reply.shortcut && (
                      <span className="text-xs text-primary bg-primary/10 rounded-full px-2 py-0.5 flex-shrink-0">
                        {reply.shortcut}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{reply.content}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => startEdit(reply)}
                    title="Editar"
                    className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors duration-150"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(reply.id)}
                    title="Excluir"
                    className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors duration-150"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <form onSubmit={handleSave} className="p-5 border-t border-border bg-muted space-y-3 flex-shrink-0">
          <p className="text-xs font-medium text-muted-foreground">
            {editingId ? 'Editando resposta rápida' : 'Nova resposta rápida'}
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Título (ex: Frete)"
              className="flex-1 px-3 py-2 border border-border rounded-lg bg-white text-sm text-foreground"
            />
            <input
              type="text"
              value={shortcut}
              onChange={(e) => setShortcut(e.target.value)}
              placeholder="/atalho (opcional)"
              className="w-36 px-3 py-2 border border-border rounded-lg bg-white text-sm text-foreground"
            />
          </div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Texto que será inserido no composer..."
            rows={3}
            className="w-full px-3 py-2 border border-border rounded-lg bg-white text-sm text-foreground resize-none"
          />
          <div className="flex items-center justify-end gap-2">
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
              >
                Cancelar edição
              </button>
            )}
            <button
              type="submit"
              disabled={saving || !title.trim() || !content.trim()}
              className="flex items-center gap-2 px-5 py-2 btn-gradient text-sm font-medium"
            >
              <Plus className="w-3.5 h-3.5" />
              {editingId ? 'Salvar alterações' : 'Adicionar'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
