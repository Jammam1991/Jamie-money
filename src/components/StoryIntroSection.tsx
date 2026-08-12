"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Card } from "@/components/ui";
import { money } from "@/lib/data";
import type { StoryIntro } from "@/lib/story";

// ── The two sections above the chapters ──────────────────────────────────────
// "The paycheck never covered the debt" and "Jamie paid in for 18 months, then
// stopped". Money App writes the sentences and works out the figures; this only
// draws them, lettered A and B as it letters them.

const TONE_COLOR: Record<string, string> = {
  violet: "#6d28d9",
  sky: "#0369a1",
  amber: "#b45309",
  teal: "#0f766e",
  rose: "#be123c",
};

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function monthLabel(m: string): string {
  const name = MONTH_NAMES[Number(m.slice(5)) - 1];
  return name ? `${name} ${m.slice(0, 4)}` : m;
}

export default function StoryIntroSection({ section }: { section: StoryIntro }) {
  const [open, setOpen] = useState(false);
  const accent = TONE_COLOR[section.tone] ?? TONE_COLOR.rose;

  return (
    <Card className="border-l-4" style={{ borderLeftColor: accent }}>
      <div className="flex items-center gap-2">
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium text-white"
          style={{ background: accent }}
        >
          {section.key}
        </span>
        <span className="text-[13px] uppercase tracking-wide" style={{ color: accent }}>
          {section.era}
        </span>
      </div>

      <p className="mt-2 text-[17px] font-medium">
        {section.emoji} {section.title}
      </p>

      {section.figure !== undefined && (
        <p className="mt-1 text-3xl font-medium" style={{ color: accent }}>
          {money(Math.abs(section.figure))}
        </p>
      )}
      {section.caption && (
        <p className="mt-1 text-[14px] text-muted">{section.caption}</p>
      )}

      {/* One bar per month with money in it, and the gap drawn where it falls —
          the shape is the argument, not the individual amounts. */}
      {section.months && section.months.length > 0 && (
        <MonthBars months={section.months} gapFrom={section.gap?.from} gapMonths={section.gap?.months} accent={accent} />
      )}

      <ul className="mt-3 space-y-2 text-[14px]">
        {section.bullets.map((b, i) => (
          <li key={i} className="flex gap-2">
            <span className="shrink-0 text-muted">•</span>
            <span>{b}</span>
          </li>
        ))}
      </ul>

      {section.drill && (
        <>
          <button
            className="mt-3 flex w-full items-center justify-between gap-2 rounded-xl border border-border px-3 py-2 text-left text-[14px]"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
          >
            <span className="min-w-0 truncate">{section.drill.label}</span>
            <span className="flex shrink-0 items-center gap-1.5 text-muted">
              <span className="text-xs">{section.drill.hint}</span>
              <ChevronDown
                size={16}
                className={`transition-transform ${open ? "rotate-180" : "-rotate-90"}`}
              />
            </span>
          </button>

          {open && (
            <div className="mt-2">
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted">
                      <th className="py-1.5 pr-3 font-normal">Year</th>
                      <th className="py-1.5 pr-3 text-right font-normal">Income</th>
                      <th className="py-1.5 pr-3 text-right font-normal">Bank payments</th>
                      <th className="py-1.5 pr-3 text-right font-normal">Rent out</th>
                      <th className="py-1.5 text-right font-normal">Covered</th>
                    </tr>
                  </thead>
                  <tbody>
                    {section.drill.rows.map((r) => (
                      <tr key={r.year} className="border-b border-border last:border-b-0">
                        <td className="py-1.5 pr-3">{r.year}</td>
                        <td className="py-1.5 pr-3 text-right">{money(r.income)}</td>
                        <td className="py-1.5 pr-3 text-right" style={{ color: "var(--neg)" }}>
                          {money(r.bankPayments)}
                        </td>
                        <td className="py-1.5 pr-3 text-right text-muted">
                          {r.rentOut ? money(r.rentOut) : "—"}
                        </td>
                        <td
                          className="py-1.5 text-right font-medium"
                          style={{ color: r.coveredPct < 100 ? "var(--neg)" : "var(--good)" }}
                        >
                          {r.coveredPct}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-xs text-muted">{section.drill.note}</p>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

function MonthBars({
  months,
  gapFrom,
  gapMonths,
  accent,
}: {
  months: { month: string; amount: number }[];
  gapFrom?: string;
  gapMonths?: number;
  accent: string;
}) {
  const tallest = Math.max(...months.map((m) => m.amount), 1);

  return (
    <div className="mt-3 flex items-end gap-[3px] overflow-x-auto pb-1">
      {months.map((m, i) => {
        const prev = months[i - 1];
        const isGap = Boolean(prev && gapFrom && prev.month === gapFrom);
        return (
          <div key={m.month} className="flex items-end gap-[3px]">
            {isGap && gapMonths && (
              <span
                className="mx-1 whitespace-nowrap rounded border px-1.5 py-1 text-[10px] leading-none"
                style={{
                  borderColor: "var(--neg)",
                  color: "var(--neg)",
                  background: "var(--warn-bg)",
                }}
              >
                {gapMonths} months, nothing
              </span>
            )}
            <div
              className="w-[6px] shrink-0 rounded-t"
              style={{
                height: Math.max(3, (m.amount / tallest) * 40),
                background: accent,
              }}
              title={`${monthLabel(m.month)}: ${money(m.amount)}`}
            />
          </div>
        );
      })}
    </div>
  );
}
