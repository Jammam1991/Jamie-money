import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Briefcase,
  ChevronRight,
  FolderKanban,
  Home as HomeIcon,
  KeyRound,
  Receipt,
  Scale,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import CalendarCard, { CalendarSkeleton } from "@/components/home/CalendarCard";
import TodoCard from "@/components/home/TodoCard";
import {
  getBills,
  getCalendarLink,
  getCarInfo,
  getCashLog,
  getDebts,
  getDivorce,
  getPaidBillIdsForBillMonth,
  getProjects,
  getSettlementTerms,
  getTodos,
} from "@/lib/store";
import { getJobApplications } from "@/lib/careerStore";
import { loadCalendar, HOME_TZ } from "@/lib/calendar";
import { currentCarValue } from "@/lib/carInfo";
import { cashBalance, money } from "@/lib/data";
import { billMonthName } from "@/lib/billMonth";
import { jamiePageState } from "@/lib/visibility";
import { getRole } from "@/lib/auth";
import type { PageKey } from "@/lib/pages";

export const dynamic = "force-dynamic";

// ── The home screen ──────────────────────────────────────────────────────────
// One look and Jamie knows his day: what's on the calendar, what's on his list,
// what the bills need, and where the money stands. Everything else is one tap
// away in the tiles underneath. Every number here comes from the same reader
// its own page uses, so the dashboard can't disagree with the page it opens.

// The settlement's default length when Admin hasn't set one — same as the Debt
// page, so the two show the same figure.
const SETTLEMENT_MONTHS = 60;

function todayInPacific(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: HOME_TZ }).format(new Date());
}

