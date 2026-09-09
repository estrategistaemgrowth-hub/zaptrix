'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  LayoutDashboard,
  MessageSquare,
  Users,
  Package,
  BookOpen,
  Brain,
  Smartphone,
  Settings,
  LogOut,
  Zap,
} from 'lucide-react';

const links = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/atendimento', label: 'Atendimento', icon: MessageSquare },
  { href: '/contatos', label: 'Contatos', icon: Users },
  { href: '/produtos', label: 'Produtos', icon: Package },
  { href: '/conhecimento', label: 'Conhecimento', icon: BookOpen },
  { href: '/ia', label: 'IA', icon: Brain },
  { href: '/whatsapp', label: 'WhatsApp', icon: Smartphone },
  { href: '/configuracoes', label: 'Configurações', icon: Settings },
];

function LogoutButton() {
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
      className="w-full flex items-center gap-3 px-4 py-2.5 text-muted-foreground hover:bg-muted hover:text-foreground rounded-xl transition-colors text-sm disabled:opacity-50"
    >
      <LogOut className="w-4 h-4" />
      <span>{loading ? 'Saindo...' : 'Sair'}</span>
    </button>
  );
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 shrink-0 sticky top-4 self-start bg-card border border-border rounded-2xl shadow-sm h-[calc(100vh-2rem)] flex flex-col p-4">
      <div className="flex items-center gap-2 px-2 py-2 mb-6">
        <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center flex-shrink-0">
          <Zap className="w-5 h-5 text-white" fill="currentColor" />
        </div>
        <span className="text-lg font-bold text-foreground">Zaptrix</span>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto">
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = pathname === link.href || pathname.startsWith(link.href + '/');

          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-colors ${
                isActive
                  ? 'bg-primary text-white font-medium shadow-sm'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm">{link.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="pt-3 mt-3 border-t border-border">
        <LogoutButton />
      </div>
    </aside>
  );
}
