/* eslint-disable @next/next/no-img-element -- fotos dos mockups vêm do Unsplash */
'use client';

import { useEffect, useState } from 'react';

type Msg =
  | { kind: 'text'; me?: boolean; text: string; time: string }
  | { kind: 'audio'; time: string }
  | { kind: 'product'; time: string }
  | { kind: 'link'; text: string; url: string; time: string }
  | { kind: 'event'; text: string };

const SHOE = 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=480&q=70&auto=format&fit=crop';
const CUSTOMER = 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=96&h=96&q=70&auto=format&fit=crop';

// Conversa roteirizada; mensagens do cliente (me) chegam direto, as da IA vêm depois do "digitando".
const SCRIPT: Msg[] = [
  { kind: 'text', me: true, text: 'Oi! Ainda tem aquele tênis vermelho no 39?', time: '21:47' },
  { kind: 'text', text: 'Tem sim, Marina! O Runner Classic no 39 está com 4 pares. Olha ele aqui:', time: '21:47' },
  { kind: 'product', time: '21:47' },
  { kind: 'audio', time: '21:48' },
  { kind: 'link', text: 'Parcela em até 6x sem juros no cartão. Pra garantir o seu, é só finalizar por aqui:', url: 'pay.lojaaurora.com.br/runner-39', time: '21:48' },
  { kind: 'text', me: true, text: 'Pronto, paguei!', time: '21:50' },
  { kind: 'event', text: 'Conversa movida para Ganho · R$ 329,90' },
];

const fromCustomer = (m: Msg) => (m.kind === 'text' && m.me) || m.kind === 'audio' || m.kind === 'event';

function Bubble({ m }: { m: Msg }) {
  if (m.kind === 'event') {
    return (
      <div className="lp-msg flex justify-center pt-1">
        <span className="rounded-full bg-[#0c7a3a] px-3 py-1 text-[11px] font-semibold text-white shadow-sm">{m.text}</span>
      </div>
    );
  }
  const me = (m.kind === 'text' && m.me) || m.kind === 'audio';
  return (
    <div className={`lp-msg flex ${me ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[84%] rounded-2xl px-3 py-2 text-[13px] leading-snug text-[#111b21] shadow-[0_1px_1px_rgba(11,20,26,0.08)] ${
          me ? 'rounded-br-[6px] bg-[#d9fdd3]' : 'rounded-bl-[6px] bg-white'
        } ${m.kind === 'product' ? 'w-[78%] p-1' : ''}`}
      >
        {m.kind === 'text' && m.text}
        {m.kind === 'audio' && (
          <span className="flex items-center gap-2 py-0.5">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-[#0c7a3a] text-white">
              <svg width="10" height="12" viewBox="0 0 10 12" aria-hidden><path d="M0 0l10 6-10 6z" fill="currentColor" /></svg>
            </span>
            <span className="flex h-5 items-center gap-[2px]">
              {[6, 12, 18, 9, 14, 20, 8, 15, 11, 17, 7, 13, 10].map((h, i) => (
                <i key={i} className="lp-wave block w-[2px] rounded-full bg-[#55616a]" style={{ height: h, animationDelay: `${i * 70}ms` }} />
              ))}
            </span>
            <span className="text-[11px] text-[#667781]">0:07</span>
          </span>
        )}
        {m.kind === 'product' && (
          <>
            <img src={SHOE} alt="Foto do tênis enviada pela IA" className="h-32 w-full rounded-[12px] object-cover" />
            <span className="block px-2 pt-1.5">
              Runner Classic Vermelho
              <br />
              <span className="text-[12px] text-[#667781] line-through">R$ 399,90</span> <strong>R$ 329,90</strong>
            </span>
          </>
        )}
        {m.kind === 'link' && (
          <>
            {m.text}
            <span className="mt-1.5 block break-all rounded-[8px] bg-[#f0f2f5] px-2 py-1.5 text-[12px] text-[#027eb5] underline">{m.url}</span>
          </>
        )}
        <span className={`mt-0.5 block text-right text-[10px] text-[#667781] ${m.kind === 'product' ? 'px-2 pb-1' : ''}`}>{m.time}</span>
      </div>
    </div>
  );
}

export function ChatDemo({ height = 520 }: { height?: number }) {
  const [shown, setShown] = useState(0);
  const [typing, setTyping] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(SCRIPT.length);
      return;
    }
    let alive = true;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const wait = (ms: number) => new Promise<void>((r) => timers.push(setTimeout(r, ms)));

    (async () => {
      while (alive) {
        setShown(0);
        await wait(700);
        for (let i = 0; i < SCRIPT.length && alive; i++) {
          if (!fromCustomer(SCRIPT[i])) {
            setTyping(true);
            await wait(1100);
            setTyping(false);
          }
          setShown(i + 1);
          await wait(SCRIPT[i].kind === 'product' ? 900 : 1500);
        }
        await wait(4000);
      }
    })();

    return () => {
      alive = false;
      timers.forEach(clearTimeout);
    };
  }, []);

  return (
    <div className="relative mx-auto w-[290px] rounded-[46px] bg-[#0a1730] p-2.5 shadow-[0_40px_80px_-30px_rgba(29,78,216,0.55)] sm:w-[310px]">
      <div className="absolute left-1/2 top-2.5 z-10 h-5 w-24 -translate-x-1/2 rounded-b-2xl bg-[#0a1730]" />
      <div className="overflow-hidden rounded-[38px] bg-[#efeae2]">
        <div className="flex items-center gap-2.5 border-b border-black/5 bg-[#f0f2f5] px-3.5 pb-2.5 pt-8">
          <img src={CUSTOMER} alt="" className="h-8 w-8 rounded-full object-cover" />
          <div className="leading-tight">
            <p className="text-[13px] font-semibold text-[#111b21]">Marina Souza</p>
            <p className="text-[11px] text-[#667781]">{typing ? 'Loja Aurora digitando…' : 'online'}</p>
          </div>
        </div>
        <div className="flex flex-col justify-end gap-1.5 overflow-hidden px-2.5 py-3" style={{ height }}>
          {SCRIPT.slice(0, shown).map((m, i) => (
            <Bubble key={i} m={m} />
          ))}
          {typing && (
            <div className="lp-msg flex justify-start">
              <span className="flex gap-1 rounded-2xl rounded-bl-[6px] bg-white px-3 py-3">
                <i className="lp-dot block h-1.5 w-1.5 rounded-full bg-[#8696a0]" />
                <i className="lp-dot block h-1.5 w-1.5 rounded-full bg-[#8696a0] [animation-delay:150ms]" />
                <i className="lp-dot block h-1.5 w-1.5 rounded-full bg-[#8696a0] [animation-delay:300ms]" />
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