function greeting(): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: HOME_TZ, hour: "numeric", hourCycle: "h23" }).format(new Date())
  );
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default async function HomePage() {
  const role = await getRole();
  if (!role) redirect("/login");

  const today = todayInPacific();
  const [
    { removed, comingSoon },
    bills,
    paidIds,
    debts,
    cashLog,
    carInfo,
    divorce,
    terms,
    todos,
    projects,
    jobs,
    calendarLink,
  ] = await Promise.all([
    jamiePageState(),
    getBills(),
    getPaidBillIdsForBillMonth(),
    getDebts(),
    getCashLog(),
    getCarInfo(),
    getDivorce(),
    getSettlementTerms(),
    getTodos(),
    getProjects(),
    getJobApplications(),
    getCalendarLink(),
  ]);

  // A page Admin has taken off Jamie's screen loses its tile too — and one
  // parked as "Coming Soon" keeps its tile but not its numbers.
  const shows = (key: PageKey) => !removed.includes(key);
  const live = (key: PageKey) => shows(key) && !comingSoon.includes(key);

  // Bills: next month's, same as the Bills page.
  const paid = new Set(paidIds);
  const billsTotal = bills.reduce((s, b) => s + b.amount, 0);
  const unpaid = bills.filter((b) => !paid.has(b.id));
  const billsLeft = unpaid.reduce((s, b) => s + b.amount, 0);
  const billsPct = billsTotal > 0 ? Math.round(((billsTotal - billsLeft) / billsTotal) * 100) : 0;
  const nextUp = [...unpaid].sort((a, b) => (a.dueDay || 99) - (b.dueDay || 99)).slice(0, 3);

  // The money picture: what he owes, what he owns, and the divorce.
  const owe = debts.filter((d) => d.scope !== "business").reduce((s, d) => s + d.balance, 0);
  const cash = Math.max(0, cashBalance(cashLog));
  const car = currentCarValue(carInfo, today);
  const own = cash + car;
  const divorceTotal = terms.total ?? divorce.support.amount * (terms.months ?? SETTLEMENT_MONTHS);
  const net = own - owe;

  const activeJobs = jobs.filter((j) => j.status !== "Rejected").length;

  // Steps with a due date from his open projects, so the list on the home
  // screen is everything he has to do — not just the one-liners.
  const projectSteps = live("projects")
    ? (projects ?? [])
        .filter((p) => p.status !== "Done")
        .flatMap((p) =>
          p.steps
            .filter((s) => !s.done && s.due)
            .map((s) => ({
              id: s.id,
              text: s.text,
              due: s.due as string,
              project: p.name,
              emoji: p.emoji,
              href: `/projects/${p.id}`,
            }))
        )
        .sort((a, b) => a.due.localeCompare(b.due))
        .slice(0, 5)
    : [];

  const openTodos = (todos ?? []).filter((t) => !t.done).length;
  const dateLabel = new Date().toLocaleDateString("en-US", {
    timeZone: HOME_TZ,
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const tiles: { key: PageKey | "logins"; href: string; label: string; sub: string; Icon: LucideIcon; tone: string }[] = [
    { key: "cash", href: "/cash", label: "My Cash", sub: live("cash") ? `${money(cash)} on hand` : "Log a massage", Icon: Wallet, tone: "#167a5b" },
    { key: "logins", href: "/passwords", label: "Logins", sub: "Passwords, kept safe", Icon: KeyRound, tone: "#23231f" },
    { key: "career", href: "/career", label: "Career", sub: live("career") && activeJobs ? `${activeJobs} job${activeJobs === 1 ? "" : "s"} in play` : "Paths, jobs, resumes", Icon: Briefcase, tone: "#0e6f8a" },
    { key: "home-buying", href: "/home-buying", label: "Mortgage", sub: "What you could buy", Icon: HomeIcon, tone: "#9a6212" },
    { key: "projects", href: "/projects", label: "Projects", sub: "Everything in motion", Icon: FolderKanban, tone: "#6d28d9" },
    { key: "divorce", href: "/divorce", label: "Divorce", sub: "Dates and details", Icon: Scale, tone: "#b3261e" },
  ];

  return (
    <div className="space-y-4">
      {/* ── Hello ── */}
      <section
        className="relative overflow-hidden rounded-3xl p-5 text-white shadow-sm"
        style={{ background: "linear-gradient(135deg, #12392e 0%, #167a5b 55%, #2aa37f 100%)" }}
      >
        <div
          aria-hidden="true"
          className="absolute -right-10 -top-12 h-40 w-40 rounded-full opacity-25"
          style={{ background: "radial-gradient(circle, #ffffff 0%, transparent 70%)" }}
        />
        <p className="text-[12px] font-medium uppercase tracking-wider text-white/70">{dateLabel}</p>
        <h1 className="mt-1 text-[26px] font-semibold leading-tight">{greeting()}, Jamie</h1>
        <div className="mt-4 flex flex-wrap gap-2 text-[13px]">
          <HeroChip href="#todo">{openTodos === 0 ? "List is clear ✨" : `${openTodos} to do`}</HeroChip>
          {live("bills") && billsTotal > 0 && (
            <HeroChip href="/bills">{billsLeft > 0 ? `${money(billsLeft)} of bills left` : "Bills all paid ✓"}</HeroChip>
          )}
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        {/* ── Calendar ── */}
        <Suspense fallback={<CalendarSkeleton />}>
          <CalendarSection link={calendarLink} />
        </Suspense>

        {/* ── To do ── */}
        <div id="todo" className="scroll-mt-4">
          <TodoCard initial={todos} today={today} projectSteps={projectSteps} />
        </div>

        {/* ── Bills ── */}
        {shows("bills") && (
          <Link href="/bills" className="group block rounded-3xl border border-border bg-card p-5 transition-shadow hover:shadow-md">
            <CardHead Icon={Receipt} tone="#0e6f8a" title={`Bills · ${billMonthName()}`} />
            {live("bills") ? (
              <>
                <div className="mt-4 flex items-end justify-between">
                  <div>
                    <div className="text-[30px] font-semibold leading-none tabular-nums">{money(billsLeft)}</div>
                    <div className="mt-1 text-[13px] text-muted">left of {money(billsTotal)}</div>
                  </div>
                  <div className="text-right text-[13px] font-medium" style={{ color: "var(--good)" }}>
                    {billsPct}% paid
                  </div>
                </div>
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-tint">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${billsPct}%`, background: "linear-gradient(90deg, #167a5b, #2aa37f)" }}
                  />
                </div>
                {nextUp.length > 0 && (
                  <ul className="mt-3 divide-y divide-border">
                    {nextUp.map((b) => (
                      <li key={b.id} className="flex items-center justify-between py-2 text-[14px]">
                        <span className="truncate">{b.name}</span>
                        <span className="ml-3 shrink-0 tabular-nums text-muted">
                          {money(b.amount)}
                          {b.dueDay ? <span className="ml-2 text-[12px]">due {ordinal(b.dueDay)}</span> : null}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <p className="mt-3 text-[14px] text-muted">Coming soon.</p>
            )}
          </Link>
        )}

        {/* ── The money picture ── */}
        <section className="rounded-3xl border border-border bg-card p-5">
          <CardHead
            Icon={Scale}
            tone="#6d28d9"
            title="Money picture"
            href={live("big-picture") ? "/big-picture" : undefined}
          />
          <div className="mt-4 grid grid-cols-3 gap-2">
            <Stat href={shows("debt") ? "/debt" : undefined} label="You owe" value={money(owe)} color="var(--neg)" note="cards & loans" />
            <Stat href={shows("cars") ? "/cars" : undefined} label="You own" value={money(own)} color="var(--good)" note="cash + car" />
            <Stat
              href={shows("divorce") ? "/divorce" : undefined}
              label="Divorce"
              value={money(divorceTotal)}
              color="var(--warn)"
              note={divorce.support.amount ? `${money(divorce.support.amount)}/mo` : "proposal"}
            />
          </div>
          <div className="mt-3 flex items-center justify-between rounded-2xl bg-tint px-4 py-3">
            <span className="text-[13px] text-muted">Own minus owe</span>
            <span className="text-[17px] font-semibold tabular-nums" style={{ color: net >= 0 ? "var(--good)" : "var(--neg)" }}>
              {net < 0 ? "−" : ""}
              {money(Math.abs(net))}
            </span>
          </div>
        </section>
      </div>

      {/* ── Everything else ── */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {tiles
          .filter((t) => t.key === "logins" || shows(t.key))
          .map((t) => (
            <Link
              key={t.key}
              href={t.href}
              className="flex flex-col rounded-3xl border border-border bg-card p-4 transition-all hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98]"
            >
              <span
                className="flex h-10 w-10 items-center justify-center rounded-2xl"
                style={{ background: `${t.tone}18`, color: t.tone }}
              >
                <t.Icon size={20} />
              </span>
              <span className="mt-3 text-[15px] font-semibold">{t.label}</span>
              <span className="text-[12px] text-muted">{t.sub}</span>
            </Link>
          ))}
      </div>
    </div>
  );
}

// Streams in on its own: Google can take a moment, and the rest of the
// dashboard shouldn't wait for it.
async function CalendarSection({ link }: { link: string | null }) {
  const result = await loadCalendar(link);
  return <CalendarCard result={result} />;
}

function HeroChip({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="rounded-full bg-white/15 px-3 py-1.5 font-medium transition-colors hover:bg-white/25">
      {children}
    </Link>
  );
}

function CardHead({ Icon, tone, title, href }: { Icon: LucideIcon; tone: string; title: string; href?: string }) {
  const inner = (
    <>
      <span className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: `${tone}18`, color: tone }}>
        <Icon size={18} />
      </span>
      <span className="flex-1 text-[16px] font-semibold">{title}</span>
      <ChevronRight size={18} className="text-muted transition-transform group-hover:translate-x-0.5" />
    </>
  );
  return href ? (
    <Link href={href} className="group flex items-center gap-3">
      {inner}
    </Link>
  ) : (
    <div className="flex items-center gap-3">{inner}</div>
  );
}

function Stat({ href, label, value, color, note }: { href?: string; label: string; value: string; color: string; note: string }) {
  const body = (
    <>
      <div className="text-[12px] text-muted">{label}</div>
      <div className="mt-0.5 truncate text-[16px] font-semibold tabular-nums" style={{ color }}>
        {value}
      </div>
      <div className="truncate text-[11px] text-muted">{note}</div>
    </>
  );
  const cls = "block min-w-0 rounded-2xl border border-border px-3 py-2.5";
  return href ? (
    <Link href={href} className={`${cls} transition-colors hover:bg-tint`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
