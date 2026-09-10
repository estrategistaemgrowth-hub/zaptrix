const BASE_URL = process.env.EVOLUTION_API_URL!;
const API_KEY = process.env.EVOLUTION_API_KEY!;

interface CreateInstanceResponse {
  instance: { instanceName: string; instanceId: string; status: string };
  hash: string;
  qrcode?: { base64: string; code: string };
}

interface ConnectionStateResponse {
  instance: { instanceName: string; state: 'open' | 'connecting' | 'close' };
}

async function evolutionFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      apikey: API_KEY,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Evolution API ${path} falhou (${res.status}): ${body.slice(0, 300)}`);
  }

  return res.json();
}

/**
 * Cria uma instância na Evolution API compartilhada e retorna o QR code
 * para o usuário escanear. instanceName precisa ser único NA API INTEIRA
 * (compartilhada com outros produtos), por isso sempre prefixado "zaptrix-".
 */
export async function createInstance(instanceName: string): Promise<CreateInstanceResponse> {
  return evolutionFetch('/instance/create', {
    method: 'POST',
    body: JSON.stringify({
      instanceName,
      qrcode: true,
      integration: 'WHATSAPP-BAILEYS',
    }),
  });
}

export async function getConnectionState(instanceName: string): Promise<ConnectionStateResponse> {
  return evolutionFetch(`/instance/connectionState/${instanceName}`);
}

interface FetchInstanceInfo {
  ownerJid?: string | null;
}

/** Busca o número de telefone conectado (via ownerJid) — só existe depois que
 *  a instância conecta de fato; connectionState/create não trazem esse dado. */
export async function fetchInstancePhoneNumber(instanceName: string): Promise<string | null> {
  const data = (await evolutionFetch(
    `/instance/fetchInstances?instanceName=${encodeURIComponent(instanceName)}`
  )) as FetchInstanceInfo[];

  const ownerJid = data?.[0]?.ownerJid;
  if (!ownerJid) return null;

  return ownerJid.replace(/@s\.whatsapp\.net$/, '').replace(/@.*/, '');
}

/** Reconecta uma instância existente e retorna um novo QR code (ex: após logout/expirar). */
export async function reconnectInstance(instanceName: string): Promise<CreateInstanceResponse> {
  return evolutionFetch(`/instance/connect/${instanceName}`);
}

export async function deleteInstance(instanceName: string): Promise<void> {
  await evolutionFetch(`/instance/delete/${instanceName}`, { method: 'DELETE' });
}

/** Encerra a sessão do WhatsApp (logout) sem apagar a instância — o número
 *  pode ser reconectado depois escaneando um novo QR code. */
export async function logoutInstance(instanceName: string): Promise<void> {
  await evolutionFetch(`/instance/logout/${instanceName}`, { method: 'DELETE' });
}

export async function setWebhook(instanceName: string, webhookUrl: string, webhookSecret: string) {
  return evolutionFetch(`/webhook/set/${instanceName}`, {
    method: 'POST',
    body: JSON.stringify({
      webhook: {
        enabled: true,
        url: `${webhookUrl}?token=${webhookSecret}`,
        byEvents: false,
        base64: true,
        events: ['MESSAGES_UPSERT', 'MESSAGES_UPDATE'],
      },
    }),
  });
}

/** Envia uma mensagem de texto pelo número conectado da instância. */
export async function sendTextMessage(instanceName: string, number: string, text: string) {
  return evolutionFetch(`/message/sendText/${instanceName}`, {
    method: 'POST',
    body: JSON.stringify({ number, text }),
  });
}

/** Envia uma imagem por URL (sem precisar baixar/re-subir base64) — usado pela
 *  IA quando o cliente pede foto de um produto que já tem image_url salvo. */
export async function sendImageByUrl(
  instanceName: string,
  number: string,
  imageUrl: string,
  caption?: string
) {
  return evolutionFetch(`/message/sendMedia/${instanceName}`, {
    method: 'POST',
    body: JSON.stringify({
      number,
      mediatype: 'image',
      mimetype: 'image/jpeg',
      media: imageUrl,
      caption: caption ?? '',
    }),
  });
}

/** Marca a mensagem recebida como lida (check azul do WhatsApp) — best-effort,
 *  quem chama deve engolir o erro se a versão da Evolution API não suportar. */
export async function markMessageAsRead(instanceName: string, remoteJid: string, messageId: string) {
  return evolutionFetch(`/chat/markMessageAsRead/${instanceName}`, {
    // Confirmado ao vivo (2026-09-10): essa instância da Evolution API
    // responde 404 "Cannot PUT" nesse endpoint — o método correto é POST,
    // não PUT (a doc antiga/outra versão pode ter documentado diferente).
    method: 'POST',
    body: JSON.stringify({
      readMessages: [{ remoteJid, id: messageId, fromMe: false }],
    }),
  });
}

export type EvolutionMediaType = 'image' | 'audio' | 'video' | 'document';

/** Deriva a categoria de mídia da Evolution API (e do enum message_type) a partir do MIME type. */
export function mimeToMediaCategory(mimeType: string): EvolutionMediaType {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.startsWith('video/')) return 'video';
  return 'document';
}

/** Envia um arquivo de mídia (imagem, áudio, vídeo ou documento) pelo número conectado da instância. */
export async function sendMediaMessage(
  instanceName: string,
  number: string,
  mediatype: EvolutionMediaType,
  mimetype: string,
  fileName: string,
  base64: string,
  caption?: string
) {
  return evolutionFetch(`/message/sendMedia/${instanceName}`, {
    method: 'POST',
    body: JSON.stringify({
      number,
      mediatype,
      mimetype,
      fileName,
      caption: caption ?? '',
      media: base64,
    }),
  });
}

interface GetMediaBase64Response {
  base64?: string;
  mimetype?: string;
  mediaUrl?: string;
}

/**
 * Baixa uma mídia recebida (imagem/áudio/vídeo/documento/figurinha) em base64,
 * a partir do ID da mensagem do WhatsApp. Sem timeout curto propositalmente:
 * vídeos demoram bem mais que os outros tipos pra Evolution API converter, e
 * um timeout agressivo aqui derrubava o download antes de terminar.
 */
export async function getMediaBase64(
  instanceName: string,
  messageId: string,
  remoteJid: string
): Promise<{ base64: string; mimetype: string } | null> {
  const data = (await evolutionFetch(`/chat/getBase64FromMediaMessage/${instanceName}`, {
    method: 'POST',
    body: JSON.stringify({
      message: {
        key: {
          id: messageId,
          fromMe: false,
          remoteJid,
        },
      },
      convertToMp4: false,
    }),
  })) as GetMediaBase64Response;

  if (data.base64) {
    return {
      base64: data.base64.replace(/^data:[^;]+;base64,/, ''),
      mimetype: data.mimetype || 'application/octet-stream',
    };
  }

  // Algumas versões da Evolution API retornam a URL do arquivo já hospedado
  // em vez do base64 — buscamos e convertemos aqui para manter uma única
  // interface (sempre base64) para quem chama esta função.
  if (data.mediaUrl) {
    const fileRes = await fetch(data.mediaUrl);
    if (!fileRes.ok) return null;
    const buffer = Buffer.from(await fileRes.arrayBuffer());
    return {
      base64: buffer.toString('base64'),
      mimetype: data.mimetype || fileRes.headers.get('content-type') || 'application/octet-stream',
    };
  }

  return null;
}

/** Gera um nome de instância único, prefixado para isolar do resto da Evolution API compartilhada. */
export function generateInstanceName(workspaceId: string): string {
  return `zaptrix-${workspaceId.slice(0, 8)}-${Date.now().toString(36)}`;
}

export interface EvolutionHistoryRecord {
  key: { id: string; fromMe: boolean; remoteJid: string };
  pushName?: string;
  messageType?: string;
  message?: {
    conversation?: string;
    extendedTextMessage?: { text?: string };
    imageMessage?: { mimetype?: string; caption?: string };
    videoMessage?: { mimetype?: string; caption?: string };
    documentMessage?: { mimetype?: string; fileName?: string; caption?: string; title?: string };
    audioMessage?: { mimetype?: string; ptt?: boolean };
    stickerMessage?: { mimetype?: string };
  };
  messageTimestamp?: number;
  /** Histórico de status de entrega/leitura desta mensagem (confirmado ao
   *  vivo contra a instância conectada: array de `{ status: "DELIVERY_ACK" |
   *  "READ" | "SERVER_ACK" | ... }`, não necessariamente em ordem cronológica). */
  MessageUpdate?: Array<{ status?: string }>;
}

interface FindMessagesResponse {
  messages?: {
    total: number;
    pages: number;
    currentPage: number;
    records: EvolutionHistoryRecord[];
  };
}

/**
 * Busca o histórico de mensagens trocadas com um número — usado pelo botão
 * "Sincronizar" quando o cliente já conversou com a loja ANTES do webhook
 * estar ativo (essas mensagens nunca chegam ao painel sozinhas). Endpoint e
 * formato de resposta confirmados ao vivo contra a instância já conectada
 * (não é suposição de documentação).
 */
export async function findMessages(
  instanceName: string,
  phone: string,
  limit = 200
): Promise<EvolutionHistoryRecord[]> {
  const remoteJid = phone.includes('@') ? phone : `${phone}@s.whatsapp.net`;

  const data = (await evolutionFetch(`/chat/findMessages/${instanceName}`, {
    method: 'POST',
    body: JSON.stringify({
      where: { key: { remoteJid } },
      limit,
    }),
  })) as FindMessagesResponse;

  return data.messages?.records || [];
}

export type WaStatus = 'sent' | 'delivered' | 'read' | 'failed';

/**
 * Mapeia o status de entrega/leitura da Evolution API para o `wa_status`
 * simplificado usado pela UI. Formato STRING confirmado ao vivo contra a
 * instância conectada (`MessageUpdate: [{ status: "DELIVERY_ACK" }, ...]`) —
 * não é mais suposição de valor numérico do Baileys (0-5).
 */
export function mapAckToWaStatus(status: unknown): WaStatus {
  if (status === null || status === undefined) return 'failed';

  const text = String(status).toUpperCase();
  if (text.includes('ERROR') || text.includes('FAIL')) return 'failed';
  if (text.includes('READ') || text.includes('PLAYED')) return 'read';
  if (text.includes('DELIVERY_ACK') || text.includes('SERVER_ACK') || text.includes('DELIVERED')) return 'delivered';
  return 'sent';
}

/**
 * Reduz o array `MessageUpdate` de uma mensagem histórica (vindo de
 * `findMessages`) para um único `wa_status` final — usa o estágio mais
 * avançado presente no array (lido > entregue > enviado), já que a ordem dos
 * itens não é garantidamente cronológica.
 */
export function reduceWaStatusFromUpdates(updates?: Array<{ status?: string }>): WaStatus {
  if (!updates || updates.length === 0) return 'sent';

  const mapped = updates.map((u) => mapAckToWaStatus(u?.status));
  if (mapped.includes('read')) return 'read';
  if (mapped.includes('delivered')) return 'delivered';
  if (mapped.every((s) => s === 'failed')) return 'failed';
  return 'sent';
}
