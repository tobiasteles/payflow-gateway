import type { PaymentMode } from './types';

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);

/** Domingo de Páscoa (Meeus/Jones/Butcher), em UTC. */
export function easterSunday(year: number): Date {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

/** Feriados nacionais: fixos + Carnaval, Sexta-feira Santa e Corpus Christi. */
export function brazilianHolidays(year: number): Set<string> {
  const fixed = ['01-01', '04-21', '05-01', '09-07', '10-12', '11-02', '11-15', '11-20', '12-25'];
  const easter = easterSunday(year);
  return new Set([
    ...fixed.map((md) => `${year}-${md}`),
    iso(addDays(easter, -48)), iso(addDays(easter, -47)), // Carnaval
    iso(addDays(easter, -2)), // Sexta-feira Santa
    iso(addDays(easter, 60)), // Corpus Christi
  ]);
}

export function isBusinessDay(d: Date): boolean {
  const dow = d.getUTCDay();
  return dow !== 0 && dow !== 6 && !brazilianHolidays(d.getUTCFullYear()).has(iso(d));
}

export function nextBusinessDay(d: Date): Date {
  let cur = d;
  while (!isBusinessDay(cur)) cur = addDays(cur, 1);
  return cur;
}

/** Instante → dia civil de Brasília (UTC-3, sem horário de verão desde 2019). */
function brasiliaDay(date: Date): Date {
  const l = new Date(date.getTime() - 3 * 3_600_000);
  return new Date(Date.UTC(l.getUTCFullYear(), l.getUTCMonth(), l.getUTCDate()));
}

export interface PayoutInput {
  mode: PaymentMode;
  capturedAt?: Date; // padrão: agora (compatível com vi.setSystemTime)
  installment?: number; // 1..n, só para crédito parcelado
}

/** Débito D+1; crédito D+30; parcela n: D+30·n. Fim de semana/feriado → próximo dia útil. */
export function schedulePayout({ mode, capturedAt = new Date(), installment = 1 }: PayoutInput): string {
  const days = mode === 'debit' ? 1 : 30 * installment;
  return iso(nextBusinessDay(addDays(brasiliaDay(capturedAt), days)));
}

export function installmentSchedule(installments: number, capturedAt = new Date()): string[] {
  return Array.from({ length: installments }, (_, i) =>
    schedulePayout({ mode: 'credit_installments', capturedAt, installment: i + 1 }),
  );
}
