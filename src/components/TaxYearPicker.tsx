"use client";

import { useRouter } from "next/navigation";

// A dropdown for jumping straight to a year, instead of scrolling a row of
// pills — the same list, picked from a `<select>` so it stays compact as
// more years get filed.
export function TaxYearPicker({ years, selected }: { years: number[]; selected: number }) {
  const router = useRouter();

  return (
    <label className="mb-3 flex items-center gap-2 text-[13px] text-muted">
      Tax year
      <select
        value={selected}
        onChange={(e) => router.push(`/tax-center?year=${e.target.value}`, { scroll: false })}
        className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-[14px] font-medium text-foreground"
      >
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </label>
  );
}
