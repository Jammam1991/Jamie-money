import { Suspense } from "react";
import Link from "next/link";
import { after } from "next/server";
import { ChevronRight } from "lucide-react";
import ComingSoon from "@/components/ComingSoon";
import DebtCard from "@/components/picture/DebtCard";
import AssetsCard from "@/components/picture/AssetsCard";
import {
  client,
  getAssets,
  getDebtTransactions,
  getDebts,
  getDivorce,
  getFicoHistory,
  getInvestmentSplitTerms,
  getSettlementTerms,
} from "@/lib/store";
import { autoSyncMoneyAppDebts } from "@/lib/moneyapp";
import { getPayMonths } from "@/lib/gymPay";
import { getHouseholdPicture } from "@/lib/householdPicture";
import { getPlanBase } from "@/lib/retirementPlanFeed";
import { resolveInputs } from "@/lib/retirementPlan";
import { jamieResponsibleTotal } from "@/lib/debtTotals";
import { ficoLabel } from "@/lib/creditReport";
import { HOME_TZ } from "@/lib/calendar";
import { pageGate } from "@/lib/visibility";

export const dynamic = "force-dynamic";
// The debt card waits on the gym dashboard and Money App (see the full page).
export const maxDuration = 30;

// ── Financial Picture ────────────────────────────────────────────────────────
// Chris, 2026-11-08: "This needs to be SUPER SIMPLE. Remove most of this." Three
// cards — Debt, Assets, Credit — and everything the old page showed one tap
// away under "See all the details" (/debt/details).

// The settlement's default length when Admin hasn't set one — same as Home.
const SETTLEMENT_MONTHS = 60;

function todayInPacific(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: HOME_TZ }).format(new Date());
}

export default async function FinancialPicturePage() {
  const { comingSoon } = await pageGate("debt");
  if (comingSoon) return <ComingSoon title="Financial Picture" />;

  // Keep the balances fresh from Money App, after the page has gone out.
  const c = client();
  if (c) after(() => autoSyncMoneyAppDebts(c));

  const today = todayInPacific();
  const [assets, plan, ficoHistory] = await Promise.all([getAssets(), getPlanBase(), getFicoHistory()]);
  const ira = plan.base ? resolveInputs(plan.base.settings, plan.base.live, today).fromChris : null;

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-medium">Financial Picture</h1>

      <Section n={1} title="Debt">
        <Suspense fallback={<div className="h-[230px] animate-pulse rounded-3xl border border-border bg-card" />}>
          <DebtSection today={today} />
        </Suspense>
      </Section>

      <Section n={2} title="Assets">
        <AssetsCard initial={assets} ira={ira} />
      </Section>

      <Section n={3} title="Credit">
        <CreditSummary history={ficoHistory} />
      </Section>

      <Link
        href="/debt/details"
        className="flex items-center justify-center gap-1 py-2 text-[14px] font-medium text-muted hover:text-text"
      >
        See all the details
        <ChevronRight size={16} />
      </Link>
    </div>
  );
}

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 flex items-center gap-2 text-[15px] font-semibold">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-text text-[12px] text-card">{n}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

// Streams in on its own: the joint total and the gym pay can each take a few
// seconds, and Assets and Credit shouldn't wait for them.
async function DebtSection({ today }: { today: string }) {
  const [{ picture }, debts, splitTerms, txs, pay, divorce, terms] = await Promise.all([
    getHouseholdPicture(),
    getDebts(),
    getInvestmentSplitTerms(),
    getDebtTransactions(),
    getPayMonths(),
    getDivorce(),
    getSettlementTerms(),
  ]);

  // New debt, counted the way the full page counts it: what Chris lent
  // privately plus what was drawn from the gym above what the work earned.
  const newSince = (prefix: string) =>
    txs.filter((t) => t.txDate.startsWith(prefix)).reduce((s, t) => s + t.amount, 0) +
    pay.months.filter((p) => p.month.startsWith(prefix)).reduce((s, p) => s + p.difference, 0);

  return (
    <DebtCard
      joint={picture?.totalDebt ?? null}
      jamie={jamieResponsibleTotal(debts, splitTerms)}
      settlement={terms.total ?? divorce.support.amount * (terms.months ?? SETTLEMENT_MONTHS)}
      thisMonth={newSince(today.slice(0, 7))}
      thisYear={newSince(today.slice(0, 4))}
    />
  );
}

type FicoEntry = Awaited<ReturnType<typeof getFicoHistory>>[number];

function CreditSummary({ history }: { history: FicoEntry[] }) {
  const now = history.at(-1);
  if (!now) {
    return (
      <div className="rounded-3xl border border-border bg-card p-5 text-[14px] text-muted">
        No credit score yet. It shows here once one is logged in Money App.
      </div>
    );
  }
  const before = history.at(-2);
  const change = before ? now.score - before.score : 0;
  const first = history[0];
  const sinceStart = history.length > 1 ? now.score - first.score : 0;
  const date = (iso: string) =>
    new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  const pct = Math.min(100, Math.max(0, ((now.score - 300) / 550) * 100));

  return (
    <Link href="/credit-report" className="group block rounded-3xl border border-border bg-card p-5 transition-shadow hover:shadow-md">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-[12px] text-muted">FICO score</div>
          <div className="flex items-baseline gap-2">
            <span className="text-[34px] font-semibold leading-none tabular-nums">{now.score}</span>
            {change !== 0 && (
              <span className="text-[15px] font-semibold tabular-nums" style={{ color: change > 0 ? "var(--good)" : "var(--neg)" }}>
                {change > 0 ? "▲" : "▼"} {Math.abs(change)}
              </span>
            )}
          </div>
          <div className="mt-1 text-[13px] font-medium" style={{ color: "var(--fico)" }}>
            {ficoLabel(now.score)}
          </div>
        </div>
        <ChevronRight size={18} className="mb-1 text-muted transition-transform group-hover:translate-x-0.5" />
      </div>
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full" style={{ background: "linear-gradient(90deg, #f43f5e, #f97316, #f59e0b, #6366f1, #22c55e)" }}>
        <div className="relative h-full" style={{ width: `${pct}%` }}>
          <span className="absolute -top-0.5 right-0 h-3 w-1 rounded-full bg-text" />
        </div>
      </div>
      <p className="mt-3 text-[12px] text-muted">
        {date(now.scoredOn)}
        {before ? ` · ${change === 0 ? "same as last time" : `${change > 0 ? "up" : "down"} ${Math.abs(change)} from ${before.score}`}` : ""}
        {history.length > 2 && sinceStart !== 0 ? ` · ${sinceStart > 0 ? "+" : "−"}${Math.abs(sinceStart)} since ${date(first.scoredOn)}` : ""}
      </p>
    </Link>
  );
}
