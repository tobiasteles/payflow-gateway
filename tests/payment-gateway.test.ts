import { describe, expect, it, test, vi } from 'vitest';
import { AcquirerError, PaymentGatewayService } from '@/lib/payment-gateway';
import type { ChargeRequest } from '@/lib/types';

const req: ChargeRequest = { amountCents: 10000, brand: 'visa', mode: 'credit', installments: 1 };
const ok = () => new Response(JSON.stringify({ status: 'approved', authorizationCode: 'A1B2C3' }), { status: 200 });
const make = (fetchFn: ReturnType<typeof vi.fn>, extra = {}) => {
  const sleep = vi.fn().mockResolvedValue(undefined);
  return { sleep, svc: new PaymentGatewayService({ baseUrl: 'https://acq.test', fetchFn, sleep, maxRetries: 3, baseDelayMs: 200, ...extra }) };
};

describe('PaymentGatewayService', () => {
  it('aprova na primeira tentativa e envia a Idempotency-Key', async () => {
    const fetchFn = vi.fn().mockResolvedValue(ok());
    const { svc } = make(fetchFn);
    const res = await svc.charge(req, 'key-1');
    expect(res).toMatchObject({ status: 'approved', attempts: 1 });
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe('https://acq.test/v1/charges');
    expect(init.headers['Idempotency-Key']).toBe('key-1');
  });

  it('retenta com backoff exponencial após 503', async () => {
    const fetchFn = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(ok());
    const onRetry = vi.fn();
    const { svc, sleep } = make(fetchFn, { onRetry });
    const res = await svc.charge(req);
    expect(res.attempts).toBe(3);
    expect(sleep.mock.calls.map((c) => c[0])).toEqual([200, 400]);
    expect(onRetry).toHaveBeenCalledTimes(2);
  });

  test.each([400, 401, 422])('não retenta erro de cliente (%i)', async (status) => {
    const fetchFn = vi.fn().mockResolvedValue(new Response(null, { status }));
    const { svc, sleep } = make(fetchFn);
    await expect(svc.charge(req)).rejects.toBeInstanceOf(AcquirerError);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('desiste após esgotar as tentativas', async () => {
    const fetchFn = vi.fn().mockImplementation(async () => new Response(null, { status: 503 }));
    const { svc } = make(fetchFn, { maxRetries: 2 });
    await expect(svc.charge(req)).rejects.toThrow(/3 tentativas/);
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });

  it('trata falha de rede como retentável', async () => {
    const fetchFn = vi.fn().mockRejectedValueOnce(new TypeError('fetch failed')).mockResolvedValueOnce(ok());
    const { svc } = make(fetchFn);
    await expect(svc.charge(req)).resolves.toMatchObject({ attempts: 2 });
  });

  it('dá timeout quando a adquirente não responde (timers falsos)', async () => {
    vi.useFakeTimers();
    const fetchFn = vi.fn().mockImplementation(() => new Promise(() => {})); // nunca resolve
    const { svc } = make(fetchFn, { timeoutMs: 1000, maxRetries: 1 });
    const assertion = expect(svc.charge(req)).rejects.toThrow(/2 tentativas.*Timeout/);
    await vi.advanceTimersByTimeAsync(5000);
    await assertion;
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('usa o fetch global por padrão (vi.spyOn)', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(ok());
    const svc = new PaymentGatewayService({ baseUrl: 'https://acq.test' });
    await svc.charge(req);
    expect(spy).toHaveBeenCalledOnce();
  });
});
