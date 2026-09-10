/**
 * Ranking de relevância por sobreposição de termos (TF-like, sem embeddings)
 * — a técnica de recuperação mais simples do repositório RAG_Techniques
 * (github.com/NirDiamant/RAG_Techniques), adotada aqui em vez de busca
 * vetorial porque embeddings de verdade exigiriam uma API de embeddings
 * (OpenAI/Gemini) independente do provedor de chat que o lojista configurou
 * — Anthropic e Groq não têm endpoint de embeddings, então a base ficaria
 * quebrada pra quem usa esses provedores. Isso roda 100% local, sem custo
 * e sem dependência de provedor.
 */
const STOPWORDS_PT = new Set([
  'o', 'a', 'os', 'as', 'de', 'da', 'do', 'das', 'dos', 'em', 'no', 'na', 'nos', 'nas',
  'um', 'uma', 'uns', 'umas', 'e', 'ou', 'que', 'pra', 'para', 'por', 'com', 'sem', 'se',
  'como', 'mais', 'muito', 'tem', 'ter', 'eu', 'voce', 'meu', 'minha', 'seu', 'sua',
  'esse', 'essa', 'este', 'esta', 'isso', 'aqui', 'ai', 'ali', 'la', 'oi', 'ola', 'bom',
  'boa', 'dia', 'tarde', 'noite', 'obrigado', 'obrigada', 'por favor', 'gostaria', 'queria',
  'quero', 'voces', 'vcs', 'vc', 'ok', 'blz', 'sim', 'nao', 'ja', 'so', 'ate', 'quando',
  'onde', 'qual', 'quais', 'porque', 'pq', 'entao', 'ne', 'tudo', 'bem', 'ta', 'to',
]);

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

export function tokenize(text: string): string[] {
  return normalize(text)
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOPWORDS_PT.has(t));
}

/** Conta quantos tokens da query aparecem no texto candidato (sem embeddings). */
export function scoreOverlap(queryTokens: string[], candidateText: string): number {
  if (queryTokens.length === 0) return 0;
  const candidateTokens = new Set(tokenize(candidateText));
  let score = 0;
  for (const t of queryTokens) {
    if (candidateTokens.has(t)) score += 1;
  }
  return score;
}
