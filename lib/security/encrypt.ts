import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';

function getKey(): Buffer {
  const key = process.env.APP_ENCRYPTION_KEY;
  if (!key) throw new Error('APP_ENCRYPTION_KEY não configurada');
  return Buffer.from(key, 'base64');
}

/** Criptografa um segredo (ex: API key de LLM) para armazenar no banco. */
export function encryptSecret(plainText: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [iv.toString('base64'), authTag.toString('base64'), encrypted.toString('base64')].join('.');
}

/** Descriptografa um segredo salvo por encryptSecret. Uso server-side apenas. */
export function decryptSecret(payload: string): string {
  const [ivB64, authTagB64, dataB64] = payload.split('.');
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');
  const data = Buffer.from(dataB64, 'base64');

  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);

  return decrypted.toString('utf8');
}

/** Últimos 4 caracteres da chave, para exibir sem revelar o valor completo. */
export function maskKey(plainText: string): string {
  const visible = plainText.slice(-4);
  return `••••••••${visible}`;
}
