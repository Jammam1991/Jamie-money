import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { PageTitle, Card } from "@/components/ui";
import SpendingHistory from "@/components/SpendingHistory";
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

  return (
    <div className="space-y-4">
      <PageTitle>The Debt Story</PageTitle>

      {/* The story itself lives in Money App. This page used to redraw it from
          an export and kept getting it subtly wrong — preview lines in a
          different order, sections missing, a chapter understated by $2,500.
          Now it opens the real one, on a pass that grants that page and
          nothing else. */}
      <Card>
        <p className="text-[15px]">
          The full record — what Chris covered, what you owe, and where every
          number comes from.
        </p>
        <p className="mt-1 text-[13px] text-muted">
          It opens in Money App, where the record is kept, so what you read is
          always the current version.
        </p>
        <Link
          href="/story"
          // Don't prefetch: /story mints a fresh pass every time it's asked, so
          // a prefetch spends one for a tap that may never come — and leaves the
          // router holding a redirect built earlier than the tap.
          prefetch={false}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl py-3 text-sm font-medium text-white"
          style={{ background: "linear-gradient(135deg, #a56814 0%, #7d4a0b 100%)" }}
        >
          Read the story
          <ArrowUpRight size={16} />
        </Link>
      </Card>

      {role === "admin" && !jamieView && <SpendingHistory />}
    </div>
  );
}
