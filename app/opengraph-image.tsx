import { ImageResponse } from 'next/og';

export const alt = 'Zaptrix — seu catálogo vendendo no WhatsApp com IA';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 72,
          color: '#fff',
          background:
            'radial-gradient(circle at 100% 0%, rgba(34,211,238,.45), transparent 55%), linear-gradient(135deg, #0a1730 0%, #0f2a5c 50%, #14306f 100%)',
        }}
      >
        <div style={{ display: 'flex', fontSize: 40, fontWeight: 800 }}>Zaptrix</div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 68, fontWeight: 800, lineHeight: 1.05, maxWidth: 950 }}>
            Seu catálogo vendendo no WhatsApp, até de madrugada.
          </div>
          <div style={{ marginTop: 24, fontSize: 30, color: 'rgba(255,255,255,.8)' }}>
            IA que responde, mostra a foto e manda o link de pagamento · 7 dias grátis
          </div>
        </div>
        <div style={{ display: 'flex', height: 10, width: 260, borderRadius: 10, background: 'linear-gradient(90deg, #22d3ee, #3b82f6, #1d4ed8)' }} />
      </div>
    ),
    size
  );
}
