"use client";

import { useState } from "react";
import { money } from "@/lib/data";

// The Debt card on Financial Picture: one big number, a switch between the
// whole household's debt and Jamie's own part of it, and what's been added
// lately. Chris, 2026-11-08: "Have toggles (1. Total Joint Debt 2. Jamie
// Responsible Total). Recent Debt (This month, This year added debt)".

type View = "joint" | "jamie";

export default function DebtCard({
  joint,
  jamie,
  settlement,
  thisMonth,
  thisYear,
}: {
  joint: number | null; // null when Money App couldn't be reached
  jamie: number;
  settlement: number;
  thisMonth: number;
  thisYear: number;
}) {
  const [view, setView] = useState<View>(joint === null ? "jamie" : "joint");
  const value = view === "joint" ? joint : jamie;

  return (
    <div className="rounded-3xl border border-border bg-card p-5">
      <div className="grid grid-cols-2 gap-1 rounded-full bg-tint p-1 text-[13px] font-medium">
        {(
          [
            ["joint", "Total joint debt"],
            ["jamie", "Jamie responsible"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setView(key)}
            disabled={key === "joint" && joint === null}
            className={`rounded-full py-2 transition-colors disabled:opacity-40 ${view === key ? "bg-card shadow-sm" : "text-muted"}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-5 text-center">
        <div className="text-[40px] font-black leading-none tracking-tight tabular-nums">{value === null ? "—" : money(value)}</div>
        <p className="mt-2 text-[12px] text-muted">
          {view === "joint"
            ? "Everything Chris and Jamie owe together, gym and rental included"
            : `Not counted: divorce settlement, ${money(settlement)}`}
        </p>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2">
        <Added label="Added this month" amount={thisMonth} />
        <Added label="Added this year" amount={thisYear} />
      </div>
    </div>
  );
}

// Red when the pile grew, green when more went back than went out.
function Added({ label, amount }: { label: string; amount: number }) {
  const color = Math.round(amount) === 0 ? "var(--muted)" : amount > 0 ? "var(--neg)" : "var(--good)";
  return (
    <div className="rounded-2xl bg-tint px-3 py-2.5 text-center">
      <div className="text-[12px] text-muted">{label}</div>
      <div className="text-[18px] font-semibold tabular-nums" style={{ color }}>
        {amount > 0 ? "+" : amount < 0 ? "−" : ""}
        {money(Math.abs(amount))}
      </div>
    </div>
  );
}
