/* eslint-disable @next/next/no-img-element -- fotos dos mockups vêm do Unsplash, sem next/image */
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Reveal } from '@/components/reveal';
import { ChatDemo } from '@/components/landing/chat-demo';
import { Pricing } from '@/components/landing/pricing';

export const metadata: Metadata = {
  title: 'Zaptrix — seu catálogo vendendo no WhatsApp com IA',
  description:
    'Cadastre seus produtos com o link de pagamento e deixe a IA do Zaptrix atender, mandar foto, tirar dúvida e fechar a venda no WhatsApp. Teste grátis por 7 dias.',
};

const IMG = (id: string, w = 480) => `https://images.unsplash.com/${id}?w=${w}&q=70&auto=format&fit=crop`;
const SHOE = IMG('photo-1542291026-7eec264c27ff');
const SELLER = IMG('photo-1556742049-0cfed4f6a45d', 1100);
const OWNER = IMG('photo-1573497019940-1c28c88b4f3e', 120);
const WATCH = IMG('photo-1523275335684-37898b6baf30', 200);
const CAP = IMG('photo-1585386959984-a4155224a1ad', 200);

const HERO_BG: React.CSSProperties = {
  background:
    'radial-gradient(circle at 12% 8%, rgba(34,211,238,.28), transparent 42%), radial-gradient(circle at 88% 22%, rgba(59,130,246,.24), transparent 46%), linear-gradient(180deg, #ffffff 0%, var(--background) 100%)',
};

/* ---------- Peças pequenas ---------- */

