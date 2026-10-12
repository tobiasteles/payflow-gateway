import { NextResponse } from 'next/server';
import { calculateNet } from '@/lib/fee-calculator';
import { IdempotencyConflictError, IdempotencyService } from '@/lib/idempotency';
import { AcquirerError, PaymentGatewayService, simulatedAcquirer } from '@/lib/payment-gateway';
import { schedulePayout } from '@/lib/payout-scheduler';
import type { Charge, ChargeRequest } from '@/lib/types';
import { WebhookDispatcher } from '@/lib/webhook-dispatcher';

const idempotency = new IdempotencyService<Charge>();
const gateway = new PaymentGatewayService({ baseUrl: 'https://sandbox.acquirer.local', fetchFn: simulatedAcquirer });
const webhooks = new WebhookDispatcher({ secret: process.env.WEBHOOK_SECRET ?? 'dev-secret' });

export async function POST(req: Request) {
  const key = req.headers.get('Idempotency-Key');
  if (!key) return NextResponse.json({ error: 'Header Idempotency-Key é obrigatório' }, { status: 400 });

  const body = (await req.json()) as ChargeRequest;
  try {
    const { response, replayed } = await idempotency.run(key, body, async () => {
      const fee = calculateNet(body);
      const acquirer = await gateway.charge(body, key);
      const charge: Charge = {
        ...body,
        id: `ch_${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
        status: acquirer.status === 'approved' ? 'approved' : 'failed',
        mdrCents: fee.mdrCents,
        netCents: fee.netCents,
        payoutDate: schedulePayout({ mode: body.mode }),
        createdAt: new Date().toISOString(),
      };
      if (process.env.WEBHOOK_URL) {
        await webhooks.dispatch(process.env.WEBHOOK_URL, { id: charge.id, type: `charge.${charge.status}`, data: charge });
      }
      return charge;
    });
    return NextResponse.json(response, { status: replayed ? 200 : 201, headers: { 'Idempotent-Replayed': String(replayed) } });
  } catch (err) {
    if (err instanceof IdempotencyConflictError) return NextResponse.json({ error: err.message }, { status: 409 });
    if (err instanceof RangeError) return NextResponse.json({ error: err.message }, { status: 422 });
    if (err instanceof AcquirerError) return NextResponse.json({ error: err.message }, { status: 502 });
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
