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

/** Gera um nome de instância único, prefixado para isolar do resto da Evolution API compartilhada. */
export function generateInstanceName(workspaceId: string): string {
  return `zaptrix-${workspaceId.slice(0, 8)}-${Date.now().toString(36)}`;
}
