import { createHmac, timingSafeEqual } from 'node:crypto';
import type { FetchLike } from './payment-gateway';

export interface WebhookEvent { id: string; type: string; data: unknown }
export interface DispatchResult { delivered: boolean; status?: number; error?: string }

export function signPayload(body: string, secret: string, timestamp: number): string {
  return createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
}

/** Valida `t=<segundos>,v1=<hex>` em tempo constante e com janela anti-replay. */
export function verifySignature(
  body: string, secret: string, header: string, toleranceSec = 300, nowMs = Date.now(),
): boolean {
  const parts = Object.fromEntries(header.split(',').map((p) => p.split('=') as [string, string]));
  const t = Number(parts.t);
  if (!Number.isFinite(t) || !parts.v1) return false;
  if (Math.abs(nowMs / 1000 - t) > toleranceSec) return false;
  const expected = Buffer.from(signPayload(body, secret, t), 'hex');
  const given = Buffer.from(parts.v1, 'hex');
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export class WebhookDispatcher {
  private secret: string;
  private fetchFn: FetchLike;

  constructor({ secret, fetchFn }: { secret: string; fetchFn?: FetchLike }) {
    this.secret = secret;
    this.fetchFn = fetchFn ?? ((url, init) => fetch(url, init));
  }

  async dispatch(url: string, event: WebhookEvent): Promise<DispatchResult> {
    const body = JSON.stringify(event);
    const timestamp = Math.floor(Date.now() / 1000);
    try {
      const res = await this.fetchFn(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Gateway-Event': event.type,
          'X-Gateway-Signature': `t=${timestamp},v1=${signPayload(body, this.secret, timestamp)}`,
        },
        body,
      });
      return { delivered: res.ok, status: res.status };
    } catch (err) {
      return { delivered: false, error: (err as Error).message };
    }
  }
}
