import { PageTitle, Card } from "@/components/ui";
import ComingSoon from "@/components/ComingSoon";
import GymStoryClient from "@/components/GymStoryClient";
import { pageGate } from "@/lib/visibility";
import { businessFinancesReady } from "@/lib/businessFinances";
import { getGymStory } from "@/lib/gymStory";

export const dynamic = "force-dynamic";

export default async function GymStoryPage() {
  const { comingSoon } = await pageGate("gym-story");
  if (comingSoon) return <ComingSoon title="Gym Story" />;

  const { story, error } = await getGymStory();

  if (!story) {
    return (
      <div>
        <PageTitle>Gym Story</PageTitle>
        <Card>
          <p className="text-[15px] font-medium">Nothing to show yet</p>
          <p className="mt-1 text-[14px] text-muted">{error}</p>
          {!businessFinancesReady() && (
            <p className="mt-3 text-xs text-muted">
              Setup note: this page reads the same Money App feed as Business
              Finances — add <code>MONEYAPP_API_URL</code>,{" "}
              <code>MONEYAPP_API_KEY</code>, and <code>MONEYAPP_SHARED_EMAIL</code>{" "}
              in Vercel if they aren&apos;t set yet.
            </p>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div>
      <GymStoryClient story={story} />
    </div>
  );
}
