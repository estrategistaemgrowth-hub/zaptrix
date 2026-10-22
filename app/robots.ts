import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/landing-plans';

// Área logada fica fora do índice; LP, assinatura e llms.txt ficam abertos,
// inclusive pros robôs de IA (busca e assistentes).
const PRIVATE = ['/dashboard', '/atendimento', '/configuracoes', '/conhecimento', '/contatos', '/ia', '/produtos', '/whatsapp', '/master', '/onboarding', '/api/'];
const AI_BOTS = ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-SearchBot', 'Claude-User', 'PerplexityBot', 'Google-Extended', 'Applebot-Extended', 'Bingbot'];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: PRIVATE },
      { userAgent: AI_BOTS, allow: ['/', '/llms.txt'], disallow: PRIVATE },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
