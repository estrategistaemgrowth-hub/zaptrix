/**
 * Cliente da API do Asaas (cobrança/assinatura) — mesmo padrão de
 * `lib/evolution-api.ts`: uma função fina por endpoint, erro sempre lançado
 * com o corpo da resposta pra facilitar diagnóstico.
 *
 * Precisa de ASAAS_API_KEY no ambiente (produção: conta real no Asaas;
 * sandbox: https://sandbox.asaas.com, mesma API). Sem a chave configurada,
 * `isAsaasConfigured()` retorna false e quem chama deve degradar
 * graciosamente (esconder a opção de cobrança automática, nunca quebrar).
 */

const BASE_URL = process.env.ASAAS_API_URL || 'https://api.asaas.com/v3';
const API_KEY = process.env.ASAAS_API_KEY;

export function isAsaasConfigured(): boolean {
  return Boolean(API_KEY);
}

async function asaasFetch(path: string, options: RequestInit = {}) {
  if (!API_KEY) {
    throw new Error('ASAAS_API_KEY não configurada.');
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      access_token: API_KEY,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Asaas ${path} falhou (${res.status}): ${body.slice(0, 300)}`);
  }

  return res.json();
}

export interface AsaasCustomer {
  id: string;
  name: string;
  email: string | null;
  cpfCnpj: string;
}

export async function createAsaasCustomer(name: string, cpfCnpj: string, email: string): Promise<AsaasCustomer> {
  return asaasFetch('/customers', {
    method: 'POST',
    body: JSON.stringify({ name, cpfCnpj, email }),
  });
}

export interface AsaasPayment {
  id: string;
  status: string;
  value: number;
  dueDate: string;
  invoiceUrl: string;
}

export async function createAsaasPayment(params: {
  customerId: string;
  value: number;
  dueDate: string; // "YYYY-MM-DD"
  description: string;
  externalReference: string; // usamos o id da fatura interna, pra casar no webhook
}): Promise<AsaasPayment> {
  return asaasFetch('/payments', {
    method: 'POST',
    body: JSON.stringify({
      customer: params.customerId,
      billingType: 'PIX',
      value: params.value,
      dueDate: params.dueDate,
      description: params.description,
      externalReference: params.externalReference,
    }),
  });
}

export interface AsaasPixQrCode {
  encodedImage: string; // base64 PNG, sem prefixo data:
  payload: string; // "PIX copia e cola"
  expirationDate: string | null;
}

export async function getAsaasPixQrCode(paymentId: string): Promise<AsaasPixQrCode> {
  return asaasFetch(`/payments/${paymentId}/pixQrCode`);
}
