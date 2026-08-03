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
// `showScale` reveals the ceiling and the percentage — Chris sees those, Jamie
// only sees his own number and the bar climbing toward "Emergency Mode".
export function Thermometer({
  current,
  max,
  title = "Debt Level",
  showScale = true,
}: {
  current: number;
  max: number;
  title?: string;
  showScale?: boolean;
}) {
  const raw = max > 0 ? (current / max) * 100 : 0;
  const pct = Math.max(0, Math.min(100, raw));
  let color = "var(--good)"; // green
  let label = "Safe";

  if (raw >= 100) {
    color = "#dc2626"; // red
    label = "Emergency Mode";
  } else if (pct >= 75) {
    color = "#dc2626"; // red
    label = "Critical";
  } else if (pct >= 50) {
    color = "#ff6b35"; // orange
    label = "Hot";
  } else if (pct >= 25) {
    color = "#fbbf24"; // yellow
    label = "Warming";
  }

  // The bulb goes red the moment the level reaches "Hot" and stays red — an
  // early warning that's hard to miss even if the glass is only half full.
  const bulbColor = pct >= 50 ? "#dc2626" : color;

  // Zone words instead of numbers — they tell Jamie how bad it is without
  // giving away the dollar ceiling.
  const zones = [
    { at: 100, text: "Emergency" },
    { at: 75, text: "Critical" },
    { at: 50, text: "Hot" },
    { at: 25, text: "Warming" },
    { at: 0, text: "Safe" },
  ];

  return (
    <div className="mb-6">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <div className="text-sm text-muted">{title}</div>
          <div className="text-4xl font-bold">
            ${current.toLocaleString("en-US", { maximumFractionDigits: 0 })}
          </div>
          {showScale && (
            <div className="text-xs text-muted">
              of ${max.toLocaleString("en-US")} max
            </div>
          )}
        </div>
        <div className="text-right">
          <div className="text-base font-semibold" style={{ color }}>
            {label}
          </div>
          {showScale && <div className="text-2xl font-bold">{Math.round(pct)}%</div>}
        </div>
      </div>

      <div className="flex items-end justify-center gap-5 py-2">
        {/* The glass: a tall tube sitting on a round bulb. */}
        <div className="flex flex-col items-center">
          <div className="relative h-56 w-14 overflow-hidden rounded-t-full border-2 border-b-0 border-border bg-tint">
            <div
              className="absolute inset-x-0 bottom-0 transition-all duration-700"
              style={{ height: `${pct}%`, backgroundColor: color }}
            />
            {/* tick marks up the side of the glass */}
            {[20, 40, 60, 80].map((t) => (
              <div
                key={t}
                className="absolute left-0 h-px w-3 bg-muted/40"
                style={{ bottom: `${t}%` }}
              />
            ))}
          </div>
          <div
            className="-mt-1 h-16 w-16 rounded-full border-2 border-border transition-colors duration-700"
            style={{ backgroundColor: bulbColor }}
          />
        </div>

        {/* Zone words line up with the glass so the climb means something. */}
        <div className="relative h-56 w-24 text-xs">
          {zones.map((z) => {
            const on = pct >= z.at && (z.at === 100 ? raw >= 100 : true);
            return (
              <div
                key={z.text}
                className="absolute left-0 -translate-y-1/2 whitespace-nowrap"
                style={{
                  bottom: `${z.at}%`,
                  color: on ? color : "var(--muted)",
                  fontWeight: on ? 600 : 400,
                  opacity: on ? 1 : 0.55,
                }}
              >
                {z.at === 100 ? "🚨 " : "— "}
                {z.text}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
