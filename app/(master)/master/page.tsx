'use client';

export default function MasterAdminPage() {
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Painel Master</h1>
            <p className="text-muted-foreground">Gerenciar lojistas e acessos da plataforma</p>
          </div>
          <button className="px-6 py-2 bg-primary text-primary-foreground rounded-md font-medium hover:opacity-90">
            Novo lojista
          </button>
        </div>

        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-6 py-4 text-left text-sm font-medium text-foreground">Lojista</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-foreground">Email</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-foreground">Status</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-foreground">Data</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-foreground">Ações</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border hover:bg-muted">
                  <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">
                    Nenhum lojista cadastrado ainda
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
