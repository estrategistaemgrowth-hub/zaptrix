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

/** Reconecta uma instância existente e retorna um novo QR code (ex: após logout/expirar). */
export async function reconnectInstance(instanceName: string): Promise<CreateInstanceResponse> {
  return evolutionFetch(`/instance/connect/${instanceName}`);
}

export async function deleteInstance(instanceName: string): Promise<void> {
  await evolutionFetch(`/instance/delete/${instanceName}`, { method: 'DELETE' });
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
        events: ['MESSAGES_UPSERT'],
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
    method: 'PUT',
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
