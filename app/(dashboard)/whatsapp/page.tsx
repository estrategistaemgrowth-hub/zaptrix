export default function whatsappPage() {
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-foreground mb-2">WhatsApp</h1>
        <p className="text-muted-foreground mb-8">Gerenciar sua conta</p>
        <div className="bg-card border border-border rounded-lg p-12 text-center">
          <p className="text-muted-foreground">Nenhuma conexão ativa</p>
        </div>
      </div>
    </div>
  );
}
