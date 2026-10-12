import type { TxStatus } from '@/lib/types';

const STYLES: Record<TxStatus, { label: string; cls: string; pulse?: boolean }> = {
  approved: { label: 'Aprovado', cls: 'border-positive/30 bg-positive/10 text-positive' },
  processing: { label: 'Processando', cls: 'border-warn/30 bg-warn/10 text-warn', pulse: true },
  retrying: { label: 'Retentando...', cls: 'border-primary/40 bg-primary/10 text-indigo-300', pulse: true },
  failed: { label: 'Falhou', cls: 'border-danger/30 bg-danger/10 text-danger' },
  refunded: { label: 'Estornado', cls: 'border-danger/30 bg-danger/10 text-danger' },
};

export function StatusBadge({ status }: { status: TxStatus }) {
  const s = STYLES[status];
  return (
    <span
      role="status"
      className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium backdrop-blur-md ${s.cls}`}
    >
      <span
        aria-hidden
        className={`h-1.5 w-1.5 rounded-full bg-current shadow-[0_0_8px_currentColor] ${s.pulse ? 'animate-pulse' : ''}`}
      />
      {s.label}
    </span>
  );
}
