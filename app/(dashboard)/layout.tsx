import { Sidebar } from '@/components/sidebar';
import { MobileBottomNav } from '@/components/mobile-bottom-nav';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-background gap-4 p-3 md:p-4">
      <Sidebar />
      {/* pb reserva espaço pra barra inferior fixa não cobrir o final do
       *  conteúdo em mobile — some em md, onde a MobileBottomNav não renderiza. */}
      <main className="flex-1 min-w-0 pb-20 md:pb-0">{children}</main>
      <MobileBottomNav />
    </div>
  );
}
