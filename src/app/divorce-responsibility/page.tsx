import { PageTitle } from "@/components/ui";
import DivorceResponsibilityClient from "@/components/DivorceResponsibilityClient";
import StoryClient from "@/components/StoryClient";
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
  // chapters and figures Chris sees at /divorce/story, rather than a second
  // set written here that disagreed with it.
  const story = await getStory();

  return (
    <div className="space-y-4">
      <PageTitle>The Debt Story</PageTitle>
      <StoryClient story={story} />
      <DivorceResponsibilityClient
        admin={role === "admin" && !jamieView}
        storyHidden
      />
    </div>
  );
}
