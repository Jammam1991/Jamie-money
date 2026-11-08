import { PageTitle } from "@/components/ui";
import ComingSoon from "@/components/ComingSoon";
import HomeBuyingClient from "@/components/HomeBuyingClient";
import HomeFinder from "@/components/HomeFinder";
import { getHomeBuying, getHomePlan, getWeeklyIncome } from "@/lib/store";
import { DEFAULT_HOME_BUYING } from "@/lib/homeBuying";
import { listingsReady } from "@/lib/listings";
import { analysisReady } from "@/lib/homeAnalysis";
import { pageGate } from "@/lib/visibility";

export const dynamic = "force-dynamic";

// "Save & ask Claude" runs on this page, and a careful read of a messy
// situation can take most of a minute.
export const maxDuration = 60;

export default async function HomeBuyingPage() {
  const { comingSoon } = await pageGate("home-buying");
  if (comingSoon) return <ComingSoon title="Home Buying" />;

  const [saved, weekly, plan] = await Promise.all([getHomeBuying(), getWeeklyIncome(), getHomePlan()]);

  // First visit starts from what he already earns in a week rather than a
  // number picked out of the air, so the page opens on his own life.
  const initial = saved ?? {
    ...DEFAULT_HOME_BUYING,
    yearlyMassage: Math.round(weekly * 52),
  };

  return (
    <div>
      <PageTitle>Home Buying</PageTitle>
      <p className="-mt-2 mb-4 text-[13px] text-muted">
        What makes sense for you, and real homes for sale that fit — with what each one would cost every month.
      </p>
      <HomeFinder plan={plan} inputs={initial} listingsOn={listingsReady()} claudeOn={analysisReady()} />

      {/* The full calculator, folded away: the knobs behind every payment above. */}
      <details className="group mt-6 rounded-3xl border border-border bg-card">
        <summary className="cursor-pointer list-none px-5 py-4 text-[15px] font-semibold">
          The math behind it <span className="text-[13px] font-normal text-muted">— rate, tax, how much a lender allows</span>
        </summary>
        <div className="border-t border-border p-4">
          <HomeBuyingClient initial={initial} />
        </div>
      </details>
    </div>
  );
}
