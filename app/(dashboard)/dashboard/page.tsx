'use client';

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-foreground mb-2">Dashboard</h1>
        <p className="text-muted-foreground mb-8">Bem-vindo ao Zaptrix — automação de vendas com IA via WhatsApp</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-card border border-border rounded-lg p-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Conversas ativas</h3>
            <p className="text-3xl font-bold text-foreground">0</p>
          </div>

          <div className="bg-card border border-border rounded-lg p-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Contatos</h3>
            <p className="text-3xl font-bold text-foreground">0</p>
          </div>

          <div className="bg-card border border-border rounded-lg p-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Mensagens hoje</h3>
            <p className="text-3xl font-bold text-foreground">0</p>
          </div>
        </div>

        <div className="mt-8 bg-card border border-border rounded-lg p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Próximos passos</h2>
          <ul className="space-y-2 text-muted-foreground">
            <li>• Configurar conexão WhatsApp</li>
            <li>• Cadastrar produtos no catálogo</li>
            <li>• Configurar perfil de IA</li>
            <li>• Importar base de conhecimento</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
