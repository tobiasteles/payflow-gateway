import type { Brand, PaymentMode } from './types';

/** Taxas em basis points (1 bp = 0,01%) e valores em centavos inteiros: nunca usamos float para dinheiro. */
const BASE_MDR_BPS: Record<Brand, { debit: number; credit: number }> = {
  visa: { debit: 150, credit: 280 },
  mastercard: { debit: 150, credit: 280 },
  elo: { debit: 180, credit: 310 },
};

export function getMdrBps(brand: Brand, mode: PaymentMode, installments = 1): number {
  const base = BASE_MDR_BPS[brand];
  if (!base) throw new RangeError(`Bandeira inválida: ${brand}`);
  if (mode === 'debit') return base.debit;
  if (mode === 'credit') return base.credit;
  if (!Number.isInteger(installments) || installments < 2 || installments > 12) {
    throw new RangeError('Parcelamento deve ter entre 2 e 12 parcelas');
  }
  return base.credit + (installments <= 6 ? 70 : 150);
}

/** cents * bps / 10000, meio-centavo arredonda para cima, só com inteiros. */
export function percentOf(cents: number, bps: number): number {
  return Math.floor((cents * bps + 5000) / 10000);
}

/** Divide `total` em n parcelas; os centavos que sobram vão para as primeiras. */
export function distribute(total: number, n: number): number[] {
  const base = Math.floor(total / n);
  const rest = total - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < rest ? 1 : 0));
}

export interface FeeInput {
  amountCents: number;
  brand: Brand;
  mode: PaymentMode;
  installments?: number;
}

export interface FeeResult {
  grossCents: number;
  mdrBps: number;
  mdrCents: number;
  netCents: number;
  installmentPlan: number[]; // líquido por parcela
}

export function calculateNet({ amountCents, brand, mode, installments = 1 }: FeeInput): FeeResult {
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new RangeError('amountCents deve ser um inteiro positivo');
  }
  const n = mode === 'credit_installments' ? installments : 1;
  const mdrBps = getMdrBps(brand, mode, n);
  const mdrCents = percentOf(amountCents, mdrBps);
  const netCents = amountCents - mdrCents;
  return { grossCents: amountCents, mdrBps, mdrCents, netCents, installmentPlan: distribute(netCents, n) };
}

export interface SplitRule { recipientId: string; bps: number }
export interface SplitResult { recipientId: string; amountCents: number }

/** Split pelo método do maior resto: a soma das partes é sempre exatamente `netCents`. */
export function splitPayment(netCents: number, rules: SplitRule[]): SplitResult[] {
  if (rules.reduce((s, r) => s + r.bps, 0) !== 10000) {
    throw new RangeError('A soma dos splits deve ser exatamente 100% (10000 bps)');
  }
  const parts = rules.map((r, index) => ({
    index, id: r.recipientId,
    floor: Math.floor((netCents * r.bps) / 10000),
    remainder: (netCents * r.bps) % 10000,
  }));
  let leftover = netCents - parts.reduce((s, p) => s + p.floor, 0);
  const byRemainder = [...parts].sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  for (const p of byRemainder) {
    if (leftover-- <= 0) break;
    p.floor += 1;
  }
  return parts.map((p) => ({ recipientId: p.id, amountCents: p.floor }));
}
