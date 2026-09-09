'use client';

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-md">
        <div className="bg-card rounded-lg shadow-lg p-8">
          <h1 className="text-2xl font-bold text-foreground mb-2">Zaptrix</h1>
          <p className="text-muted-foreground mb-8">Automação de vendas & atendimento via WhatsApp com IA</p>

          <form className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Email
              </label>
              <input
                type="email"
                placeholder="seu@email.com"
                className="w-full px-4 py-2 rounded-md border border-border bg-input text-foreground placeholder:text-muted-foreground"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Senha
              </label>
              <input
                type="password"
                placeholder="••••••••"
                className="w-full px-4 py-2 rounded-md border border-border bg-input text-foreground placeholder:text-muted-foreground"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2 bg-primary text-primary-foreground rounded-md font-medium hover:opacity-90 transition-opacity"
            >
              Entrar
            </button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Não tem conta? <a href="/signup" className="text-primary hover:underline">Criar conta</a>
          </p>
        </div>
      </div>
    </div>
  );
}
