'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ensureWorkspace } from '@/lib/workspace';
import {
  LayoutDashboard,
  MessageSquare,
  Users,
  Package,
  MoreHorizontal,
  BookOpen,
  Brain,
  Settings,
} from 'lucide-react';

const PRIMARY_LINKS = [
  { href: '/dashboard', label: 'Início', icon: LayoutDashboard },
  { href: '/atendimento', label: 'Chat', icon: MessageSquare },
  { href: '/produtos', label: 'Produtos', icon: Package },
  { href: '/contatos', label: 'Contatos', icon: Users },
];

const MORE_LINKS = [
  { href: '/conhecimento', label: 'Conhecimento', icon: BookOpen },
  { href: '/ia', label: 'Provedor de IA', icon: Brain },
  { href: '/configuracoes', label: 'Configurações', icon: Settings },
];

/**
 * Navegação inferior estilo app mobile — some acima de md (a Sidebar normal
 * assume dali pra cima). Só os 4 destinos mais usados ficam fixos; o resto
 * (Conhecimento/IA/Configurações) entra no menu "Mais" pra não lotar a barra
 * (padrão comum de app mobile: no máximo 5 itens na barra inferior).
 */
export function MobileBottomNav() {
  const pathname = usePathname();
  const [showMore, setShowMore] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    async function loadUnread() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) return;

      const workspace = await ensureWorkspace(supabase, session.user.id, session.user.email);
      if (!workspace || cancelled) return;

      const { data } = await supabase
        .from('conversations')
        .select('unread_count')
        .eq('workspace_id', workspace.workspaceId)
        .eq('status', 'open');

      if (cancelled || !data) return;
      setUnreadCount(data.reduce((sum, c) => sum + (c.unread_count || 0), 0));
    }

    loadUnread();
    const interval = setInterval(loadUnread, 20000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const isMoreActive = MORE_LINKS.some((l) => pathname === l.href || pathname.startsWith(l.href + '/'));

  return (
    <>
      {showMore && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/20" onClick={() => setShowMore(false)} />
      )}

      {showMore && (
        <div className="md:hidden fixed bottom-[calc(4.25rem+env(safe-area-inset-bottom))] right-3 z-50 w-52 bg-card border border-border rounded-2xl shadow-lg overflow-hidden animate-fade-in">
          {MORE_LINKS.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href || pathname.startsWith(link.href + '/');
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setShowMore(false)}
                className={`flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors duration-150 ${
                  isActive ? 'text-primary bg-primary/5' : 'text-foreground hover:bg-muted'
                }`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {link.label}
              </Link>
            );
          })}
        </div>
      )}

      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border flex items-stretch pb-[env(safe-area-inset-bottom)]">
        {PRIMARY_LINKS.map((link) => {
          const Icon = link.icon;
          const isActive = pathname === link.href || pathname.startsWith(link.href + '/');
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors duration-150 ${
                isActive ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              <span className="relative">
                <Icon className="w-5 h-5" />
                {link.href === '/atendimento' && unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1.5 w-2 h-2 rounded-full bg-destructive ring-2 ring-card" />
                )}
              </span>
              {link.label}
            </Link>
          );
        })}
        <button
          onClick={() => setShowMore((v) => !v)}
          className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors duration-150 ${
            isMoreActive || showMore ? 'text-primary' : 'text-muted-foreground'
          }`}
        >
          <MoreHorizontal className="w-5 h-5" />
          Mais
        </button>
      </nav>
    </>
  );
}
