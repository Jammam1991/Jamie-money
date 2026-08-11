"use client";

import { TrendingUp } from "lucide-react";
import { money } from "@/lib/data";
import { yearColor } from "@/lib/debtColors";

// ── What was owed at the end of each year ────────────────────────────────────
// One bar per year, oldest on the left, so the shape of the last few years is
// one glance instead of four numbers read in sequence.
//
// Drawn as plain SVG rather than pulled in from a chart library: four bars and
// four labels don't justify a dependency, and this way the bars use the same
// colours as the year rows above without a theme adapter in between.

type Point = { year: number; owed: number };

// The plot, in SVG units. The box is taller than the plot on purpose — the year
// labels need a band of their own, or they get clipped by the container.
const W = 340;
const PLOT_TOP = 34; // room above the tallest bar for its value
const BASELINE = 150;
const AXIS_BAND = 26; // year labels live under the baseline
const H = BASELINE + AXIS_BAND;
const PAD_X = 10;
const MAX_BAR = 40;
const GAP = 2; // surface gap between touching marks

// Money in as few characters as a bar label can hold. The exact figure is one
// tap away in the tooltip, and spelled out in full in the rows above.
function short(n: number): string {
  if (Math.abs(n) >= 1000) return `$${Math.round(n / 1000)}k`;
  return `$${Math.round(n)}`;
}

export default function DebtGrowthChart({ points }: { points: Point[] }) {
  // Oldest first — time runs left to right.
  const data = [...points].sort((a, b) => a.year - b.year);
  if (data.length < 2) return null;

  // Bars are measured from zero. Starting the axis higher would magnify a
  // gentle rise into a cliff, which is the oldest way to lie with a bar chart.
  const max = Math.max(...data.map((d) => d.owed), 1);
  const band = (W - PAD_X * 2) / data.length;
  const barW = Math.min(MAX_BAR, band - GAP * 2);
  const plotH = BASELINE - PLOT_TOP;

  return (
    <div className="mt-4 border-t border-border pt-4">
      <p className="flex items-center gap-1.5 text-[13px] text-muted">
        <TrendingUp size={15} />
        What you owed at the end of each year
      </p>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-2 w-full"
        role="img"
        aria-label={`Debt owed at the end of each year: ${data
          .map((d) => `${d.year}, ${money(d.owed)}`)
          .join("; ")}`}
      >
        {data.map((d, i) => {
          const h = Math.max(2, (d.owed / max) * plotH);
          const x = PAD_X + band * i + (band - barW) / 2;
          const y = BASELINE - h;
          // Newest year is index 0 in the colour ramp, matching the rows above.
          const color = yearColor(data.length - 1 - i, data.length);
          return (
            <g key={d.year} className="transition-opacity hover:opacity-80">
              <title>{`${d.year}: ${money(d.owed)} owed`}</title>
              {/* Rounded at the top, square where it meets the baseline. */}
              <path
                d={`M${x} ${BASELINE} L${x} ${y + 4} Q${x} ${y} ${x + 4} ${y} L${x + barW - 4} ${y} Q${x + barW} ${y} ${x + barW} ${y + 4} L${x + barW} ${BASELINE} Z`}
                fill={color}
              />
              <text
                x={x + barW / 2}
                y={y - 8}
                textAnchor="middle"
                fontSize="12"
                fontWeight="600"
                fill="var(--text)"
              >
                {short(d.owed)}
              </text>
              <text
                x={x + barW / 2}
                y={BASELINE + 18}
                textAnchor="middle"
                fontSize="12"
                fill="var(--muted)"
              >
                {d.year}
              </text>
            </g>
          );
        })}

        {/* The baseline itself, kept quiet — it's a reference, not data. */}
        <line
          x1={PAD_X}
          y1={BASELINE}
          x2={W - PAD_X}
          y2={BASELINE}
          stroke="var(--border)"
          strokeWidth="1"
        />
      </svg>
    </div>
  );
}
