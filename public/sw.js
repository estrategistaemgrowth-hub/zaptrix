// Service worker mínimo — existe só pra satisfazer o critério de
// instalabilidade do Chrome (manifest + service worker registrado com um
// listener de fetch). De propósito, NÃO faz cache agressivo: o Zaptrix é um
// painel de dados que muda o tempo todo (mensagens, conversas, produtos) —
// cache aqui deixaria a tela desatualizada. Deixa tudo passar direto pra rede.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
