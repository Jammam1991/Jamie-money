import type { ReactNode } from "react";
import { Card } from "@/components/ui";
import { money, moneyExact } from "@/lib/data";
import {
  EVIDENCE,
  OPEN_ITEMS,
  PERIODS,
  SPENDING,
  STRONGEST,
  evidenceTotal,
  periodMax,
  periodTotal,
} from "@/lib/spendingHistory";
import { groupByYear, type SpendItem, type Tier } from "@/lib/spendingItems";

// ── Spending history, 2017 to today ──────────────────────────────────────────
// Chris's own working material: what was spent on Jamie, year by year, with how
// solid each line is. Admin-only, and hidden under "View as Jamie" so the
// toggle is a real check on what Jamie sees rather than a nav preview.
//
// Lifted out of DivorceResponsibilityClient when the Debt Story itself moved to
// Money App's evidence file — this was the only live part left in that file.

const TIER_COLOR: Record<Tier, string> = {
  bank: "var(--good)",
  memory: "#fbbf24",
  none: "#dc2626",
};

const TIER_LABEL: Record<Tier, string> = {
  bank: "Bank record",
  memory: "From memory",
  none: "No date or receipt",
};

// Dates the older half of the ledger only knows roughly get a "~" so nobody
// mistakes a placeholder for a real transaction date.
function shortDate(it: SpendItem): string {
  if (!it.d) return "—";
  const [y, m, d] = it.d.split("-");
  const stamp = `${m}/${d}/${y}`;
  return it.p === "exact day" ? stamp : `~${stamp}`;
}

// The story is told in chapters, top to bottom, the way you'd tell it out loud:
// how the pile got built, who fed it, who paid for it, and what's left to settle.
// A server component on purpose — the manager-pay months are counted from "now",
// and doing that on the server means the number can't drift after hydration.


