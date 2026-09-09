export default function OnboardingPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-8">
      <div className="max-w-2xl w-full">
        <div className="bg-card border border-border rounded-lg p-12 text-center">
          <h1 className="text-3xl font-bold text-foreground mb-4">Bem-vindo ao Zaptrix!</h1>
          <p className="text-muted-foreground mb-8">Vamos configurar sua conta em poucos passos.</p>

          <div className="space-y-6">
            <div className="bg-muted/50 rounded-lg p-6 text-left">
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold">
                  1
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Dados da empresa</h3>
                  <p className="text-sm text-muted-foreground">Nome, segmento, site</p>
                </div>
              </div>
            </div>

            <div className="bg-muted/50 rounded-lg p-6 text-left opacity-50">
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-muted text-muted-foreground rounded-full flex items-center justify-center font-bold">
                  2
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Integrar WhatsApp</h3>
                  <p className="text-sm text-muted-foreground">Conecte sua conta da Evolution API</p>
                </div>
              </div>
            </div>

            <div className="bg-muted/50 rounded-lg p-6 text-left opacity-50">
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-muted text-muted-foreground rounded-full flex items-center justify-center font-bold">
                  3
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Configurar IA</h3>
                  <p className="text-sm text-muted-foreground">Personalize o agente de atendimento</p>
                </div>
              </div>
            </div>

            <div className="bg-muted/50 rounded-lg p-6 text-left opacity-50">
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-muted text-muted-foreground rounded-full flex items-center justify-center font-bold">
                  4
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Base de conhecimento</h3>
                  <p className="text-sm text-muted-foreground">Treinar a IA com seus produtos</p>
                </div>
              </div>
            </div>

            <div className="bg-muted/50 rounded-lg p-6 text-left opacity-50">
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-muted text-muted-foreground rounded-full flex items-center justify-center font-bold">
                  5
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Convidar usuários</h3>
                  <p className="text-sm text-muted-foreground">Adicione admin e atendentes</p>
                </div>
              </div>
            </div>
          </div>

          <button className="mt-12 px-8 py-3 bg-primary text-primary-foreground rounded-md font-medium hover:opacity-90">
            Começar agora
          </button>
        </div>
      </div>
    </div>
  );
}
