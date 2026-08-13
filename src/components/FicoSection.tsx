"use client";

// The FICO score block from Money App's Credit Report screen: the big number,
// how it moved, and a history chart behind a toggle.
//
// Money App's version also has "Log score" and delete buttons. Those aren't
// here on purpose — scores are entered over there and this app only mirrors
// them, so an edit here would be wiped by the next pull.

import { useState } from "react";
import { ficoColor, ficoLabel, fmtLocalDate } from "@/lib/creditReport";
import type { FicoScoreEntry } from "@/lib/store";

const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function fmtMonthLabel(iso: string) {
  const [y, m] = iso.split("-");
  return `${MONTH_LABELS[parseInt(m ?? "1") - 1]} '${(y ?? "").slice(2)}`;
}

// FICO band thresholds
const BANDS = [
  { min: 800, label: "Exceptional", color: "#22c55e" },
  { min: 740, label: "Very Good", color: "#6366f1" },
  { min: 670, label: "Good", color: "#f59e0b" },
  { min: 580, label: "Fair", color: "#f97316" },
  { min: 300, label: "Poor", color: "#f43f5e" },
];

function bandForScore(score: number) {
  return BANDS.find((b) => score >= b.min) ?? BANDS[BANDS.length - 1]!;
}

// The score line, drawn by hand as an SVG so the app doesn't carry a charting
// library for one graph. Tap a point to read it.
function FicoScoreChart({ history }: { history: FicoScoreEntry[] }) {
  const [picked, setPicked] = useState<number | null>(null);
  if (history.length < 2) return null;

  // history arrives newest-first — reverse so the line reads left to right.
  const data = [...history].reverse();

  const scores = data.map((d) => d.score);
  const yMin = Math.max(300, Math.min(...scores) - 30);
  const yMax = Math.min(850, Math.max(...scores) + 30);
  const span = Math.max(1, yMax - yMin);

  // Viewbox: 300 wide, 140 tall, with room on the left for the axis numbers.
  const left = 26;
  const right = 296;
  const top = 8;
  const bottom = 112;

  const x = (i: number) =>
    data.length === 1 ? (left + right) / 2 : left + (i / (data.length - 1)) * (right - left);
  const y = (v: number) => bottom - ((v - yMin) / span) * (bottom - top);

  const line = data.map((d, i) => `${x(i)},${y(d.score)}`).join(" ");
  const area = `${left},${bottom} ${line} ${x(data.length - 1)},${bottom}`;
  const bands = [740, 670, 580].filter((t) => t > yMin && t < yMax);
  const shown = picked != null ? data[picked] : null;

  return (
    <div className="mt-1 mb-3">
      <svg viewBox="0 0 300 140" className="w-full" style={{ height: 150 }}>
        <defs>
          <linearGradient id="ficoGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.18} />
            <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
          </linearGradient>
        </defs>

        {/* Score bands */}
        {bands.map((t) => {
          const band = bandForScore(t);
          return (
            <g key={t}>
              <line
                x1={left}
                x2={right}
                y1={y(t)}
                y2={y(t)}
                stroke={band.color}
                strokeDasharray="3 3"
                strokeOpacity={0.4}
              />
              <text x={0} y={y(t) + 3} fontSize={8} fill="var(--faint)">
                {t}
              </text>
            </g>
          );
        })}

        <polygon points={area} fill="url(#ficoGrad)" />
        <polyline
          points={line}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {data.map((d, i) => (
          <circle
            key={d.scoredOn}
            cx={x(i)}
            cy={y(d.score)}
            r={picked === i ? 5 : 3}
            fill="var(--accent)"
            onClick={() => setPicked((p) => (p === i ? null : i))}
            style={{ cursor: "pointer" }}
          />
        ))}

        {/* First and last dates along the bottom */}
        <text x={left} y={132} fontSize={9} fill="var(--faint)">
          {fmtMonthLabel(data[0].scoredOn)}
        </text>
        <text x={right} y={132} fontSize={9} fill="var(--faint)" textAnchor="end">
          {fmtMonthLabel(data[data.length - 1].scoredOn)}
        </text>
      </svg>

      {shown && (
        <div className="mt-1 rounded-lg border border-border bg-card px-3 py-2 text-xs">
          <p className="text-muted">{fmtLocalDate(shown.scoredOn)}</p>
          <p className="text-lg font-bold" style={{ color: bandForScore(shown.score).color }}>
            {shown.score}
          </p>
          <p className="text-faint">{bandForScore(shown.score).label}</p>
        </div>
      )}
    </div>
  );
}

