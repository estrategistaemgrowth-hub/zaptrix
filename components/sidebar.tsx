'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ensureWorkspace } from '@/lib/workspace';
import {
  LayoutDashboard,
  MessageSquare,
  Users,
  Package,
  BookOpen,
  Brain,
  Settings,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';

const links = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, ownerAdminOnly: false },
  { href: '/atendimento', label: 'Atendimento', icon: MessageSquare, ownerAdminOnly: false },
  { href: '/contatos', label: 'Contatos', icon: Users, ownerAdminOnly: false },
  { href: '/produtos', label: 'Produtos', icon: Package, ownerAdminOnly: false },
  { href: '/conhecimento', label: 'Conhecimento', icon: BookOpen, ownerAdminOnly: false },
  { href: '/ia', label: 'IA', icon: Brain, ownerAdminOnly: true },
  { href: '/configuracoes', label: 'Configurações', icon: Settings, ownerAdminOnly: true },
];

const STORAGE_KEY = 'zaptrix-sidebar-collapsed';

function LogoutButton({ collapsed }: { collapsed: boolean }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleLogout() {
    setLoading(true);
    await supabase.auth.signOut();
    router.push('/login');
  }

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      title="Sair"
      className={`w-full flex items-center gap-3 px-4 py-2.5 text-muted-foreground hover:bg-muted hover:text-foreground rounded-xl transition-all duration-200 text-sm disabled:opacity-50 ${
        collapsed ? 'justify-center px-0' : ''
      }`}
    >
      <LogOut className="w-4 h-4 flex-shrink-0" />
      {!collapsed && <span>{loading ? 'Saindo...' : 'Sair'}</span>}
    </button>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [aiHandlingCount, setAiHandlingCount] = useState(0);
  const [isOwnerOrAdmin, setIsOwnerOrAdmin] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === '1') setCollapsed(true);
    setMounted(true);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    async function loadCounters() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) return;

      const workspace = await ensureWorkspace(supabase, session.user.id, session.user.email);
      if (!workspace || cancelled) return;

      setIsOwnerOrAdmin(workspace.role === 'owner' || workspace.role === 'admin');

      const { data } = await supabase
        .from('conversations')
        .select('unread_count, ai_enabled')
        .eq('workspace_id', workspace.workspaceId)
        .eq('status', 'open');

      if (cancelled || !data) return;

      setUnreadCount(data.reduce((sum, c) => sum + (c.unread_count || 0), 0));
      setAiHandlingCount(data.filter((c) => c.ai_enabled).length);
    }

    loadCounters();
    const interval = setInterval(loadCounters, 20000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
  }

  return (
    <aside
      className={`hidden md:flex shrink-0 sticky top-4 self-start bg-card border border-border rounded-2xl shadow-sm h-[calc(100vh-2rem)] flex-col p-4 transition-[width] duration-200 ${
        collapsed ? 'w-20' : 'w-64'
      } ${mounted ? '' : 'invisible'}`}
    >
      <div className={`flex items-center mb-6 ${collapsed ? 'justify-center px-0' : 'justify-between px-2'} py-2`}>
        {collapsed ? (
          <Image src="/zaptrix-icon.png" alt="Zaptrix" width={32} height={32} priority />
        ) : (
          <Image src="/zaptrix-logo-light.png" alt="Zaptrix" width={150} height={48} priority />
        )}
        {!collapsed && (
          <button
            onClick={toggleCollapsed}
            title="Ocultar menu"
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg flex-shrink-0"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        )}
      </div>

      {collapsed && (
        <button
          onClick={toggleCollapsed}
          title="Mostrar menu"
          className="flex items-center justify-center gap-2 mb-3 pb-3 mx-1 border-b border-border text-primary hover:bg-primary/10 rounded-lg py-2"
        >
          <PanelLeftOpen className="w-5 h-5" />
        </button>
      )}

      <nav className="flex-1 space-y-1 overflow-y-auto">
        {links
          .filter((link) => !link.ownerAdminOnly || isOwnerOrAdmin)
          .map((link) => {
          const Icon = link.icon;
          const isActive = pathname === link.href || pathname.startsWith(link.href + '/');
          const isAtendimento = link.href === '/atendimento';

          return (
            <Link
              key={link.href}
              href={link.href}
              title={collapsed ? link.label : undefined}
              className={`group relative flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 ${
                collapsed ? 'justify-center px-0' : ''
              } ${
                isActive
                  ? 'bg-primary text-white font-medium shadow-sm'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <span className="relative flex-shrink-0">
                <Icon className="w-4 h-4 transition-transform duration-200 group-hover:scale-110" />
                {isAtendimento && unreadCount > 0 && (
                  <span
                    title={`${unreadCount} mensagem(ns) não lida(s)`}
                    className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-destructive ring-2 ring-card animate-pulse"
                  />
                )}
              </span>
              {!collapsed && <span className="text-sm">{link.label}</span>}
              {!collapsed && isAtendimento && aiHandlingCount > 0 && (
                <span
                  title={`${aiHandlingCount} conversa(s) sendo atendida(s) pela IA`}
                  className={`ml-auto flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full text-[11px] font-medium ${
                    isActive ? 'bg-white/20 text-white' : 'gradient-brand text-white'
                  }`}
                >
                  {aiHandlingCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="pt-3 mt-3 border-t border-border">
        <LogoutButton collapsed={collapsed} />
      </div>
    </aside>
  );
}
