import { formatBRL, formatDateTime, formatDay } from '@/lib/format';
import type { Charge } from '@/lib/types';
import { StatusBadge } from './status-badge';

const MODE: Record<Charge['mode'], (n: number) => string> = {
  debit: () => 'Débito', credit: () => 'Crédito', credit_installments: (n) => `Crédito ${n}x`,
};

export function StatementTable({ charges }: { charges: Charge[] }) {
  return (
    <div className="rounded-xl border border-subtle bg-surface">
      <h2 className="px-5 pt-5 text-base font-semibold">Extrato</h2>
      {charges.length === 0 ? (
        <p className="p-5 text-sm text-muted">Nenhuma cobrança ainda. Crie a primeira ao lado.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-xs text-muted">
              <tr className="border-b border-subtle">
                {['ID', 'Data', 'Meio', 'Bruto', 'Taxa', 'Líquido', 'Repasse', 'Status'].map((h) => (
                  <th key={h} scope="col" className="px-5 py-2.5 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="font-mono">
              {charges.map((c) => (
                <tr key={c.id} className="border-b border-subtle/50 last:border-0 hover:bg-white/[0.02]">
                  <td className="px-5 py-3 text-indigo-300">{c.id}</td>
                  <td className="px-5 py-3 text-muted">{formatDateTime(c.createdAt)}</td>
                  <td className="px-5 py-3 font-sans capitalize">{c.brand} · {MODE[c.mode](c.installments)}</td>
                  <td className="px-5 py-3 text-right">{formatBRL(c.amountCents)}</td>
                  <td className="px-5 py-3 text-right text-muted">−{formatBRL(c.mdrCents)}</td>
                  <td className="px-5 py-3 text-right text-positive">{formatBRL(c.netCents)}</td>
                  <td className="px-5 py-3 text-muted">{formatDay(c.payoutDate)}</td>
                  <td className="px-5 py-3 font-sans"><StatusBadge status={c.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
