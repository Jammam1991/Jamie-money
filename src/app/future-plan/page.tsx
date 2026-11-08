import Link from "next/link";
import { Briefcase, ChevronRight, CreditCard, Home as HomeIcon, PiggyBank, type LucideIcon } from "lucide-react";
import ComingSoon from "@/components/ComingSoon";
import { getDebts, getHomePlan } from "@/lib/store";
import { getJobApplications } from "@/lib/careerStore";
import { money } from "@/lib/data";
import { jamiePageState, pageGate } from "@/lib/visibility";
import type { PageKey } from "@/lib/pages";

export const dynamic = "force-dynamic";

// ── Future Plan ──────────────────────────────────────────────────────────────
// Where he's headed, in four parts (Chris, 2026-11-07: "sections for 1. Debt
// Management. 2. Home Buying. 3. IRA. 4. Career"). Each is a door to the page
// that does the work, with the one number that says where it stands today.

export default async function FuturePlanPage() {
  const { comingSoon } = await pageGate("future-plan");
  if (comingSoon) return <ComingSoon title="Future Plan" />;

  const [{ removed, comingSoon: parked }, debts, plan, jobs] = await Promise.all([
    jamiePageState(),
    getDebts(),
    getHomePlan(),
    getJobApplications(),
  ]);
  const live = (key: PageKey) => !removed.includes(key) && !parked.includes(key);

  const personal = debts.filter((d) => d.scope !== "business");
  const owe = personal.reduce((s, d) => s + d.balance, 0);
  const minimums = personal.reduce((s, d) => s + (d.minPayment || d.monthly || 0), 0);
  const activeJobs = jobs.filter((j) => j.status !== "Rejected").length;
  const home = plan.analysis;

  const sections: {
    n: number;
    key: PageKey;
    href: string;
    title: string;
    Icon: LucideIcon;
    tone: string;
    stat: string;
    blurb: string;
  }[] = [
    {
      n: 1,
      key: "big-picture",
      href: removed.includes("big-picture") ? "/debt" : "/big-picture",
      title: "Debt Management",
      Icon: CreditCard,
      tone: "#b3261e",
      stat: owe > 0 ? `${money(owe)} to pay down` : "Debt-free 🎉",
      blurb: minimums > 0 ? `${money(minimums)} a month in minimums. The plan for getting it to zero.` : "The plan for staying out of debt.",
    },
    {
      n: 2,
      key: "home-buying",
      href: "/home-buying",
      title: "Home Buying",
      Icon: HomeIcon,
      tone: "#9a6212",
      stat: home ? `Homes up to ${money(home.comfortablePrice)}` : "Find homes that fit",
      blurb: home ? home.headline : "What you can afford, and real homes for sale that fit it.",
    },
    {
      n: 3,
      key: "retirement",
      href: "/retirement",
      title: "IRA",
      Icon: PiggyBank,
      tone: "#167a5b",
      stat: "Retirement savings",
      blurb: "What goes in, how it grows, and what it's worth at 60.",
    },
    {
      n: 4,
      key: "career",
      href: "/career",
      title: "Career",
      Icon: Briefcase,
      tone: "#0e6f8a",
      stat: activeJobs ? `${activeJobs} job${activeJobs === 1 ? "" : "s"} in play` : "Your next move",
      blurb: "The paths you're weighing, the jobs you've applied for, and who can help.",
    },
  ];

  return (
    <div className="space-y-4">
      <section
        className="rounded-3xl p-5 text-white shadow-sm"
        style={{ background: "linear-gradient(135deg, #12392e 0%, #0e6f8a 60%, #2a9dbb 100%)" }}
      >
        <p className="text-[12px] font-medium uppercase tracking-wider text-white/70">Future Plan</p>
        <h1 className="mt-1 text-[24px] font-semibold leading-tight">Where you&apos;re headed</h1>
        <p className="mt-2 text-[14px] text-white/85">Four parts. Tap one to work on it.</p>
      </section>

      <div className="grid gap-3 md:grid-cols-2">
        {sections
          .filter((s) => live(s.key) || (s.key === "big-picture" && live("debt")))
          .map((s) => (
            <Link
              key={s.n}
              href={s.href}
              className="group flex items-start gap-4 rounded-3xl border border-border bg-card p-5 transition-all hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99]"
            >
              <span
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
                style={{ background: `${s.tone}18`, color: s.tone }}
              >
                <s.Icon size={22} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="text-[12px] font-medium text-muted">{s.n}.</span>
                <span className="block text-[17px] font-semibold leading-tight">{s.title}</span>
                <span className="mt-1 block text-[15px] font-medium" style={{ color: s.tone }}>
                  {s.stat}
                </span>
                <span className="mt-1 block text-[13px] text-muted">{s.blurb}</span>
              </span>
              <ChevronRight size={18} className="mt-1 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" />
            </Link>
          ))}
      </div>
    </div>
  );
}
