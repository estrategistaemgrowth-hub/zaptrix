// Espelha a tabela `plans` (migração 0042 + planos já existentes) pra LP e o JSON-LD
// não dependerem do banco. ponytail: preço mudou no master → mudar aqui também.
export const SITE_URL = 'https://zaptrix.agenciamavi.com.br';

export const SMALL_PLANS = [
  { products: 20, cents: 2990 },
  { products: 30, cents: 3690 },
  { products: 40, cents: 4390 },
  { products: 50, cents: 5090 },
];

export const BIG_PLANS = [
  { name: 'Start', cents: 6990, products: 100, users: 3 },
  { name: 'Profissional', cents: 9790, products: 500, users: 5, featured: true },
  { name: 'Enterprise', cents: 15000, products: 1000, users: 10 },
];

export const EXTRA_WHATSAPP_CENTS = 3990;
