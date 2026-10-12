import type { Charge } from './types';
import { calculateNet } from './fee-calculator';
import { schedulePayout } from './payout-scheduler';

const rows: Array<[string, number, Charge['brand'], Charge['mode'], number, Charge['status'], string]> = [
  ['ch_8F3K2A1X', 24990, 'visa', 'credit', 1, 'approved', '2026-10-05T13:02:00Z'],
  ['ch_2M9QW7ZD', 8900, 'elo', 'debit', 1, 'approved', '2026-10-06T16:40:00Z'],
  ['ch_7TB4N0CE', 129900, 'mastercard', 'credit_installments', 6, 'approved', '2026-10-07T12:15:00Z'],
  ['ch_L51RX8PV', 4590, 'visa', 'debit', 1, 'failed', '2026-10-08T19:20:00Z'],
  ['ch_Q0D6H3YJ', 59900, 'visa', 'credit_installments', 3, 'approved', '2026-10-09T14:55:00Z'],
  ['ch_V8C2U5KM', 15000, 'elo', 'credit', 1, 'refunded', '2026-10-10T11:30:00Z'],
  ['ch_N4A7S1BG', 32500, 'mastercard', 'debit', 1, 'approved', '2026-10-11T17:48:00Z'],
  ['ch_E9Z3F6RT', 78000, 'visa', 'credit', 1, 'processing', '2026-10-12T10:05:00Z'],
];

export function seedCharges(): Charge[] {
  return rows
    .map(([id, amountCents, brand, mode, installments, status, createdAt]) => {
      const fee = calculateNet({ amountCents, brand, mode, installments });
      return {
        id, amountCents, brand, mode, installments, status, createdAt,
        mdrCents: fee.mdrCents, netCents: fee.netCents,
        payoutDate: schedulePayout({ mode, capturedAt: new Date(createdAt) }),
      } satisfies Charge;
    })
    .reverse();
}
