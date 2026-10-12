'use client';
import { useMemo, useRef, useState } from 'react';
import { Activity } from 'lucide-react';
import { seedCharges } from '@/lib/demo-data';
import { formatBRL } from '@/lib/format';
import type { Charge, ChargeRequest } from '@/lib/types';
import { CheckoutForm } from './checkout-form';
import { LogTerminal, type LogLine } from './log-terminal';
import { MetricCard } from './metric-card';
import { StatementTable } from './statement-table';

export async function postCharge(req: ChargeRequest): Promise<Charge> {
  const res = await fetch('/api/charges', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify(req),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data as Charge;
}

interface Props { createCharge?: (req: ChargeRequest) => Promise<Charge>; initialCharges?: Charge[] }

const cumulative = (xs: number[]) => xs.reduce<number[]>((acc, x) => [...acc, (acc.at(-1) ?? 0) + x], []);

export function Dashboard({ createCharge = postCharge, initialCharges }: Props) {
  const [charges, setCharges] = useState<Charge[]>(() => initialCharges ?? seedCharges());
  const [busy, setBusy] = useState(false);
  const nextId = useRef(2);
  const stamp = () => new Date().toLocaleTimeString('pt-BR', { hour12: false });
  const [logs, setLogs] = useState<LogLine[]>([
    { id: 1, ts: stamp(), level: 'info', text: 'gateway online · aguardando cobranças' },
  ]);
  const log = (level: LogLine['level'], text: string) =>
    setLogs((l) => [...l, { id: nextId.current++, ts: stamp(), level, text }]);

  const m = useMemo(() => {
    const asc = [...charges].reverse();
    const ok = asc.filter((c) => c.status === 'approved');
    return {
      tpv: ok.reduce((s, c) => s + c.amountCents, 0),
      rate: asc.length ? (ok.length / asc.length) * 100 : 0,
      balance: ok.reduce((s, c) => s + c.netCents, 0),
      tpvSeries: cumulative(ok.map((c) => c.amountCents)),
      rateSeries: asc.map((_, i) => (asc.slice(0, i + 1).filter((c) => c.status === 'approved').length / (i + 1)) * 100),
      balanceSeries: cumulative(ok.map((c) => c.netCents)),
    };
  }, [charges]);

  async function handleSubmit(req: ChargeRequest) {
    setBusy(true);
    log('info', `POST /api/charges ${req.brand}/${req.mode} ${formatBRL(req.amountCents)}`);
    try {
      const charge = await createCharge(req);
      setCharges((c) => [charge, ...c]);
      log(charge.status === 'approved' ? 'ok' : 'warn', `${charge.id} → ${charge.status} · repasse ${charge.payoutDate}`);
      log('event', `evento charge.${charge.status} emitido`);
    } catch (e) {
      log('error', `cobrança recusada: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-subtle">
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-6 py-4">
          <Activity size={18} className="text-primary" />
          <h1 className="text-sm font-semibold">PayFlow</h1>
          <span className="text-sm text-muted">Gateway e conciliação</span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 px-6 py-6">
        <div className="grid gap-4 md:grid-cols-3">
          <MetricCard label="Volume transacionado (TPV)" value={formatBRL(m.tpv)} series={m.tpvSeries} color="#6366F1" />
          <MetricCard label="Taxa de aprovação" value={`${m.rate.toFixed(1).replace('.', ',')}%`} series={m.rateSeries} color="#10B981" />
          <MetricCard label="Saldo acumulado" value={formatBRL(m.balance)} series={m.balanceSeries} color="#10B981" hint="Líquido das cobranças aprovadas" />
        </div>
        <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
          <CheckoutForm onSubmit={handleSubmit} busy={busy} />
          <StatementTable charges={charges} />
        </div>
      </main>

      <LogTerminal lines={logs} />
    </div>
  );
}
