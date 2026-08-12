import { PageTitle } from "@/components/ui";
import StoryClient from "@/components/StoryClient";
import SpendingHistory from "@/components/SpendingHistory";
import { getStory } from "@/lib/story";
import { isJamieView, pageGate } from "@/lib/visibility";
import ComingSoon from "@/components/ComingSoon";

export const dynamic = "force-dynamic";

export default async function DivorceResponsibilityPage() {
  const { role, comingSoon } = await pageGate("divorce-responsibility");
  if (comingSoon) return <ComingSoon title="The Debt Story" />;

  // The spending-history section is Chris's working material, so it's off for
  // Jamie AND for Chris while "View as Jamie" is on — that way the toggle is a
  // real check on what Jamie sees, not just a nav preview.
  const jamieView = await isJamieView();

  // The story is Money App's evidence file, read over the API — the same
  // chapters and figures Chris sees at /divorce/story.
  //
  // Framing Money App's actual page was tried and reverted: that page builds
  // its data from the signed-in Money App user, and Jamie has no Money App
  // account, so it rendered its own error page inside the frame.
  const story = await getStory();

  return (
    <div className="space-y-4">
      <PageTitle>The Debt Story</PageTitle>
      <StoryClient story={story} />
      {/* Chris's own working material. Off for Jamie, and off for Chris while
          "View as Jamie" is on, so the toggle is a real check on what Jamie
          sees rather than a nav preview. */}
      {role === "admin" && !jamieView && <SpendingHistory />}
    </div>
  );
}
