/* eslint-disable @next/next/no-img-element -- fotos de produto dos mockups vêm do Unsplash, sem next/image */
// Linguagem visual: "planta técnica" (títulos condensados, etiquetas mono, bordas de tinta, fluxograma com setas),
// com o azul da marca Zaptrix no papel de cor de sinalização.
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Reveal } from '@/components/reveal';
import { Archivo, IBM_Plex_Mono, Public_Sans } from 'next/font/google';

const display = Archivo({ subsets: ['latin'], axes: ['wdth'], variable: '--f-display' });
const body = Public_Sans({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--f-body' });
const mono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['500'], variable: '--f-mono' });

export const metadata: Metadata = {
  title: 'Zaptrix — seu catálogo vendendo no WhatsApp com IA',
  description:
    'Cadastre seus produtos com o link de pagamento e deixe a IA do Zaptrix atender, mandar foto, tirar dúvida e fechar a venda no WhatsApp.',
};

const IMG = (id: string, w = 480) => `https://images.unsplash.com/${id}?w=${w}&q=70&auto=format&fit=crop`;
const SHOE = IMG('photo-1542291026-7eec264c27ff');


const D = (wdth = 78): React.CSSProperties => ({ fontFamily: 'var(--f-display)', fontVariationSettings: `"wdth" ${wdth}` });
const M: React.CSSProperties = { fontFamily: 'var(--f-mono)' };

function Label({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <span style={M} className={`text-[11.5px] uppercase tracking-[.08em] text-muted-foreground ${className}`}>
      {children}
    </span>
  );
}

function SecHead({ label, title, id }: { label: string; title: string; id: string }) {
  return (
    <div className="grid gap-2 border-t border-border pt-5">
      <Label>{label}</Label>
      <h2 id={id} style={D(84)} className="text-[30px] font-bold leading-[1.06] text-balance sm:text-[40px]">
        {title}
      </h2>
    </div>
  );
}

/* Etiqueta de ator do fluxograma */
const ACTORS = {
  cliente: { t: 'Cliente', c: 'border border-[#0a1730] text-[#0a1730]' },
  ia: { t: 'IA Zaptrix', c: 'bg-[#2563eb] text-white' },
  voce: { t: 'Você', c: 'bg-[#0a1730] text-white' },
  equipe: { t: 'Equipe', c: 'border border-[#0c7a3a] text-[#0c7a3a]' },
} as const;

function Actor({ a }: { a: keyof typeof ACTORS }) {
  return (
    <span style={M} className={`justify-self-start whitespace-nowrap rounded-[3px] px-2 py-[3px] text-[11px] uppercase tracking-[.05em] ${ACTORS[a].c}`}>
      {ACTORS[a].t}
    </span>
  );
}

function Node({ a, title, text, kind, i = 0 }: { a?: keyof typeof ACTORS; title: string; text?: string; kind?: 'sys' | 'decide' | 'done'; i?: number }) {
  const k =
    kind === 'sys'
      ? 'border-2 border-[#2563eb] bg-white'
      : kind === 'decide'
        ? 'border-2 border-[#0a1730] bg-white'
        : kind === 'done'
          ? 'border border-[#0a1730] bg-[#0a1730] text-white'
          : 'border border-border bg-white';
  return (
    <div data-r style={{ '--i': i } as React.CSSProperties} className={`grid min-w-0 gap-1.5 rounded-md px-3.5 py-3 ${k}`}>
      {a && <Actor a={a} />}
      <b className="text-[15.5px] leading-snug">{title}</b>
      {text && <p className={`text-[14px] leading-[1.45] ${kind === 'done' ? 'text-white/75' : 'text-muted-foreground'}`}>{text}</p>}
    </div>
  );
}

function Down({ className = 'ml-6', i = 0 }: { className?: string; i?: number }) {
  return (
    <div aria-hidden data-draw style={{ '--i': i } as React.CSSProperties} className={`relative h-6 w-[2px] bg-[#0a1730] ${className}`}>
      <span className="absolute -bottom-px -left-[5px] border-x-[6px] border-t-[6px] border-x-transparent border-t-[#0a1730]" />
    </div>
  );
}

/* ---------- Mockups das telas reais ---------- */

