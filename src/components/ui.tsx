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
