import { Card, PageTitle } from "@/components/ui";

// Shown the instant "My Debt" is tapped, while the real page is still being
// built on the server. Without it the tap does nothing visible until every
// figure has been fetched, which reads as "the app is stuck" — the numbers take
// a moment because they come from Money App and the gym dashboard, not because
// nothing is happening.
//
// It mirrors the real layout (brown headline tile, then the year-by-year card)
// so the page doesn't jump around when the figures land.
export default function Loading() {
  return (
    <div>
      <PageTitle>Debt</PageTitle>
      <div className="animate-pulse space-y-4">
        <div
          className="rounded-2xl p-4"
          style={{ background: "linear-gradient(135deg, #a56814 0%, #7d4a0b 100%)" }}
        >
          <div className="h-3 w-40 rounded bg-white/30" />
          <div className="mt-2 h-8 w-32 rounded bg-white/40" />
          <div className="mt-4 h-3 w-full rounded bg-white/20" />
        </div>

        <Card>
          <div className="h-3 w-24 rounded bg-tint" />
          <div className="mt-3 h-4 w-3/4 rounded bg-tint" />
          <div className="mt-2 h-4 w-1/2 rounded bg-tint" />
          <div className="mt-4 h-20 w-full rounded-xl bg-tint" />
          <div className="mt-4 space-y-2">
            <div className="h-12 w-full rounded-xl bg-tint" />
            <div className="h-12 w-full rounded-xl bg-tint" />
            <div className="h-12 w-full rounded-xl bg-tint" />
          </div>
        </Card>
      </div>
    </div>
  );
}
