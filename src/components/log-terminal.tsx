'use client';
import { useEffect, useRef } from 'react';

export interface LogLine { id: number; ts: string; level: 'info' | 'ok' | 'warn' | 'error' | 'event'; text: string }

const COLOR: Record<LogLine['level'], string> = {
  info: 'text-muted', ok: 'text-positive', warn: 'text-warn', error: 'text-danger', event: 'text-indigo-300',
};

export function LogTerminal({ lines }: { lines: LogLine[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [lines.length]);

  return (
    <section aria-label="Terminal de logs" className="sticky bottom-0 border-t border-subtle bg-[#05080F]">
      <div ref={ref} role="log" aria-live="polite" className="mx-auto h-44 max-w-7xl overflow-y-auto px-6 py-3 font-mono text-xs leading-6">
        {lines.map((l) => (
          <div key={l.id} className="flex gap-3">
            <span className="shrink-0 text-muted/60">{l.ts}</span>
            <span className={COLOR[l.level]}>{l.text}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
