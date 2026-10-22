/* eslint-disable @next/next/no-img-element -- fotos de produto dos mockups vêm do Unsplash, sem next/image */
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Zaptrix — seu catálogo vendendo no WhatsApp com IA',
  description:
    'Cadastre seus produtos com o link de pagamento e deixe a IA do Zaptrix atender, mandar foto, tirar dúvida e fechar a venda no WhatsApp.',
};

const IMG = (id: string, w = 480) => `https://images.unsplash.com/${id}?w=${w}&q=70&auto=format&fit=crop`;

const SHOE = IMG('photo-1542291026-7eec264c27ff');
const WATCH = IMG('photo-1523275335684-37898b6baf30');
const SNEAKER = IMG('photo-1595950653106-6c9ebd614d3a');
const CAP = IMG('photo-1585386959984-a4155224a1ad');

/* ---------- Mockups (HTML puro, reproduzem as telas reais do sistema) ---------- */

function Bubble({ me, children, time }: { me?: boolean; children: React.ReactNode; time: string }) {
  return (
    <div className={`flex ${me ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[82%] rounded-lg px-2.5 py-1.5 text-[13px] leading-snug text-[#111b21] shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] ${
          me ? 'bg-[#d9fdd3] rounded-tr-none' : 'bg-white rounded-tl-none'
        }`}
      >
        {children}
        <span className="block text-right text-[10px] text-[#667781] mt-0.5">{time}</span>
      </div>
    </div>
  );
}

function PhoneChat() {
  return (
    <div className="relative mx-auto w-[300px] sm:w-[320px] rounded-[44px] bg-[#0b1220] p-3 shadow-[0_40px_80px_-30px_rgba(29,78,216,0.55)]">
      <div className="absolute left-1/2 top-3 h-5 w-24 -translate-x-1/2 rounded-b-2xl bg-[#0b1220] z-10" />
      <div className="overflow-hidden rounded-[34px] bg-[#efeae2]">
        <div className="flex items-center gap-2.5 bg-[#f0f2f5] px-3 pb-2.5 pt-7 border-b border-black/5">
          <div className="h-8 w-8 rounded-full bg-[#0f2a5c] text-white text-xs font-bold grid place-items-center">LA</div>
          <div className="leading-tight">
            <p className="text-[13px] font-semibold text-[#111b21]">Loja Aurora</p>
            <p className="text-[11px] text-[#667781]">online</p>
          </div>
        </div>
        <div className="space-y-1.5 px-2.5 py-3 h-[560px] overflow-hidden">
          <Bubble me time="21:47">Oi! Ainda tem aquele tênis vermelho no 39?</Bubble>
          <Bubble time="21:47">
            Oi, Marina! Tem sim, o Runner Classic no 39 está com 4 pares em estoque. Olha ele aqui:
          </Bubble>
          <div className="flex justify-start">
            <div className="w-[78%] rounded-lg rounded-tl-none bg-white p-1 shadow-[0_1px_0.5px_rgba(11,20,26,0.13)]">
              <img src={SHOE} alt="" className="h-36 w-full rounded-md object-cover" />
              <p className="px-1.5 pt-1.5 text-[13px] text-[#111b21]">
                Runner Classic Vermelho
                <br />
                <span className="text-[#667781] line-through text-[12px]">R$ 399,90</span>{' '}
                <strong>R$ 329,90</strong>
              </p>
              <span className="block text-right text-[10px] text-[#667781] px-1.5 pb-0.5">21:47</span>
            </div>
          </div>
          <Bubble me time="21:48">Parcela em quantas vezes?</Bubble>
          <Bubble time="21:48">
            Em até 6x sem juros no cartão. Se quiser garantir o seu, é só finalizar por aqui:
            <span className="mt-1 block rounded-md bg-[#f0f2f5] px-2 py-1.5 text-[12px] text-[#027eb5] underline break-all">
              pay.lojaaurora.com.br/runner-39
            </span>
          </Bubble>
          <Bubble me time="21:50">Pronto, paguei!</Bubble>
        </div>
      </div>
    </div>
  );
}

