import ComingSoon from "@/components/ComingSoon";
import MoneyStoryClient from "@/components/MoneyStoryClient";
import { pageGate } from "@/lib/visibility";
import { getMoneyStory } from "@/lib/moneyStory";

export const dynamic = "force-dynamic";

export default async function MoneyStoryPage() {
  const { comingSoon } = await pageGate("money-story");
  if (comingSoon) return <ComingSoon title="Our Money Story" />;

  const story = getMoneyStory();

  return (
    <div>
      <MoneyStoryClient story={story} />
    </div>
  );
}
