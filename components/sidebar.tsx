'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  MessageCircle,
  Users,
  Package,
  BookOpen,
  Brain,
  MessageSquare,
  Settings,
  LogOut
} from 'lucide-react';

const links = [
  { href: '/dashboard', label: 'Dashboard', icon: MessageCircle },
  { href: '/atendimento', label: 'Atendimento', icon: MessageSquare },
  { href: '/contatos', label: 'Contatos', icon: Users },
  { href: '/produtos', label: 'Produtos', icon: Package },
  { href: '/conhecimento', label: 'Conhecimento', icon: BookOpen },
  { href: '/ia', label: 'IA', icon: Brain },
  { href: '/whatsapp', label: 'WhatsApp', icon: MessageCircle },
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
      className="w-full flex items-center gap-3 px-4 py-2 text-foreground hover:bg-muted rounded-md transition-colors text-sm disabled:opacity-50"
    >
      <LogOut className="w-4 h-4" />
      <span>{loading ? 'Saindo...' : 'Sair'}</span>
    </button>
  );
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-card border-r border-border min-h-screen fixed left-0 top-0 p-6 overflow-y-auto">
      <h1 className="text-xl font-bold text-primary mb-8">Zaptrix</h1>

      <nav className="space-y-2 mb-8">
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = pathname === link.href || pathname.startsWith(link.href);

          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-3 px-4 py-2 rounded-md transition-colors ${
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-foreground hover:bg-muted'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="text-sm font-medium">{link.label}</span>
            </Link>
          );
        })}
      </nav>

      <LogoutButton />
    </aside>
  );
}
