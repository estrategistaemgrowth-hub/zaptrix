# Product

## Register

product

## Users

Lojistas de e-commerce (donos de loja online, pequeno/médio porte) que usam o Zaptrix para automatizar atendimento e vendas via WhatsApp com IA. Usam o dashboard no dia a dia para monitorar conversas, produtos, contatos e configurar o comportamento do agente de IA. Contexto: gestão operacional entre outras tarefas do negócio, não é o foco principal do dia — precisa ser rápido de ler e de confiança.

## Product Purpose

SaaS de atendimento/vendas via WhatsApp com IA para lojistas de e-commerce. O dashboard existe para que o lojista configure o agente de IA, acompanhe conversas e contatos, gerencie o catálogo de produtos e monitore limites de uso/mensagens. Sucesso = o lojista confia que a IA está vendendo bem e consegue ajustar rápido quando algo precisa mudar.

## Brand Personality

Futurista, confiante, tecnológico — mas ainda um dashboard sério de operação (não um produto de consumo lúdico). O dono do produto pediu explicitamente mais presença do degradê azul da marca (`#22d3ee` → `#3b82f6` → `#1d4ed8`) e uma sensação mais "futurista" nos componentes, inspirada estruturalmente (não cromaticamente) em um design system de referência chamado "clickmax" — pílulas de CTA em degradê, cards de cota/progresso com barra em degradê, card de banner escuro-azulado de destaque, hover mais vivo em cards.

## Anti-references

- Paleta lima/verde-neon do "clickmax" (referência é só de ESTRUTURA de componente, nunca de cor).
- Roxo como cor de marca — a marca é azul (ciano → azul → azul-royal).
- Dashboard dark-mode como padrão geral de tela — o fundo é claro; cards escuros (banner de destaque) são exceção pontual, nunca a regra.
- Preto puro em sombra/glow de hover — usar sempre a cor da marca (azul) em opacidade baixa.

## Design Principles

1. Um único sistema de gradiente de marca reutilizado (não inventar paletas paralelas) — sempre os tokens já existentes em `app/globals.css` (`--primary`, `.gradient-brand`, `.btn-gradient`).
2. Feedback visual de progresso/limite (cota de uso, limite de mensagens) sempre com barra visual em degradê, nunca só texto puro.
3. Hover com vida (glow sutil na cor da marca + leve scale) em vez de hover neutro/plano, mas sem exagero — o produto é uma ferramenta de trabalho, não uma peça de campanha.
4. Toda animação nova respeita `prefers-reduced-motion` (convenção já estabelecida no projeto).
5. Qualquer modal/dropdown/tooltip novo com `position: fixed` usa `createPortal(..., document.body)` — bug já resolvido no projeto com wrappers `animate-fade-in` que usam `transform`.

## Accessibility & Inclusion

Sem requisito formal de WCAG declarado pelo dono do produto. Manter contraste de texto em cards e badges, e garantir que toda animação decorativa tenha alternativa via `prefers-reduced-motion` (padrão já em uso no projeto).