export function FicoSection({ history }: { history: FicoScoreEntry[] }) {
  const [showHistory, setShowHistory] = useState(false);
  const [showNegatives, setShowNegatives] = useState(false);

  // Newest first, matching how Money App reads it.
  const sorted = [...history].sort((a, b) => b.scoredOn.localeCompare(a.scoredOn));
  const latest = sorted[0] ?? null;
  const previous = sorted[1] ?? null;
  const delta = latest && previous ? latest.score - previous.score : null;

  // Get top 2 negative factors
  const negatives = latest?.negatives ?? null;
  const topNegatives = negatives ? negatives.slice(0, 2) : null;

  // Debug logging
  if (typeof window !== "undefined") {
    console.log("FicoSection debug:", {
      historyLength: history.length,
      sortedLength: sorted.length,
      latest: latest ? { score: latest.score, scoredOn: latest.scoredOn, negativesCount: latest.negatives?.length } : null,
      previous: previous ? { score: previous.score, scoredOn: previous.scoredOn } : null,
      delta,
      topNegatives: topNegatives ? topNegatives.map(n => ({ name: n.name, kind: n.kind })) : null,
    });
  }

  return (
    <div className="bg-card rounded-2xl border border-border p-4">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-faint">
          FICO Score — Jamie
        </p>
        {sorted.length >= 2 && (
          <button
            onClick={() => setShowHistory((v) => !v)}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-border bg-card text-foreground"
          >
            {showHistory ? "Hide history" : "History"}
          </button>
        )}
      </div>

      {latest ? (
        <div className="mb-2">
          <div className="flex items-end gap-4">
            <button
              onClick={() => topNegatives && setShowNegatives((v) => !v)}
              disabled={!topNegatives}
              className={topNegatives ? "cursor-pointer hover:opacity-80 transition-opacity" : "cursor-default"}
            >
              <p className={`text-5xl font-bold tabular-nums ${ficoColor(latest.score)}`}>
                {latest.score}
              </p>
              <p className="text-xs text-faint mt-1">
                {ficoLabel(latest.score)} · as of {fmtLocalDate(latest.scoredOn)}
              </p>
            </button>
            {delta !== null && delta < 0 && (
              <div className="pb-1 text-neg flex items-baseline gap-1">
                <span className="text-lg">↓</span>
                <span className="text-sm font-semibold">{Math.abs(delta)} pts</span>
              </div>
            )}
            {delta !== null && delta > 0 && (
              <div className="pb-1 text-pos flex items-baseline gap-1">
                <span className="text-lg">↑</span>
                <span className="text-sm font-semibold">{delta} pts</span>
              </div>
            )}
            {delta !== null && delta === 0 && (
              <div className="pb-1 text-faint text-sm font-semibold">No change</div>
            )}
          </div>

          {showNegatives && topNegatives && topNegatives.length > 0 && (
            <div className="mt-3 rounded-lg border border-border bg-card/50 p-3 space-y-2">
              <p className="text-xs font-semibold text-faint uppercase tracking-wider">Factors bringing score down</p>
              <ul className="space-y-2">
                {topNegatives.map((factor, i) => (
                  <li key={i} className="text-sm">
                    <p className="font-semibold text-foreground">{factor.name}</p>
                    {factor.kind && (
                      <p className="text-xs text-muted">{factor.kind}</p>
                    )}
                    {factor.status && (
                      <p className="text-xs text-faint">{factor.status}</p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-faint mb-4">No scores yet.</p>
      )}

      {showHistory && (
        <>
          <FicoScoreChart history={sorted} />
          <div className="divide-y divide-border mt-1">
            {sorted.map((entry, i) => (
              <div
                key={entry.scoredOn}
                className="flex items-center justify-between gap-2 py-2 text-sm"
              >
                <span className="text-muted text-xs">{fmtLocalDate(entry.scoredOn)}</span>
                <div className="flex items-center gap-2">
                  {i === 0 && (
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-accent bg-accent/10 px-1.5 py-0.5 rounded">
                      Latest
                    </span>
                  )}
                  <span className={`font-bold tabular-nums ${ficoColor(entry.score)}`}>
                    {entry.score}
                  </span>
                  <span className="text-[11px] text-faint">{ficoLabel(entry.score)}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
