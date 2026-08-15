import { PageTitle } from "@/components/ui";
import ComingSoon from "@/components/ComingSoon";
import HomeBuyingClient from "@/components/HomeBuyingClient";
import { getHomeBuying } from "@/lib/store";
import { pageGate } from "@/lib/visibility";

export const dynamic = "force-dynamic";

export default async function HomeBuyingPage() {
  const { comingSoon } = await pageGate("home-buying");
  if (comingSoon) return <ComingSoon title="Home Buying" />;

  const saved = await getHomeBuying();

  return (
    <div>
      <PageTitle>Home Buying</PageTitle>
      <p className="-mt-2 mb-4 text-[13px] text-muted">
        Start with what massage can bring in, take the tax off, and see the
        biggest house a lender would let you buy on what&apos;s left.
      </p>
      <HomeBuyingClient initial={saved} />
    </div>
  );
}