export default function SpendingHistory() {
  return (
    <div className="space-y-4">
      <div
        className="rounded-2xl border-l-4 p-4"
        style={{ background: "var(--tint)", borderLeftColor: "var(--muted)" }}
      >
        <p className="text-[12px] font-medium uppercase tracking-wide text-muted">
          🔒 Only you can see this
        </p>
        <p className="mt-1 text-[19px] font-semibold">
          Spending history, 2017 to today
        </p>
        <p className="mt-1 text-[13px] text-muted">
          {`Rebuilt ${SPENDING.rebuiltOn} from the divorce workbook. Married ${SPENDING.marriedOn}, separated ${SPENDING.separatedOn} — ${SPENDING.separatedNote}.`}
        </p>
      </div>

      {/* The total, immediately qualified. The caveat is part of the headline
          on purpose — a bare number here would be misleading. */}
      <div className="rounded-2xl bg-tint p-5 text-center">
        <p className="text-[13px] text-muted">Money Chris put out, all in</p>
        <p className="mt-1 text-5xl font-bold">{money(periodTotal)}</p>
        <p className="mt-2 text-[13px] text-muted">
          A claim, not a settled balance. Roughly a third of it has a receipt.
        </p>
      </div>

      {/* Where it landed on the timeline. */}
      <Card>
        <p className="mb-1 text-[15px] font-semibold">🗓️ When it went out</p>
        <p className="mb-4 text-[13px] text-muted">
          Cut on the real dates — not the 2023 separation year the story above
          still uses.
        </p>
        <div className="space-y-4">
          {PERIODS.map((p) => (
            <details key={p.key} className="group">
              <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                <div className="mb-1 flex items-baseline justify-between gap-3">
                  <span className="text-[15px] font-medium">
                    {p.emoji} {p.title}
                  </span>
                  <span
                    className="shrink-0 text-[17px] font-bold"
                    style={{ color: p.accent }}
                  >
                    {money(p.amount)}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-tint">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(p.amount / periodMax) * 100}%`,
                      background: p.accent,
                    }}
                  />
                </div>
                <p className="mt-1 text-[12px] text-muted">
                  {p.when} · {p.items} items · {p.note}
                </p>
                <p
                  className="mt-1 text-[12px] font-medium"
                  style={{ color: p.accent }}
                >
                  <span className="inline-block transition-transform group-open:rotate-90">
                    ›
                  </span>{" "}
                  <span className="group-open:hidden">
                    Show the {p.items} lines
                  </span>
                  <span className="hidden group-open:inline">Hide them</span>
                </p>
              </summary>

              {/* One collapsed row per year, so a 79-line year stays tidy. */}
              <div className="mt-2 space-y-1 border-l-2 pl-3" style={{ borderLeftColor: p.accent }}>
                {groupByYear(p.key).map((g) => (
                  <details key={g.year} className="group/yr">
                    <summary className="flex cursor-pointer list-none items-baseline justify-between gap-3 rounded-lg px-2 py-1.5 text-[13px] hover:bg-tint [&::-webkit-details-marker]:hidden">
                      <span className="font-medium">
                        <span className="inline-block text-muted transition-transform group-open/yr:rotate-90">
                          ›
                        </span>{" "}
                        {g.year}
                        <span className="ml-1.5 font-normal text-muted">
                          {g.items.length} items
                        </span>
                      </span>
                      <span className="shrink-0 font-medium">
                        {money(g.total)}
                      </span>
                    </summary>
                    <ul className="mb-1 space-y-1 px-2 pb-1 pt-1">
                      {g.items.map((it, i) => (
                        <li
                          key={`${g.year}-${i}`}
                          className="flex items-start justify-between gap-2 text-[12px] leading-snug"
                        >
                          <span className="flex min-w-0 items-start gap-1.5">
                            <span
                              className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full"
                              style={{ background: TIER_COLOR[it.e] }}
                              title={TIER_LABEL[it.e]}
                            />
                            <span className="min-w-0">
                              <span className="text-muted">{shortDate(it)}</span>{" "}
                              <span className="break-words">{it.t}</span>
                            </span>
                          </span>
                          <span
                            className="shrink-0 tabular-nums"
                            style={{ color: it.a > 0 ? "var(--good)" : undefined }}
                          >
                            {it.a > 0 ? "+" : ""}
                            {moneyExact(Math.abs(it.a))}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </details>
                ))}
              </div>
            </details>
          ))}
        </div>

        {/* What the coloured dot on each line means. */}
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
          {(["bank", "memory", "none"] as Tier[]).map((t) => (
            <span key={t} className="flex items-center gap-1.5">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: TIER_COLOR[t] }}
              />
              {TIER_LABEL[t]}
            </span>
          ))}
        </div>
        <div className="mt-4 rounded-xl bg-warn-bg p-3">
          <p className="text-[13px] text-warn">
            <strong>
              {Math.round((PERIODS[2].amount / periodTotal) * 100)}% of it went
              out after the separation.
            </strong>{" "}
            That&apos;s the strongest part of the claim — money spent after the
            split is normally separate, not marital.
          </p>
        </div>
      </Card>

      {/* How much of it can actually be proved. */}
      <Card>
        <p className="mb-1 text-[15px] font-semibold">🔍 How solid is it</p>
        <p className="mb-4 text-[13px] text-muted">
          What a lawyer checks first. Read this before quoting the total to
          anyone.
        </p>
        <div className="mb-4 flex h-7 overflow-hidden rounded-full bg-tint">
          {EVIDENCE.map((e) => (
            <div
              key={e.label}
              className="flex items-center justify-center text-[11px] font-semibold text-white"
              style={{
                width: `${(e.amount / evidenceTotal) * 100}%`,
                background: e.color,
              }}
            >
              {Math.round((e.amount / evidenceTotal) * 100)}%
            </div>
          ))}
        </div>
        <div className="space-y-3">
          {EVIDENCE.map((e) => (
            <div key={e.label}>
              <div className="flex items-baseline justify-between gap-3 text-[15px]">
                <span className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: e.color }}
                  />
                  {e.label}
                </span>
                <span className="shrink-0 font-medium">{money(e.amount)}</span>
              </div>
              <p className="ml-[18px] text-[12px] text-muted">
                {e.items} items · {e.note}
              </p>
            </div>
          ))}
        </div>
      </Card>

      {/* The version that survives a fight. */}
      <div
        className="rounded-2xl border-l-4 p-4"
        style={{
          background: "var(--good-bg)",
          borderLeftColor: "var(--good)",
        }}
      >
        <p className="text-[12px] font-medium uppercase tracking-wide" style={{ color: "var(--good)" }}>
          Lead with this
        </p>
        <p className="mt-1 text-[19px] font-semibold">
          ✅ The part that holds up
        </p>
        <p className="mt-2 text-4xl font-bold" style={{ color: "var(--good)" }}>
          {moneyExact(STRONGEST.amount)}
        </p>
        <p className="mt-1 text-[15px]">
          {`${STRONGEST.items} transactions that are both after the separation and backed by a bank statement. Nothing here rests on memory.`}
        </p>
      </div>

      {/* The HELOC trap — the single easiest way to blow up the whole claim. */}
      <div
        className="rounded-2xl border-l-4 p-4"
        style={{ background: "#fdeaea", borderLeftColor: "#dc2626" }}
      >
        <p className="text-[19px] font-semibold">
          ⚠️ Don&apos;t stack the HELOC on top
        </p>
        <p className="mt-2 text-[15px]">
          {`The ${money(SPENDING.helocTotal)} Berkshire HELOC didn't create new debt — it repackaged the ${SPENDING.helocCovers} borrowing that's already itemised above. Same money, new wrapper. Adding both would claim it twice.`}
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <Stat
            label="HELOC"
            value={money(SPENDING.helocTotal)}
            color="var(--text)"
          />
          <Stat
            label="Itemised, same years"
            value={money(SPENDING.itemisedThrough2023)}
            color="var(--text)"
          />
          <Stat
            label="Unexplained"
            value={money(SPENDING.helocTotal - SPENDING.itemisedThrough2023)}
            color="#dc2626"
          />
        </div>
      </div>

      {/* What still has to be nailed down. */}
      <Card>
        <p className="mb-1 text-[15px] font-semibold">📌 Still to nail down</p>
        <p className="mb-3 text-[13px] text-muted">
          In order. The first one closes most of the others.
        </p>
        <ul className="space-y-3 text-[15px]">
          {OPEN_ITEMS.map((o) => (
            <Beat key={o.title} emoji={o.emoji}>
              <strong>{o.title}</strong>
              <span className="block text-[13px] text-muted">{o.detail}</span>
            </Beat>
          ))}
        </ul>
      </Card>

      <Card className="bg-tint">
        <p className="text-xs text-muted">
          <strong>Working numbers — not for Jamie, not for a filing.</strong>{" "}
          Bookkeeping only. California treats pre-marriage, marital and
          post-separation money very differently, so the three-period split has
          to go past a lawyer before anyone leans on it.
        </p>
      </Card>
    </div>
  );
}

// ── Small pieces ─────────────────────────────────────────────────────────────

// One chapter of the story: a numbered, color-washed panel.

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="rounded-xl bg-card p-3">
      <p className="text-[11px] text-muted">{label}</p>
      <p className="text-lg font-semibold" style={{ color }}>
        {value}
      </p>
    </div>
  );
}

function Beat({ emoji, children }: { emoji: string; children: ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span className="shrink-0 text-lg leading-tight">{emoji}</span>
      <span>{children}</span>
    </li>
  );
}
