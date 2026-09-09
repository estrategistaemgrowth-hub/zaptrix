/**
 * O PostgREST (Supabase) corta silenciosamente em 1000 linhas por padrão —
 * sem esse helper, uma tabela sem limite de plano (ex: contacts) ou perto do
 * teto do plano (ex: products, até 1000 no Enterprise) arriscava sumir
 * registro da tela sem nenhum aviso. Pagina via `.range()` até esgotar.
 *
 * `buildQuery` deve refazer a query do zero a cada chamada (nunca reaproveitar
 * um builder já resolvido) — por isso recebe `from`/`to` e devolve uma nova
 * chamada encadeada a partir de `supabase.from(...)`.
 */
export async function fetchAllRows<T>(
  buildQuery: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  pageSize = 1000
): Promise<{ data: T[]; error: unknown }> {
  let all: T[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await buildQuery(from, from + pageSize - 1);

    if (error) {
      return { data: all, error };
    }

    all = all.concat(data || []);

    if (!data || data.length < pageSize) break;
    from += pageSize;
  }

  return { data: all, error: null };
}
