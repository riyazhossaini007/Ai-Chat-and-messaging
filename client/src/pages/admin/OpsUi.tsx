import type { PropsWithChildren } from "react";

export function Card({ children }: PropsWithChildren) {
  return (
    <section className="rounded-2xl border border-zinc-700 bg-zinc-900/65 p-4 md:p-5">
      {children}
    </section>
  );
}

export function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-700 bg-zinc-950/60 p-3">
      <p className="text-xs uppercase tracking-wide text-zinc-400">{label}</p>
      <p className="mt-1 text-xl font-semibold text-zinc-100">{value}</p>
      {hint ? <p className="mt-1 text-xs text-zinc-500">{hint}</p> : null}
    </div>
  );
}

export function MiniLineChart({
  values,
  height = 120,
}: {
  values: number[];
  height?: number;
}) {
  const width = 520;
  if (values.length === 0) {
    return <div className="text-sm text-zinc-500">No data</div>;
  }
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = Math.max(1, max - min);
  const stepX = values.length <= 1 ? width : width / (values.length - 1);
  const points = values
    .map((value, index) => {
      const x = index * stepX;
      const y = height - ((value - min) / range) * height;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-28 w-full rounded-lg border border-zinc-700 bg-zinc-950/70"
      role="img"
      aria-label="trend chart"
    >
      <polyline fill="none" stroke="#22d3ee" strokeWidth="3" points={points} />
    </svg>
  );
}

export function fmtUsd(value: number) {
  return `$${value.toFixed(2)}`;
}

export function fmtPct(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}
