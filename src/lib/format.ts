const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
export const formatBRL = (cents: number) => brl.format(cents / 100);
export const formatBps = (bps: number) => `${(bps / 100).toFixed(2).replace('.', ',')}%`;

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo',
  }).format(new Date(iso));
}
export function formatDay(day: string): string {
  const [y, m, d] = day.split('-');
  return `${d}/${m}/${y}`;
}

/** "1.234,56" → 123456, parse de string sem passar por float. null se inválido. */
export function parseBRLToCents(input: string): number | null {
  const clean = input.replace(/[^\d,]/g, '');
  if (!clean) return null;
  const segs = clean.split(',');
  if (segs.length > 2 || (segs[1] ?? '').length > 2) return null;
  return Number(segs[0] || '0') * 100 + Number((segs[1] ?? '').padEnd(2, '0') || '0');
}
