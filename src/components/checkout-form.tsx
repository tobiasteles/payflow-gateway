'use client';
import { useMemo, useState } from 'react';
import { CreditCard } from 'lucide-react';
import { calculateNet } from '@/lib/fee-calculator';
import { formatBRL, formatBps, parseBRLToCents } from '@/lib/format';
import type { Brand, ChargeRequest, PaymentMode } from '@/lib/types';

const field = 'mt-1.5 w-full rounded-lg border border-subtle bg-canvas px-3 py-2.5 text-sm text-fg placeholder:text-muted/60';

export function CheckoutForm({ onSubmit, busy = false }: { onSubmit: (req: ChargeRequest) => void; busy?: boolean }) {
  const [amount, setAmount] = useState('');
  const [brand, setBrand] = useState<Brand>('visa');
  const [mode, setMode] = useState<PaymentMode>('credit');
  const [installments, setInstallments] = useState(3);
  const [error, setError] = useState<string | null>(null);

  const cents = parseBRLToCents(amount);
  const preview = useMemo(
    () => (cents && cents > 0 ? calculateNet({ amountCents: cents, brand, mode, installments }) : null),
    [cents, brand, mode, installments],
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!cents || cents <= 0) return setError('Informe um valor maior que zero, por exemplo 150,00.');
    setError(null);
    onSubmit({ amountCents: cents, brand, mode, installments: mode === 'credit_installments' ? installments : 1 });
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-subtle bg-surface p-5" noValidate>
      <h2 className="flex items-center gap-2 text-base font-semibold"><CreditCard size={18} className="text-primary" /> Nova cobrança</h2>

      <label className="mt-5 block text-sm text-muted">
        Valor (R$)
        <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="150,00"
          className={`${field} font-mono`} aria-invalid={!!error} />
      </label>
      {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}

      <div className="mt-4 grid grid-cols-2 gap-3">
        <label className="block text-sm text-muted">
          Bandeira
          <select value={brand} onChange={(e) => setBrand(e.target.value as Brand)} className={field}>
            <option value="visa">Visa</option><option value="mastercard">Mastercard</option><option value="elo">Elo</option>
          </select>
        </label>
        <label className="block text-sm text-muted">
          Modalidade
          <select value={mode} onChange={(e) => setMode(e.target.value as PaymentMode)} className={field}>
            <option value="debit">Débito</option><option value="credit">Crédito à vista</option>
            <option value="credit_installments">Crédito parcelado</option>
          </select>
        </label>
      </div>

      {mode === 'credit_installments' && (
        <label className="mt-4 block text-sm text-muted">
          Parcelas
          <select value={installments} onChange={(e) => setInstallments(Number(e.target.value))} className={field}>
            {Array.from({ length: 11 }, (_, i) => i + 2).map((n) => <option key={n} value={n}>{n}x</option>)}
          </select>
        </label>
      )}

      <dl className="mt-5 space-y-2 rounded-lg border border-subtle bg-canvas p-3 font-mono text-sm" aria-label="Prévia de taxas">
        <div className="flex justify-between"><dt className="text-muted">Taxa (MDR)</dt>
          <dd>{preview ? `${formatBps(preview.mdrBps)} · ${formatBRL(preview.mdrCents)}` : '—'}</dd></div>
        <div className="flex justify-between"><dt className="text-muted">Você recebe</dt>
          <dd className="text-positive">{preview ? formatBRL(preview.netCents) : '—'}</dd></div>
      </dl>

      <button type="submit" disabled={busy}
        className="mt-5 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-60">
        {busy ? 'Cobrando...' : 'Cobrar'}
      </button>
    </form>
  );
}
