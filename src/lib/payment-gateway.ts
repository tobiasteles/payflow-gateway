import type { ChargeRequest } from './types';

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export class AcquirerError extends Error {
  constructor(message: string, public status?: number, public retryable = false) {
    super(message);
    this.name = 'AcquirerError';
  }
}

export interface GatewayOptions {
  baseUrl: string;
  apiKey?: string;
  fetchFn?: FetchLike;
  maxRetries?: number; // retentativas além da primeira tentativa
  baseDelayMs?: number; // backoff exponencial: base * 2^tentativa
  timeoutMs?: number;
  sleep?: (ms: number) => Promise<void>;
  onRetry?: (info: { attempt: number; delayMs: number; reason: string }) => void;
}

export interface AcquirerResponse {
  status: 'approved' | 'declined';
  authorizationCode?: string;
  attempts: number;
}

export class PaymentGatewayService {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly fetchFn: FetchLike;
  private readonly maxRetries: number;
  private readonly baseDelayMs: number;
  private readonly timeoutMs: number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly onRetry?: GatewayOptions['onRetry'];

  constructor(o: GatewayOptions) {
    this.baseUrl = o.baseUrl;
    this.apiKey = o.apiKey;
    // resolvido na chamada, para que vi.spyOn(globalThis, 'fetch') funcione
    this.fetchFn = o.fetchFn ?? ((url, init) => fetch(url, init));
    this.maxRetries = o.maxRetries ?? 3;
    this.baseDelayMs = o.baseDelayMs ?? 200;
    this.timeoutMs = o.timeoutMs ?? 5000;
    this.sleep = o.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.onRetry = o.onRetry;
  }

  async charge(req: ChargeRequest, idempotencyKey?: string): Promise<AcquirerResponse> {
    let last: AcquirerError | undefined;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const res = await this.request(req, idempotencyKey);
        if (res.ok) {
          const body = (await res.json()) as Omit<AcquirerResponse, 'attempts'>;
          return { ...body, attempts: attempt + 1 };
        }
        throw new AcquirerError(`Adquirente respondeu ${res.status}`, res.status, res.status >= 500 || res.status === 429);
      } catch (err) {
        last = err instanceof AcquirerError ? err : new AcquirerError((err as Error).message, undefined, true);
        if (!last.retryable) throw last;
        if (attempt < this.maxRetries) {
          const delayMs = this.baseDelayMs * 2 ** attempt;
          this.onRetry?.({ attempt: attempt + 1, delayMs, reason: last.message });
          await this.sleep(delayMs);
        }
      }
    }
    throw new AcquirerError(`Falha após ${this.maxRetries + 1} tentativas: ${last?.message}`, last?.status, false);
  }

  private async request(req: ChargeRequest, idempotencyKey?: string): Promise<Response> {
    const ctrl = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        ctrl.abort();
        reject(new AcquirerError(`Timeout após ${this.timeoutMs}ms`, undefined, true));
      }, this.timeoutMs);
    });
    try {
      return await Promise.race([
        this.fetchFn(`${this.baseUrl}/v1/charges`, {
          method: 'POST',
          signal: ctrl.signal,
          headers: {
            'Content-Type': 'application/json',
            ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
            ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
          },
          body: JSON.stringify(req),
        }),
        timeout,
      ]);
    } finally {
      clearTimeout(timer);
    }
  }
}

/** Adquirente fictício para a demo: ~20% de 503 para exercitar as retentativas. */
export const simulatedAcquirer: FetchLike = async () => {
  await new Promise((r) => setTimeout(r, 120));
  if (Math.random() < 0.2) return new Response(null, { status: 503 });
  return new Response(
    JSON.stringify({ status: 'approved', authorizationCode: Math.random().toString(36).slice(2, 8).toUpperCase() }),
    { status: 200 },
  );
};