function Bubble({ me, children, time }: { me?: boolean; children: React.ReactNode; time: string }) {
  return (
    <div className={`flex ${me ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[82%] rounded-lg px-2.5 py-1.5 text-[13px] leading-snug text-[#111b21] shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] ${
          me ? 'rounded-tr-none bg-[#d9fdd3]' : 'rounded-tl-none bg-white'
        }`}
      >
        {children}
        <span className="mt-0.5 block text-right text-[10px] text-[#667781]">{time}</span>
      </div>
    </div>
  );
}

function PhoneChat() {
  return (
    <div className="relative mx-auto w-[300px] rounded-[44px] border-2 border-[#0a1730] bg-[#0a1730] p-2.5 sm:w-[320px]">
      <div className="absolute left-1/2 top-2.5 z-10 h-5 w-24 -translate-x-1/2 rounded-b-2xl bg-[#0a1730]" />
      <div className="overflow-hidden rounded-[34px] bg-[#efeae2]">
        <div className="flex items-center gap-2.5 border-b border-black/5 bg-[#f0f2f5] px-3 pb-2.5 pt-7">
          <div className="grid h-8 w-8 place-items-center rounded-full bg-[#0f2a5c] text-xs font-bold text-white">LA</div>
          <div className="leading-tight">
            <p className="text-[13px] font-semibold text-[#111b21]">Loja Aurora</p>
            <p className="text-[11px] text-[#667781]">online</p>
          </div>
        </div>
        <div className="h-[540px] space-y-1.5 overflow-hidden px-2.5 py-3">
          <Bubble me time="21:47">Oi! Ainda tem aquele tênis vermelho no 39?</Bubble>
          <Bubble time="21:47">Oi, Marina! Tem sim, o Runner Classic no 39 está com 4 pares em estoque. Olha ele aqui:</Bubble>
          <div className="flex justify-start">
            <div className="w-[78%] rounded-lg rounded-tl-none bg-white p-1 shadow-[0_1px_0.5px_rgba(11,20,26,0.13)]">
              <img src={SHOE} alt="Foto do tênis enviada pela IA" className="h-36 w-full rounded-md object-cover" />
              <p className="px-1.5 pt-1.5 text-[13px] text-[#111b21]">
                Runner Classic Vermelho
                <br />
                <span className="text-[12px] text-[#667781] line-through">R$ 399,90</span> <strong>R$ 329,90</strong>
              </p>
              <span className="block px-1.5 pb-0.5 text-right text-[10px] text-[#667781]">21:47</span>
            </div>
          </div>
          <Bubble me time="21:48">Parcela em quantas vezes?</Bubble>
          <Bubble time="21:48">
            Em até 6x sem juros no cartão. Pra garantir o seu, é só finalizar por aqui:
            <span className="mt-1 block break-all rounded-md bg-[#f0f2f5] px-2 py-1.5 text-[12px] text-[#027eb5] underline">
              pay.lojaaurora.com.br/runner-39
            </span>
          </Bubble>
          <Bubble me time="21:50">Pronto, paguei!</Bubble>
        </div>
      </div>
    </div>
  );
}

function BrowserFrame({ url, children }: { url: string; children: React.ReactNode }) {
  return (
    <div className="lp-lift overflow-hidden rounded-lg border-2 border-[#0a1730] bg-white">
      <div className="flex items-center gap-2 border-b-2 border-[#0a1730] bg-background px-3 py-2">
        <span className="h-2.5 w-2.5 rounded-full border border-[#0a1730]" />
        <span className="h-2.5 w-2.5 rounded-full border border-[#0a1730]" />
        <span className="h-2.5 w-2.5 rounded-full border border-[#0a1730]" />
        <span style={M} className="ml-2 flex-1 truncate text-[11px] text-muted-foreground">
          {url}
        </span>
      </div>
      {children}
    </div>
  );
}

