import { PageTitle } from "@/components/ui";
import ComingSoon from "@/components/ComingSoon";
import HomeBuyingClient from "@/components/HomeBuyingClient";
import { getHomeBuying, getWeeklyIncome } from "@/lib/store";
import { DEFAULT_HOME_BUYING } from "@/lib/homeBuying";
import { pageGate } from "@/lib/visibility";

export const dynamic = "force-dynamic";

export default async function HomeBuyingPage() {
  const { comingSoon } = await pageGate("home-buying");
  if (comingSoon) return <ComingSoon title="Home Buying" />;

  const [saved, weekly] = await Promise.all([getHomeBuying(), getWeeklyIncome()]);

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
        Start with what massage can bring in, take the tax off, and see the
        biggest house a lender would let you buy on what&apos;s left.
      </p>
      <HomeBuyingClient initial={initial} />
    </div>
  );
}
