import { createAdminClient } from '@/lib/supabase/admin';
import { decryptSecret } from '@/lib/security/encrypt';

type AdminClient = ReturnType<typeof createAdminClient>;

const GROQ_TRANSCRIBE_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';
const OPENAI_TRANSCRIBE_URL = 'https://api.openai.com/v1/audio/transcriptions';

/** WhatsApp/Baileys manda áudio quase sempre como audio/ogg (codec opus). */
function extensionForMime(mimeType: string): string {
  if (mimeType.includes('ogg')) return 'ogg';
  if (mimeType.includes('mp3') || mimeType.includes('mpeg')) return 'mp3';
  if (mimeType.includes('mp4') || mimeType.includes('m4a') || mimeType.includes('aac')) return 'm4a';
  if (mimeType.includes('wav')) return 'wav';
  if (mimeType.includes('webm')) return 'webm';
  return 'ogg';
}

async function transcribeWithProvider(
  url: string,
  apiKey: string,
  model: string,
  audioBuffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<string | null> {
  const form = new FormData();
  // Uint8Array.from() garante um ArrayBuffer "puro" por trás — o buffer de um
  // Buffer do Node é tipado como ArrayBufferLike (inclui SharedArrayBuffer),
  // o que o TS não aceita diretamente como BlobPart.
  form.append('file', new Blob([Uint8Array.from(audioBuffer)], { type: mimeType }), fileName);
  form.append('model', model);

  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    console.error(`[transcription] provedor retornou ${res.status}: ${detail.slice(0, 300)}`);
    return null;
  }

  const data = (await res.json().catch(() => null)) as { text?: string } | null;
  return data?.text?.trim() || null;
}

/**
 * Transcreve um áudio recebido pelo WhatsApp usando as credenciais de LLM do
 * workspace. Prioriza Groq (Whisper mais barato/rápido) e cai para OpenAI se
 * não houver credencial Groq habilitada. anthropic/gemini não têm Whisper —
 * se só existirem credenciais desses providers, retorna null sem transcrever.
 *
 * Best-effort: NUNCA lança erro. Qualquer falha (sem credencial, chamada com
 * erro, resposta inesperada) apenas loga e retorna null, para nunca travar o
 * fluxo de recebimento de mensagem por causa da transcrição.
 */
export async function transcribeAudio(
  base64Audio: string,
  mimeType: string,
  workspaceId: string,
  admin: AdminClient
): Promise<string | null> {
  try {
    const { data: credentials } = await admin
      .from('llm_credentials')
      .select('provider, encrypted_api_key')
      .eq('workspace_id', workspaceId)
      .eq('enabled', true);

    if (!credentials || credentials.length === 0) return null;

    const groqCredential = credentials.find((c: { provider: string }) => c.provider === 'groq');
    const openaiCredential = credentials.find((c: { provider: string }) => c.provider === 'openai');
    const credential = groqCredential || openaiCredential;

    if (!credential) return null;

    const apiKey = decryptSecret(credential.encrypted_api_key);
    const audioBuffer = Buffer.from(base64Audio, 'base64');
    const fileName = `audio.${extensionForMime(mimeType)}`;

    if (credential.provider === 'groq') {
      return await transcribeWithProvider(
        GROQ_TRANSCRIBE_URL,
        apiKey,
        'whisper-large-v3-turbo',
        audioBuffer,
        fileName,
        mimeType
      );
    }

    return await transcribeWithProvider(
      OPENAI_TRANSCRIBE_URL,
      apiKey,
      'whisper-1',
      audioBuffer,
      fileName,
      mimeType
    );
  } catch (error) {
    console.error('[transcription] falhou:', error);
    return null;
  }
}