function Field({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="mb-1 text-[11px] font-medium text-[#0a1730]">{label}</p>
      <div
        className={`truncate rounded-md border px-2.5 py-1.5 text-[12px] text-[#0a1730] ${
          highlight ? 'border-2 border-[#2563eb] bg-[#2563eb]/5' : 'border-border'
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
      <div className="grid gap-4 p-4 sm:grid-cols-[140px_1fr]">
        <img src={SHOE} alt="" className="h-36 w-full rounded-md object-cover sm:h-full" />
        <div className="grid grid-cols-2 gap-2.5">
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
        </div>
      </div>
    </BrowserFrame>
  );
}

const KANBAN = [
  { col: 'Em atendimento', dot: 'bg-[#2563eb]', cards: [['Marina Souza', 'Parcela em quantas vezes?', 'IA respondendo'], ['Rafael Lima', 'Tem a versão preta?', 'IA respondendo']] },
  { col: 'Com humano', dot: 'bg-[#9b5a00]', cards: [['Cláudia Reis', 'Quero trocar o tamanho', 'Com Ana']] },
  { col: 'Ganho', dot: 'bg-[#0c7a3a]', cards: [['Pedro Alves', 'Paguei, obrigado!', 'R$ 329,90'], ['Júlia Nunes', 'Fechado, pode mandar', 'R$ 189,00']] },
];

function KanbanMock() {
  return (
    <BrowserFrame url="zaptrix.agenciamavi.com.br/atendimento">
      <div className="grid gap-2.5 bg-background p-3 sm:grid-cols-3">
        {KANBAN.map((c) => (
          <div key={c.col} className="min-w-0">
            <p className="mb-2 flex items-center gap-2 px-0.5 text-[12px] font-semibold text-[#0a1730]">
              <span className={`h-2 w-2 rounded-full ${c.dot}`} />
              {c.col}
              <span style={M} className="ml-auto text-[11px] font-normal text-muted-foreground">
                {c.cards.length}
              </span>
            </p>
            <div className="space-y-2">
              {c.cards.map(([n, m, tag]) => (
                <div key={n} className="rounded-md border border-border bg-white p-2.5">
                  <p className="text-[12px] font-semibold text-[#0a1730]">{n}</p>
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{m}</p>
                  <span style={M} className="mt-2 inline-block rounded-[3px] bg-[#2563eb]/10 px-1.5 py-0.5 text-[10px] uppercase tracking-[.04em] text-[#1d4ed8]">
                    {tag}
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
  ['Vendas', 'Apresenta produtos e conduz até o fechamento'],
  ['Suporte', 'Resolve dúvidas técnicas, pedidos e trocas'],
  ['Atendimento Geral', 'Tira dúvidas gerais e direciona o cliente'],
  ['Pós-venda', 'Acompanha a experiência e oferece novos produtos'],
];

/* ---------- Página ---------- */

const STEPS = [
  ['Cadastre o produto', 'Nome, preço, promoção, foto, variações de tamanho e cor, estoque. Muitos produtos? Suba a planilha.'],
  ['Cole o link de pagamento', 'Qualquer link serve: checkout da sua loja, Mercado Pago, PagSeguro, link do banco.'],
  ['Escolha o papel da IA', 'Vendas, suporte, atendimento geral ou pós-venda, e quando ela passa a conversa pra sua equipe.'],
  ['Conecte o WhatsApp', 'Lê o QR Code no painel e o seu número passa a responder com IA.'],
];

const TRIGGERS = [
  ['Cliente manda áudio', 'a IA transcreve e responde em texto'],
  ['Pergunta sobre um produto', 'responde com foto, preço e estoque do catálogo'],
  ['Pergunta sobre troca ou frete', 'responde pela sua base de conhecimento'],
  ['Cliente decide comprar', 'envia o link de compra daquele produto'],
  ['Pede pra falar com alguém', 'transfere pra sua equipe, em rodízio'],
  ['Venda fechada ou perdida', 'o card muda de coluna no quadro'],
];

export default function Home() {
  return (
    <div
      className={`${display.variable} ${body.variable} ${mono.variable} min-h-screen overflow-x-hidden bg-background text-foreground`}
      style={{ fontFamily: 'var(--f-body)' }}
    >
      <header className="sticky top-0 z-30 border-b-2 border-[#0a1730] bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Image src="/zaptrix-logo-light.png" alt="Zaptrix" width={118} height={38} priority />
          <nav className="flex items-center gap-1.5 text-sm sm:gap-3">
            <Link href="/login" className="rounded-full px-4 py-2 font-medium hover:bg-card">
              Entrar
            </Link>
            <Link href="/assinar" className="btn-gradient px-5 py-2 font-semibold">
              Criar conta
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-20 px-4 pb-16 sm:px-6">
        {/* Capa */}
        <Reveal className="grid items-start gap-12 pt-10 lg:grid-cols-[1.2fr_1fr] lg:pt-16">
          <div className="grid gap-6">
            <div className="flex flex-wrap justify-between gap-3">
              <Label>Atendimento e vendas no WhatsApp com IA</Label>
              <Label>Pra qualquer loja</Label>
            </div>
            <h1 style={D(70)} className="text-[44px] font-extrabold leading-[1.02] tracking-[-.01em] text-balance sm:text-[72px]">
              Seu catálogo vendendo no WhatsApp,{' '}
              <mark className="gradient-brand px-[.12em] text-white [box-decoration-break:clone]">às 21h47 de um domingo.</mark>
            </h1>
            <p className="max-w-[60ch] text-[17px] leading-relaxed text-muted-foreground">
              Você cadastra o produto com foto, preço e o link de pagamento. A IA do Zaptrix responde no seu número, mostra a
              foto, confere o estoque e manda o link na hora em que o cliente decide comprar. Serve pra loja na Tray, pra quem
              vende pelo Instagram ou pra quem só tem o WhatsApp e um link do Mercado Pago.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Link href="/assinar" className="btn-gradient px-7 py-3.5 text-base font-semibold">
                Quero vender pelo WhatsApp
              </Link>
              <a href="#fluxo" className="rounded-full border-2 border-[#0a1730] px-6 py-3 text-base font-semibold hover:bg-card">
                Ver como funciona
              </a>
            </div>
            <div className="mt-2 grid grid-cols-3 border-t-2 border-[#0a1730]">
              {[
                ['24h', 'respondendo no seu número'],
                ['4', 'papéis de IA pra escolher'],
                ['1 link', 'de pagamento por produto, de onde você quiser'],
              ].map(([n, t]) => (
                <div key={n} className="grid min-w-0 gap-0.5 pr-2 pt-3">
                  <b style={D(80)} className="text-[30px] font-extrabold tabular-nums">
                    {n}
                  </b>
                  <span className="text-[13px] leading-tight text-muted-foreground">{t}</span>
                </div>
              ))}
            </div>
          </div>
          <PhoneChat />
        </Reveal>

        {/* Passos */}
        <Reveal aria-labelledby="s-passos" className="grid gap-8">
          <SecHead id="s-passos" label="Configuração · uma vez só" title="Do cadastro ao primeiro atendimento" />
          <div className="grid items-start gap-10 lg:grid-cols-[1fr_1.15fr]">
            <ol className="grid gap-4">
              {STEPS.map(([t, d], i) => (
                <li key={t} className="grid grid-cols-[40px_1fr] items-start gap-3">
                  <span style={D(80)} className="grid h-10 w-10 place-items-center rounded-[4px] bg-[#0a1730] text-[22px] font-extrabold text-white">
                    {i + 1}
                  </span>
                  <div>
                    <b className="block">{t}</b>
                    <span className="text-[15px] text-muted-foreground">{d}</span>
                  </div>
                </li>
              ))}
            </ol>
            <div className="grid gap-3">
              <ProductFormMock />
              <p className="text-[13px] text-muted-foreground">
                O campo <b className="text-[#0a1730]">Link de compra</b> é o que a IA manda pro cliente na hora do fechamento.
              </p>
            </div>
          </div>
        </Reveal>

        {/* Fluxograma */}
        <Reveal id="fluxo" aria-labelledby="s-fluxo" className="grid scroll-mt-20 gap-6">
          <SecHead id="s-fluxo" label="Fluxo do atendimento" title="Do “oi” ao pagamento" />
          <div className="flex flex-wrap gap-1.5" aria-label="Legenda">
            <Actor a="cliente" />
            <Actor a="ia" />
            <Actor a="equipe" />
            <Actor a="voce" />
          </div>
          <div className="grid gap-10 lg:grid-cols-[1fr_1fr]">
            <div className="grid max-w-[560px]">
              <Node i={0} a="cliente" title="Manda mensagem no seu WhatsApp" text="Texto ou áudio, a qualquer hora." />
              <Down i={1} />
              <Node i={2} a="ia" kind="sys" title="Lê o catálogo e a base de conhecimento" text="Áudio é transcrito antes. A resposta sai com foto, preço promocional e estoque da variação pedida." />
              <Down i={3} />
              <Node i={4} a="ia" kind="decide" title="Dá pra resolver sozinha?" />
              <div className="grid grid-cols-2 gap-2">
                <div className="grid content-start">
                  <Label className="py-1.5 pl-8">Sim</Label>
                  <Down i={5} className="ml-6 h-4" />
                  <Node i={6} title="Manda o link de compra" text="Na hora em que o cliente decide." />
                </div>
                <div className="grid content-start">
                  <Label className="py-1.5 pl-8">Não</Label>
                  <Down i={5} className="ml-6 h-4" />
                  <Node i={6} a="equipe" title="Passa pra sua equipe" text="Pelo gatilho que você definiu, em rodízio entre atendentes." />
                </div>
              </div>
              <Down i={7} />
              <Node i={8} kind="done" title="Card vai pra Ganho ou Perdido" text="A IA marca o estágio da conversa e você acompanha tudo no quadro." />
            </div>
            <div className="grid content-start gap-3">
              <Label>O quadro que você acompanha</Label>
              <KanbanMock />
              <div className="mt-4 rounded-md border-2 border-[#0a1730] bg-card p-4">
                <Label>Construtor de agente</Label>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {PROFILES.map(([t, d], i) => (
                    <div key={t} className={`lp-lift rounded-md bg-white p-3 ${i === 0 ? 'border-2 border-[#2563eb]' : 'border border-border'}`}>
                      <b className="text-[14px]">{t}</b>
                      <p className="mt-0.5 text-[12.5px] leading-snug text-muted-foreground">{d}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Reveal>

        {/* Gatilhos */}
        <Reveal aria-labelledby="s-auto" className="grid gap-6">
          <SecHead id="s-auto" label="Sem ninguém no celular" title="Cada mensagem já tem resposta" />
          <div className="grid gap-2 md:grid-cols-2">
            {TRIGGERS.map(([t, r]) => (
              <div
                key={t}
                className="grid grid-cols-[minmax(0,1fr)_22px_minmax(0,1.25fr)] items-center gap-2.5 lp-lift rounded-md border border-border bg-card p-3 text-[14.5px]"
              >
                <b className="font-semibold">{t}</b>
                <i aria-hidden className="relative h-[2px] bg-[#0a1730]">
                  <span className="absolute -right-0.5 -top-1 border-y-[5px] border-l-[6px] border-y-transparent border-l-[#0a1730]" />
                </i>
                <span className="text-muted-foreground">{r}</span>
              </div>
            ))}
          </div>
          <div className="grid gap-1 banner-card-surface rounded-md p-5 text-white">
            <b style={D(85)} className="text-[22px]">
              Tudo pelo navegador, nada pra instalar
            </b>
            <p className="text-[15px] text-white/85">
              O painel abre no computador ou no celular. O WhatsApp continua sendo o seu número de sempre.
            </p>
          </div>
        </Reveal>

        {/* CTA */}
        <Reveal className="grid gap-5 rounded-lg border-2 border-[#0a1730] bg-card p-6 sm:p-10">
          <Label>Comece hoje</Label>
          <h2 style={D(76)} className="max-w-[20ch] text-[34px] font-extrabold leading-[1.04] text-balance sm:text-[52px]">
            O próximo cliente vai mandar mensagem fora do horário.{' '}
            <mark className="gradient-brand px-[.1em] text-white [box-decoration-break:clone]">Deixa alguém respondendo.</mark>
          </h2>
          <div className="flex flex-wrap gap-3">
            <Link href="/assinar" className="btn-gradient px-7 py-3.5 font-semibold">
              Criar minha conta
            </Link>
            <Link href="/login" className="rounded-full border-2 border-[#0a1730] px-6 py-3 font-semibold hover:bg-card">
              Já sou cliente
            </Link>
          </div>
        </Reveal>
      </main>

      <footer className="mx-auto flex max-w-6xl flex-wrap justify-between gap-3 border-t border-border px-4 py-6 text-[13px] text-muted-foreground sm:px-6">
        <span>Zaptrix · Agência MAVI</span>
        <Link href="/login" className="hover:text-[#0a1730]">
          Área do cliente
        </Link>
      </footer>
    </div>
  );
}
