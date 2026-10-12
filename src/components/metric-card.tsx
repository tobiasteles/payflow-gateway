export function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return <svg aria-hidden viewBox="0 0 100 28" className="h-7 w-full" />;
  const min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
  const pts = values
    .map((v, i) => `${(i / (values.length - 1)) * 100},${26 - ((v - min) / span) * 24}`)
    .join(' ');
  return (
    <svg aria-hidden viewBox="0 0 100 28" preserveAspectRatio="none" className="h-7 w-full">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

interface Props { label: string; value: string; series: number[]; color: string; hint?: string }

export function MetricCard({ label, value, series, color, hint }: Props) {
  return (
    <section aria-label={label} className="rounded-xl border border-subtle bg-surface p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-2 font-mono text-2xl font-semibold tracking-tight" data-testid={`metric-${label}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
      <div className="mt-4"><Sparkline values={series} color={color} /></div>
    </section>
  );
}
