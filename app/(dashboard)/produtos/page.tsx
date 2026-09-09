export default function produtosPage() {
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-foreground mb-2">Produtos</h1>
        <p className="text-muted-foreground mb-8">Gerenciar sua conta</p>
        <div className="bg-card border border-border rounded-lg p-12 text-center">
          <p className="text-muted-foreground">Nenhum produto cadastrado</p>
        </div>
      </div>
    </div>
  );
}