function Pill({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-medium text-foreground shadow-sm ${className}`}>
      {children}
    </span>
  );
}

function SectionTitle({ kicker, title, sub }: { kicker: string; title: string; sub?: string }) {
  return (
    <div className="mx-auto grid max-w-2xl justify-items-center gap-3 text-center">
      <Pill>
        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
        {kicker}
      </Pill>
      <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-[42px] sm:leading-[1.1]">{title}</h2>
      {sub && <p className="text-pretty text-muted-foreground sm:text-lg">{sub}</p>}
    </div>
  );
}

function Float({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  return (
    <div className={`lp-bob absolute z-20 hidden sm:block rounded-2xl border border-border bg-card/95 px-3.5 py-2.5 shadow-[0_18px_40px_-18px_rgba(29,78,216,0.45)] backdrop-blur ${className}`} style={{ animationDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

function Frame({ url, children }: { url: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_24px_50px_-28px_rgba(37,99,235,0.45)]">
      <div className="flex items-center gap-1.5 border-b border-border bg-background px-3 py-2">
        <span className="h-2 w-2 rounded-full bg-[#f87171]" />
        <span className="h-2 w-2 rounded-full bg-[#fbbf24]" />
        <span className="h-2 w-2 rounded-full bg-[#34d399]" />
        <span className="ml-2 truncate text-[10px] text-muted-foreground">{url}</span>
      </div>
      {children}
    </div>
  );
}

/* ---------- Mockups animados ---------- */

function ProductFormMock() {
  return (
    <Frame url="zaptrix.agenciamavi.com.br/produtos">
      <div className="grid grid-cols-[84px_1fr] gap-3 p-3">
        <img src={SHOE} alt="" className="h-full w-full rounded-[12px] object-cover" />
        <div className="grid min-w-0 gap-2 text-[11px]">
          <div className="truncate rounded-[8px] border border-border px-2 py-1.5">Runner Classic Vermelho</div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-[8px] border border-border px-2 py-1.5 text-muted-foreground line-through">399,90</div>
            <div className="rounded-[8px] border border-border px-2 py-1.5 font-semibold">329,90</div>
          </div>
          <div className="min-w-0">
            <p className="mb-1 font-medium">Link de compra</p>
            <div className="flex overflow-hidden rounded-[8px] border-2 border-primary bg-primary/5 px-2 py-1.5 text-primary">
              <span className="lp-type">pay.lojaaurora.com.br/runner-39</span>
              <span className="lp-caret">|</span>
            </div>
          </div>
        </div>
      </div>
    </Frame>
  );
}

// Padrão fixo do QR ilustrativo (pseudo-aleatório, mas igual em todo render).
const QR_BITS = Array.from({ length: 21 * 21 }, (_, i) => ((i * 7919) % 13) % 3 === 0);
const inFinder = (x: number, y: number) => (x < 8 && y < 8) || (x > 12 && y < 8) || (x < 8 && y > 12);

function QrMock() {
  return (
    <div className="mx-auto w-[190px] rounded-2xl border border-border bg-card p-4 text-center shadow-[0_24px_50px_-28px_rgba(37,99,235,0.45)]">
      <div className="relative mx-auto h-28 w-28 overflow-hidden rounded-[12px] bg-white p-2">
        <svg viewBox="0 0 21 21" className="h-full w-full" aria-hidden shapeRendering="crispEdges">
          {[[0, 0], [14, 0], [0, 14]].map(([x, y]) => (
            <g key={`${x}-${y}`} fill="#0a1730">
              <rect x={x} y={y} width="7" height="7" />
              <rect x={x + 1} y={y + 1} width="5" height="5" fill="#fff" />
              <rect x={x + 2} y={y + 2} width="3" height="3" />
            </g>
          ))}
          {QR_BITS.map((on, i) => {
            const x = i % 21;
            const y = Math.floor(i / 21);
            return on && !inFinder(x, y) ? <rect key={i} x={x} y={y} width="1" height="1" fill="#0a1730" /> : null;
          })}
        </svg>
        <span className="animate-qr-scan absolute inset-x-0 top-0 h-0.5 bg-[#22d3ee] shadow-[0_0_12px_#22d3ee]" />
      </div>
      <p className="mt-3 text-[12px] font-semibold">Leia o QR Code</p>
      <p className="text-[11px] text-muted-foreground">no WhatsApp do seu celular</p>
    </div>
  );
}

function KanbanMock() {
  const col = (t: string, dot: string) => (
    <p className="mb-2 flex items-center gap-1.5 truncate text-[11px] font-semibold">
      <span className={`h-1.5 w-1.5 flex-none rounded-full ${dot}`} />
      {t}
    </p>
  );
  const card = (n: string, m: string, green?: boolean) => (
    <div className="mt-2 rounded-[12px] border border-border bg-card p-2">
      <p className="truncate text-[11px] font-semibold">{n}</p>
      <p className={`truncate text-[10px] ${green ? 'font-semibold text-[#0c7a3a]' : 'text-muted-foreground'}`}>{m}</p>
    </div>
  );
  return (
    <Frame url="zaptrix.agenciamavi.com.br/atendimento">
      <div className="relative grid grid-cols-3 gap-2.5 bg-background p-3">
        <div className="min-w-0">
          {col('Atendendo', 'bg-primary')}
          <div className="h-[62px]" />
          {card('Rafael Lima', 'Tem a versão preta?')}
        </div>
        <div className="min-w-0">
          {col('Com humano', 'bg-[#9b5a00]')}
          <div className="h-[62px]" />
          {card('Cláudia Reis', 'Quero trocar o tamanho')}
        </div>
        <div className="min-w-0">
          {col('Ganho', 'bg-[#0c7a3a]')}
          <div className="h-[62px]" />
          {card('Pedro Alves', 'R$ 189,00', true)}
        </div>
        {/* card que anda pelas colunas até Ganho */}
        <div className="pointer-events-none absolute left-3 top-[36px] w-[calc((100%-26px)/3-1px)]">
          <div className="lp-kanban rounded-[12px] border-2 border-primary bg-card p-2 shadow-[0_10px_24px_-12px_rgba(37,99,235,0.6)]">
            <p className="truncate text-[11px] font-semibold">Marina Souza</p>
            <p className="truncate text-[10px] text-muted-foreground">Pronto, paguei!</p>
            <p className="mt-0.5 text-[10px] font-semibold text-primary">R$ 329,90</p>
          </div>
        </div>
      </div>
    </Frame>
  );
}

function AudioMock() {
  return (
    <div className="grid gap-2">
      <div className="ml-auto flex w-fit items-center gap-2 rounded-2xl rounded-br-[6px] bg-[#d9fdd3] px-3 py-2">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-[#0c7a3a] text-white">
          <svg width="9" height="11" viewBox="0 0 10 12" aria-hidden><path d="M0 0l10 6-10 6z" fill="currentColor" /></svg>
        </span>
        <span className="flex h-6 items-center gap-[3px]">
          {[8, 14, 22, 12, 18, 24, 10, 20, 14, 22, 9, 16, 12, 18].map((h, i) => (
            <i key={i} className="lp-wave block w-[3px] rounded-full bg-[#55616a]" style={{ height: h, animationDelay: `${i * 60}ms` }} />
          ))}
        </span>
        <span className="text-[11px] text-[#667781]">0:12</span>
      </div>
      <div className="w-fit max-w-[92%] rounded-2xl rounded-bl-[6px] bg-card px-3 py-2 text-[12px] shadow-sm">
        <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-primary">Áudio transcrito</span>
        “Vocês entregam em Campinas até sexta?”
      </div>
      <div className="w-fit max-w-[92%] rounded-2xl rounded-bl-[6px] bg-card px-3 py-2 text-[12px] shadow-sm">
        Entregamos sim! Pedido feito até quarta chega na sexta.
      </div>
    </div>
  );
}

function RolesMock() {
  const roles = [
    ['Vendas', 'Apresenta produtos e conduz até o fechamento'],
    ['Suporte', 'Resolve dúvidas, pedidos e trocas'],
    ['Atendimento Geral', 'Tira dúvidas e direciona o cliente'],
    ['Pós-venda', 'Acompanha e oferece novos produtos'],
  ];
  return (
    <div className="grid grid-cols-2 gap-2">
      {roles.map(([t, d], i) => (
        <div key={t} className={`rounded-[12px] bg-card p-2.5 ${i === 0 ? 'border-2 border-primary' : 'border border-border'}`}>
          <p className="text-[12px] font-semibold">{t}</p>
          <p className="mt-0.5 text-[10.5px] leading-snug text-muted-foreground">{d}</p>
        </div>
      ))}
    </div>
  );
}

function HandoffMock() {
  return (
    <div className="grid gap-2 text-[12px]">
      <div className="ml-auto w-fit rounded-2xl rounded-br-[6px] bg-[#d9fdd3] px-3 py-2">Quero falar com uma pessoa</div>
      <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2">
        <img src={OWNER} alt="" className="h-7 w-7 rounded-full object-cover" />
        <span>
          <b>Ana</b> assumiu a conversa
          <span className="block text-[10.5px] text-muted-foreground">Transferida pela IA · rodízio da equipe</span>
        </span>
      </div>
    </div>
  );
}

/* ---------- Conteúdo ---------- */

const PLATFORMS = ['Tray', 'Nuvemshop', 'Shopify', 'Mercado Pago', 'PagSeguro', 'InfinitePay', 'Link do banco'];

const FAQ = [
  ['Preciso ter loja virtual?', 'Não. Basta ter um link de pagamento pra cada produto: pode ser do Mercado Pago, PagSeguro, do seu banco ou o checkout da loja que você já usa.'],
  ['Meu número de WhatsApp muda?', 'Não. Você conecta o seu próprio número lendo um QR Code no painel, e os clientes continuam falando com o mesmo contato de sempre.'],
  ['A IA pode inventar preço ou produto?', 'Ela responde a partir do seu catálogo e da sua base de conhecimento, e cada resposta passa por uma conferência antes de ser enviada. Quando não dá pra resolver, ela passa a conversa pra sua equipe.'],
  ['E se o cliente quiser falar com uma pessoa?', 'Você define em que situações a IA transfere a conversa. A transferência entra no rodízio entre os atendentes, e você responde pelo próprio painel.'],
  ['Tenho muitos produtos. Preciso cadastrar um por um?', 'Não. Dá pra importar uma planilha CSV, inclusive o arquivo de exportação padrão da Tray.'],
  ['Como funciona o teste grátis?', 'São 7 dias sem cartão de crédito. Você cria a conta, cadastra os produtos e conecta o WhatsApp. Depois escolhe o plano, sem fidelidade.'],
];

export default function Home() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      {/* Navegação */}
      <header className="sticky top-3 z-40 px-3">
        <div className="mx-auto flex max-w-6xl items-center justify-between rounded-full border border-border bg-card/85 py-2 pl-5 pr-2 shadow-[0_10px_30px_-20px_rgba(29,78,216,0.5)] backdrop-blur">
          <Image src="/zaptrix-logo-light.png" alt="Zaptrix" width={108} height={35} priority />
          <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
            <a href="#como-funciona" className="hover:text-foreground">Como funciona</a>
            <a href="#recursos" className="hover:text-foreground">Recursos</a>
            <a href="#precos" className="hover:text-foreground">Preços</a>
            <a href="#duvidas" className="hover:text-foreground">Dúvidas</a>
          </nav>
          <div className="flex items-center gap-1">
            <Link href="/login" className="rounded-full px-3 py-2 text-sm font-medium hover:bg-background sm:px-4">Entrar</Link>
            <Link href="/assinar?trial=1" className="btn-gradient px-4 py-2 text-sm font-semibold sm:px-5">Testar grátis</Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <Reveal className="px-3 pt-4">
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[40px] px-4 pt-14 sm:px-10 sm:pt-20" style={HERO_BG}>
          <div className="mx-auto grid max-w-3xl justify-items-center gap-5 text-center">
            <Pill>
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#0c7a3a]" />
              Teste grátis por 7 dias, sem cartão
            </Pill>
            <h1 className="text-balance text-[40px] font-bold leading-[1.05] tracking-tight sm:text-[64px]">
              Seu catálogo vendendo no WhatsApp, <span className="text-primary">até de madrugada.</span>
            </h1>
            <p className="max-w-[58ch] text-pretty text-muted-foreground sm:text-lg">
              Cadastre o produto com foto, preço e o link de pagamento. A IA do Zaptrix responde no seu número, mostra a foto,
              confere o estoque e manda o link na hora em que o cliente decide comprar.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link href="/assinar?trial=1" className="btn-gradient px-7 py-3.5 font-semibold">Começar teste grátis</Link>
              <a href="#precos" className="rounded-full border border-border bg-card px-6 py-3.5 font-semibold hover:border-primary/50">Ver preços</a>
            </div>
          </div>

          <div className="relative mx-auto mt-14 h-[560px] max-w-5xl">
            <div className="absolute left-0 top-20 hidden w-[340px] -rotate-3 lg:block">
              <KanbanMock />
            </div>
            <div className="absolute right-0 top-48 hidden w-[260px] rotate-2 lg:block">
              <ProductFormMock />
            </div>
            <div className="relative z-10 mx-auto w-fit">
              <ChatDemo height={470} />
            </div>
            <Float className="sm:left-0 sm:top-0 lg:left-[6%] lg:top-0" delay={0}>
              <p className="text-[11px] text-muted-foreground">Cliente respondido às</p>
              <p className="text-sm font-semibold">21h47 de um domingo</p>
            </Float>
            <Float className="sm:right-0 sm:top-[420px] lg:right-[18%] lg:top-[440px]" delay={1200}>
              <p className="flex items-center gap-2 text-sm font-semibold">
                <span className="h-2 w-2 rounded-full bg-[#0c7a3a]" />
                Link de pagamento enviado
              </p>
            </Float>
          </div>
        </div>
      </Reveal>

      {/* Plataformas */}
      <Reveal className="mx-auto max-w-6xl px-4 pt-20 text-center">
        <p className="text-sm text-muted-foreground">Funciona com o link de pagamento de onde você já vende</p>
        <div className="mt-5 flex flex-wrap justify-center gap-x-9 gap-y-3 text-lg font-bold text-foreground/35 sm:text-xl">
          {PLATFORMS.map((p) => (
            <span key={p}>{p}</span>
          ))}
        </div>
      </Reveal>

      {/* Como funciona */}
      <section id="como-funciona" className="mx-auto max-w-6xl scroll-mt-24 px-4 pt-28">
        <Reveal>
          <SectionTitle kicker="Como funciona" title="Três passos e o seu WhatsApp começa a vender" sub="Sem programador e sem instalar nada no celular." />
        </Reveal>
        <Reveal className="mt-12 grid gap-5 md:grid-cols-3">
          {[
            { n: '1', t: 'Cadastre o produto e cole o link', d: 'Foto, preço, promoção, variações, estoque e o link onde o cliente paga.', bg: 'bg-[#2563eb]/[0.07]', mock: <ProductFormMock /> },
            { n: '2', t: 'Conecte o seu número', d: 'Leia o QR Code no painel. Os clientes continuam falando com o contato de sempre.', bg: 'bg-[#22d3ee]/[0.12]', mock: <QrMock /> },
            { n: '3', t: 'A IA atende e manda o link', d: 'Entende texto e áudio, responde com foto e preço e envia o link quando o cliente decide.', bg: 'bg-[#7dd3fc]/[0.22]', mock: <AudioMock /> },
          ].map((s) => (
            <div key={s.n} className={`lp-lift flex flex-col gap-6 rounded-[32px] p-6 ${s.bg}`}>
              <div className="grid flex-1 content-center">{s.mock}</div>
              <div>
                <span className="grid h-8 w-8 place-items-center rounded-full bg-card text-sm font-bold text-primary shadow-sm">{s.n}</span>
                <h3 className="mt-3 text-lg font-semibold">{s.t}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{s.d}</p>
              </div>
            </div>
          ))}
        </Reveal>
      </section>

      {/* Lado humano */}
      <section className="mx-auto max-w-6xl px-4 pt-28">
        <Reveal className="grid items-center gap-14 lg:grid-cols-2">
          <div className="relative">
            <img src={SELLER} alt="Lojista atendendo uma cliente que paga pelo celular" className="aspect-[4/3.4] w-full rounded-[32px] object-cover" />
            <Float className="-bottom-6 left-3 sm:left-8" delay={400}>
              <div className="flex items-center gap-2.5">
                <img src={OWNER} alt="" className="h-9 w-9 rounded-full object-cover" />
                <div>
                  <p className="text-[11px] text-muted-foreground">Enquanto você atende no balcão</p>
                  <p className="text-sm font-semibold">a IA segue respondendo no WhatsApp</p>
                </div>
              </div>
            </Float>
            <Float className="-top-5 right-3 sm:right-8" delay={1600}>
              <div className="flex items-center gap-2">
                <img src={WATCH} alt="" className="h-9 w-9 rounded-[8px] object-cover" />
                <img src={CAP} alt="" className="h-9 w-9 rounded-[8px] object-cover" />
                <p className="text-sm font-semibold">Fotos do catálogo enviadas</p>
              </div>
            </Float>
          </div>
          <div>
            <Pill>
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              Pra quem vende sozinho ou com equipe pequena
            </Pill>
            <h2 className="mt-4 text-balance text-3xl font-bold tracking-tight sm:text-[42px] sm:leading-[1.1]">
              Você cuida da loja. O WhatsApp não fica sem resposta.
            </h2>
            <p className="mt-4 text-pretty text-muted-foreground sm:text-lg">
              Cliente que espera horas pela resposta compra em outro lugar. Com o Zaptrix, quem pergunta às 23h recebe a foto, o preço e o
              link na mesma hora, e de manhã você vê tudo no quadro de vendas.
            </p>
            <ul className="mt-6 grid gap-3">
              {[
                ['Responde como a sua loja', 'Você escolhe o papel da IA e o jeito de falar com o cliente.', 'bg-[#2563eb]/[0.06]'],
                ['Sabe a hora de chamar você', 'Pedido de troca, reclamação ou o que você definir vai direto pra uma pessoa da equipe.', 'bg-[#22d3ee]/[0.1]'],
                ['Não vende o que acabou', 'Estoque por tamanho e cor, direto do seu catálogo.', 'bg-card'],
              ].map(([t, d, bg]) => (
                <li key={t} className={`lp-lift rounded-2xl border border-border p-4 ${bg}`}>
                  <b>{t}</b>
                  <p className="mt-0.5 text-sm text-muted-foreground">{d}</p>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </section>

      {/* Recursos (bento) */}
      <section id="recursos" className="mx-auto max-w-6xl scroll-mt-24 px-4 pt-28">
        <Reveal>
          <SectionTitle kicker="Recursos" title="Tudo que a sua loja precisa pra vender pelo WhatsApp" />
        </Reveal>
        <Reveal className="mt-12 grid gap-5 md:grid-cols-6">
          <div className="lp-lift rounded-[32px] border border-border bg-card p-6 md:col-span-4">
            <h3 className="text-lg font-semibold">Quadro de vendas</h3>
            <p className="mt-1 text-sm text-muted-foreground">Cada conversa vira um card. A IA marca quando a venda fecha ou se perde.</p>
            <div className="mt-5"><KanbanMock /></div>
          </div>
          <div className="lp-lift rounded-[32px] bg-[#22d3ee]/[0.12] p-6 md:col-span-2">
            <h3 className="text-lg font-semibold">Entende áudio</h3>
            <p className="mt-1 text-sm text-muted-foreground">O cliente manda áudio e a IA transcreve antes de responder.</p>
            <div className="mt-6"><AudioMock /></div>
          </div>
          <div className="lp-lift rounded-[32px] bg-[#2563eb]/[0.07] p-6 md:col-span-3">
            <h3 className="text-lg font-semibold">Construtor de agente</h3>
            <p className="mt-1 text-sm text-muted-foreground">Quatro papéis prontos pra IA assumir.</p>
            <div className="mt-5"><RolesMock /></div>
          </div>
          <div className="lp-lift rounded-[32px] border border-border bg-card p-6 md:col-span-3">
            <h3 className="text-lg font-semibold">Passa pra uma pessoa quando precisa</h3>
            <p className="mt-1 text-sm text-muted-foreground">Gatilhos que você define e rodízio entre atendentes.</p>
            <div className="mt-5"><HandoffMock /></div>
          </div>
          <div className="banner-card-surface lp-lift grid gap-5 rounded-[32px] p-6 text-white sm:p-8 md:col-span-6 md:grid-cols-3">
            {[
              ['Base de conhecimento', 'Cole o link da sua política de troca ou FAQ e a IA passa a usar.'],
              ['Importação por planilha', 'Suba o CSV do catálogo, inclusive o export padrão da Tray.'],
              ['Variações e promoção', 'Tamanho, cor, estoque e preço promocional por produto.'],
            ].map(([t, d]) => (
              <div key={t}>
                <b>{t}</b>
                <p className="mt-1 text-sm text-white/75">{d}</p>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* Preços */}
      <section id="precos" className="mx-auto max-w-6xl scroll-mt-24 px-4 pt-28">
        <Reveal>
          <SectionTitle kicker="Preços" title="Um plano pro tamanho da sua loja" sub="Comece com 7 dias grátis. Depois, escolha o plano que cabe no seu catálogo." />
        </Reveal>
        <Reveal className="mt-12">
          <Pricing />
        </Reveal>
      </section>

      {/* Dúvidas */}
      <section id="duvidas" className="mx-auto max-w-6xl scroll-mt-24 px-4 pt-28">
        <Reveal className="grid gap-10 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-[42px] sm:leading-[1.1]">Perguntas frequentes</h2>
            <p className="mt-3 text-muted-foreground">O que os lojistas perguntam antes de começar.</p>
          </div>
          <div className="grid gap-3">
            {FAQ.map(([q, a], i) => (
              <details key={q} open={i === 0} className="group rounded-2xl border border-border bg-card px-5 py-4 open:shadow-[0_14px_30px_-22px_rgba(37,99,235,0.5)]">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold [&::-webkit-details-marker]:hidden">
                  {q}
                  <span className="grid h-7 w-7 flex-none place-items-center rounded-full bg-background text-primary transition-transform duration-200 group-open:rotate-45">+</span>
                </summary>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{a}</p>
              </details>
            ))}
          </div>
        </Reveal>
      </section>

      {/* CTA final */}
      <Reveal className="px-3 pt-28">
        <div className="banner-card-surface relative mx-auto grid max-w-6xl items-center gap-4 overflow-hidden rounded-[40px] px-6 pt-12 text-white sm:px-12 lg:grid-cols-[1.2fr_1fr]">
          <div className="pb-6 lg:pb-12">
            <h2 className="text-balance text-3xl font-bold leading-[1.1] sm:text-5xl">O próximo cliente vai mandar mensagem fora do horário.</h2>
            <p className="mt-4 max-w-md text-white/75">Deixe o Zaptrix respondendo. Crie a conta, cadastre os primeiros produtos e conecte o WhatsApp no mesmo dia.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/assinar?trial=1" className="banner-cta rounded-full bg-white px-7 py-3.5 font-semibold text-[#0f2a5c]">Começar teste grátis</Link>
              <Link href="/login" className="rounded-full border border-white/30 px-6 py-3.5 font-medium hover:bg-white/10">Já sou cliente</Link>
            </div>
          </div>
          <div className="relative h-[380px] self-end overflow-hidden">
            <div className="absolute left-1/2 top-0 -translate-x-1/2">
              <ChatDemo height={460} />
            </div>
          </div>
        </div>
      </Reveal>

      <footer className="mx-auto mt-16 max-w-6xl px-4 pb-10">
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6 text-sm text-muted-foreground">
          <Image src="/zaptrix-logo-light.png" alt="Zaptrix" width={92} height={30} />
          <div className="flex gap-6">
            <a href="#precos" className="hover:text-foreground">Preços</a>
            <a href="#duvidas" className="hover:text-foreground">Dúvidas</a>
            <Link href="/login" className="hover:text-foreground">Área do cliente</Link>
          </div>
          <span>Zaptrix · Agência MAVI</span>
        </div>
      </footer>
    </div>
  );
}