function BrowserFrame({ url, children, className = '' }: { url: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`overflow-hidden rounded-2xl border border-border bg-card shadow-[0_30px_60px_-30px_rgba(37,99,235,0.35)] ${className}`}>
      <div className="flex items-center gap-2 border-b border-border bg-muted px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-[#f87171]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#fbbf24]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#34d399]" />
        <span className="ml-3 flex-1 truncate rounded-full bg-card px-3 py-1 text-[11px] text-muted-foreground">{url}</span>
      </div>
      {children}
    </div>
  );
}

function Field({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <p className="mb-1 text-[11px] font-medium text-foreground">{label}</p>
      <div
        className={`rounded-lg border px-3 py-2 text-[12px] truncate ${
          highlight ? 'border-[#3b82f6] ring-4 ring-[#3b82f6]/15 text-foreground' : 'border-border text-foreground'
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function ProductFormMock() {
  return (
    <BrowserFrame url="zaptrix.agenciamavi.com.br/produtos">
      <div className="grid gap-5 p-5 sm:grid-cols-[150px_1fr]">
        <img src={SHOE} alt="" className="h-40 w-full rounded-xl object-cover sm:h-full" />
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Field label="Nome *" value="Runner Classic Vermelho" />
          </div>
          <Field label="Preço *" value="399.90" />
          <Field label="Preço promocional" value="329.90" />
          <Field label="Categoria" value="Calçados" />
          <Field label="Tags (vírgula)" value="promoção, novo" />
          <div className="col-span-2">
            <Field label="Link de compra" value="https://pay.lojaaurora.com.br/runner-39" highlight />
          </div>
          <div className="col-span-2 flex flex-wrap gap-1.5">
            {['36', '37', '38', '39', '40'].map((t) => (
              <span key={t} className="rounded-full border border-border px-2.5 py-0.5 text-[11px] text-muted-foreground">
                Tam. {t}
              </span>
            ))}
          </div>
        </div>
      </div>
    </BrowserFrame>
  );
}

const KANBAN = [
  {
    col: 'Em atendimento',
    tone: 'bg-[#3b82f6]',
    cards: [
      { n: 'Marina Souza', m: 'Parcela em quantas vezes?', tag: 'IA respondendo' },
      { n: 'Rafael Lima', m: 'Tem a versão preta?', tag: 'IA respondendo' },
    ],
  },
  {
    col: 'Com humano',
    tone: 'bg-[#9b5a00]',
    cards: [{ n: 'Cláudia Reis', m: 'Quero trocar o tamanho do pedido', tag: 'Transferido p/ Ana' }],
  },
  {
    col: 'Ganho',
    tone: 'bg-[#0c7a3a]',
    cards: [
      { n: 'Pedro Alves', m: 'Paguei, obrigado!', tag: 'R$ 329,90' },
      { n: 'Júlia Nunes', m: 'Fechado, pode mandar', tag: 'R$ 189,00' },
    ],
  },
];

function KanbanMock() {
  return (
    <BrowserFrame url="zaptrix.agenciamavi.com.br/atendimento">
      <div className="grid gap-3 bg-background p-4 sm:grid-cols-3">
        {KANBAN.map((c) => (
          <div key={c.col} className="rounded-xl bg-muted/70 p-2.5">
            <p className="mb-2.5 flex items-center gap-2 px-1 text-[12px] font-semibold text-foreground">
              <span className={`h-2 w-2 rounded-full ${c.tone}`} />
              {c.col}
              <span className="ml-auto text-muted-foreground font-normal">{c.cards.length}</span>
            </p>
            <div className="space-y-2">
              {c.cards.map((k) => (
                <div key={k.n} className="rounded-lg border border-border bg-card p-2.5">
                  <p className="text-[12px] font-semibold text-foreground">{k.n}</p>
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{k.m}</p>
                  <span className="mt-2 inline-block rounded-full bg-[#2563eb]/10 px-2 py-0.5 text-[10px] font-medium text-[#1d4ed8]">
                    {k.tag}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </BrowserFrame>
  );
}

const PROFILES = [
  { label: 'Vendas', d: 'Apresenta produtos e conduz até o fechamento', on: true },
  { label: 'Suporte', d: 'Resolve dúvidas técnicas, pedidos e trocas' },
  { label: 'Atendimento Geral', d: 'Tira dúvidas gerais e direciona o cliente' },
  { label: 'Pós-venda', d: 'Acompanha a experiência e oferece novos produtos' },
];

function AgentMock() {
  return (
    <BrowserFrame url="zaptrix.agenciamavi.com.br/ia">
      <div className="p-5">
        <p className="text-[15px] font-bold text-foreground">Construtor de Agente</p>
        <p className="mb-4 text-[12px] text-muted-foreground">Escolha o papel da sua IA</p>
        <div className="grid gap-2.5 sm:grid-cols-2">
          {PROFILES.map((p) => (
            <div
              key={p.label}
              className={`rounded-xl border p-3 ${p.on ? 'border-[#3b82f6] ring-4 ring-[#3b82f6]/15' : 'border-border'}`}
            >
              <p className="text-[13px] font-semibold text-foreground">{p.label}</p>
              <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{p.d}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-xl border border-border p-3">
          <p className="text-[11px] font-medium text-foreground mb-1">Transferir para humano quando</p>
          <p className="text-[12px] text-muted-foreground">o cliente pedir troca, reclamar de entrega ou pedir desconto acima de 10%</p>
        </div>
      </div>
    </BrowserFrame>
  );
}

/* ---------- Página ---------- */

const EXTRAS = [
  ['Entende áudio', 'O cliente manda áudio, a IA transcreve e responde em texto.'],
  ['Variações de verdade', 'Tamanho, cor e estoque por variação, sem a IA prometer o que acabou.'],
  ['Base de conhecimento', 'Cole o link da sua política de troca ou FAQ e a IA passa a usar.'],
  ['Importação por planilha', 'Suba o CSV do catálogo, inclusive o export padrão da Tray.'],
  ['Roleta de atendimento', 'Conversas transferidas são distribuídas entre a sua equipe.'],
  ['Painel de resultados', 'Conversas, vendas ganhas e perdidas acompanhadas no dashboard.'],
];

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Image src="/zaptrix-logo-light.png" alt="Zaptrix" width={124} height={40} priority />
          <nav className="flex items-center gap-2 sm:gap-4 text-sm">
            <Link href="/login" className="rounded-full px-4 py-2 font-medium text-foreground hover:bg-muted">
              Entrar
            </Link>
            <Link href="/assinar" className="btn-gradient px-5 py-2 font-semibold">
              Criar conta
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-40 -top-40 h-[620px] w-[620px] rounded-full opacity-30 blur-3xl gradient-brand"
        />
        <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-4 pb-20 pt-14 sm:px-6 lg:grid-cols-[1.15fr_1fr] lg:pt-20">
          <div>
            <p className="mb-5 inline-block rounded-full border border-[#3b82f6]/30 bg-card px-3 py-1 text-xs font-medium text-[#1d4ed8]">
              Atendimento e vendas no WhatsApp com IA
            </p>
            <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
              Seu catálogo vendendo no WhatsApp,{' '}
              <span className="text-[#1d4ed8]">às 21h47 de um domingo.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
              Você cadastra o produto com foto, preço e o link de pagamento. A IA do Zaptrix responde o cliente no seu número,
              mostra a foto, confere o estoque e manda o link na hora em que ele decide comprar.
            </p>
            <p className="mt-3 max-w-xl text-sm text-muted-foreground">
              Serve pra loja virtual na Tray, pra quem vende pelo Instagram ou pra quem só tem o WhatsApp e um link do
              Mercado Pago, PagSeguro ou do checkout que já usa.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/assinar" className="btn-gradient px-7 py-3.5 text-base font-semibold">
                Quero vender pelo WhatsApp
              </Link>
              <a href="#como-funciona" className="rounded-full px-5 py-3.5 text-base font-medium text-foreground hover:bg-muted">
                Ver como funciona
              </a>
            </div>
          </div>
          <PhoneChat />
        </div>
      </section>

      {/* Como funciona */}
      <section id="como-funciona" className="border-t border-border bg-card">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <h2 className="max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
            Três passos entre o seu produto e o Pix na conta.
          </h2>

          <div className="mt-14 grid items-center gap-10 lg:grid-cols-[1fr_1.3fr]">
            <div>
              <span className="text-sm font-bold text-[#2563eb]">01</span>
              <h3 className="mt-2 text-2xl font-bold">Cadastre o produto e cole o link de pagamento</h3>
              <p className="mt-3 leading-relaxed text-muted-foreground">
                Nome, preço, preço promocional, foto, variações e o link onde o cliente paga. Qualquer link serve: checkout
                da sua loja, link do Mercado Pago, do PagSeguro ou do seu banco. Tem muito produto? Importa a planilha.
              </p>
            </div>
            <ProductFormMock />
          </div>

          <div className="mt-20 grid items-center gap-10 lg:grid-cols-[1.3fr_1fr]">
            <div className="order-2 lg:order-1">
              <AgentMock />
            </div>
            <div className="order-1 lg:order-2">
              <span className="text-sm font-bold text-[#2563eb]">02</span>
              <h3 className="mt-2 text-2xl font-bold">Conecte seu número e diga como a IA deve agir</h3>
              <p className="mt-3 leading-relaxed text-muted-foreground">
                Lê o QR Code e o seu WhatsApp passa a responder com IA. Você escolhe o papel do agente (vendas, suporte,
                atendimento ou pós-venda) e define em que situação a conversa vai para uma pessoa da equipe.
              </p>
            </div>
          </div>

          <div className="mt-20 grid items-center gap-10 lg:grid-cols-[1fr_1.3fr]">
            <div>
              <span className="text-sm font-bold text-[#2563eb]">03</span>
              <h3 className="mt-2 text-2xl font-bold">Acompanhe cada conversa até virar venda</h3>
              <p className="mt-3 leading-relaxed text-muted-foreground">
                Todas as conversas ficam num quadro: quem a IA está atendendo, quem foi passado para um humano e quem já
                comprou. Se o cliente travar, você entra na conversa pelo próprio painel.
              </p>
            </div>
            <KanbanMock />
          </div>
        </div>
      </section>

      {/* Recursos */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.6fr]">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">O que vem junto</h2>
            <p className="mt-3 text-muted-foreground">
              Tudo isso está no mesmo painel, sem instalar nada no celular.
            </p>
            <div className="mt-8 grid grid-cols-3 gap-2">
              {[WATCH, SNEAKER, CAP].map((src) => (
                <img key={src} src={src} alt="" className="aspect-square w-full rounded-xl object-cover" />
              ))}
            </div>
          </div>
          <dl className="grid gap-x-10 gap-y-8 sm:grid-cols-2">
            {EXTRAS.map(([t, d]) => (
              <div key={t} className="border-l-2 border-[#3b82f6] pl-4">
                <dt className="font-semibold">{t}</dt>
                <dd className="mt-1 text-sm leading-relaxed text-muted-foreground">{d}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* CTA final */}
      <section className="px-4 pb-20 sm:px-6">
        <div className="banner-card-surface mx-auto max-w-6xl rounded-[32px] px-6 py-14 text-white sm:px-14">
          <h2 className="max-w-2xl text-3xl font-bold leading-tight sm:text-4xl">
            Seu próximo cliente vai mandar mensagem fora do horário. Deixa alguém respondendo.
          </h2>
          <p className="mt-4 max-w-xl text-white/75">
            Crie a conta, cadastre os primeiros produtos e conecte o WhatsApp no mesmo dia.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/assinar" className="banner-cta rounded-full bg-white px-7 py-3.5 font-semibold text-[#0f2a5c]">
              Criar minha conta
            </Link>
            <Link href="/login" className="rounded-full border border-white/30 px-7 py-3.5 font-medium text-white hover:bg-white/10">
              Já sou cliente
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-muted-foreground sm:px-6">
          <span>Zaptrix · Agência MAVI</span>
          <Link href="/login" className="hover:text-foreground">
            Área do cliente
          </Link>
        </div>
      </footer>
    </div>
  );
}
