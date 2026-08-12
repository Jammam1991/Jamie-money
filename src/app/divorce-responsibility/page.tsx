import { PageTitle } from "@/components/ui";
import StoryPage from "@/components/StoryPage";
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

  // The story is Money App's own page, framed — one renderer for one document.
  // This fetch is only the safety net behind it: if Money App can't be reached,
  // the page falls back to this app's older drawing rather than a blank space.
  const story = await getStory();

  return (
    <div className="space-y-4">
      <PageTitle>The Debt Story</PageTitle>
      <StoryPage story={story} />
      {/* Chris's own working material. Off for Jamie, and off for Chris while
          "View as Jamie" is on, so the toggle is a real check on what Jamie
          sees rather than a nav preview. */}
      {role === "admin" && !jamieView && <SpendingHistory />}
    </div>
  );
}
