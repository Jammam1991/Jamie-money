import type { ReactNode } from "react";

// A plain white rounded card — the basic building block for every tile.
export function Card({ children, className = "", style }: { children: ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`rounded-2xl border border-border bg-card p-4 ${className}`} style={style}>{children}</div>
  );
}

// A soft tinted panel used inside cards for secondary info.
export function Tint({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl bg-tint p-3 ${className}`}>{children}</div>;
}

// A simple progress bar (0-100).
export function Bar({ pct }: { pct: number }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-tint">
      <div className="h-full rounded-full" style={{ width: `${clamped}%`, background: "var(--good)" }} />
    </div>
  );
}

// Page title used at the top of each screen.
export function PageTitle({ children }: { children: ReactNode }) {
  return <h1 className="mb-4 text-xl font-medium">{children}</h1>;
}

// A thermometer gauge that fills up and changes color based on percentage.
export function Thermometer({ current, max }: { current: number; max: number }) {
  const pct = Math.min(100, (current / max) * 100);
  let color = "var(--good)"; // green
  let label = "Safe";

  if (pct >= 80) {
    color = "#dc2626"; // red
    label = "Critical";
  } else if (pct >= 60) {
    color = "#ff6b35"; // orange
    label = "Hot";
  } else if (pct >= 40) {
    color = "#fbbf24"; // yellow
    label = "Warming";
  }

  return (
    <div className="mb-6">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <div className="text-sm text-muted">Debt Level</div>
          <div className="text-3xl font-bold">${current.toLocaleString("en-US", { maximumFractionDigits: 0 })}</div>
          <div className="text-xs text-muted">of ${max.toLocaleString("en-US")} max</div>
        </div>
        <div className="text-right">
          <div className="text-sm font-medium" style={{ color }}>{label}</div>
          <div className="text-2xl font-bold">{Math.round(pct)}%</div>
        </div>
      </div>

      <div className="relative h-32 w-full rounded-lg border-2 border-border bg-tint p-2">
        <div
          className="absolute inset-x-2 bottom-2 rounded-md transition-all"
          style={{
            height: `${pct}%`,
            backgroundColor: color,
            opacity: 0.8,
          }}
        />
        <div className="absolute inset-x-2 h-px bg-muted/30 top-1/2 transform -translate-y-1/2" />
      </div>
    </div>
  );
}
