import { Card, PageTitle } from "@/components/ui";

// Shown the instant "My Debt" is tapped, while the real page is still being
// built on the server. Without it the tap does nothing visible until every
// figure has been fetched, which reads as "the app is stuck" — the numbers take
// a moment because they come from Money App and the gym dashboard, not because
// nothing is happening.
//
// It mirrors the real layout (the new-debt card with its switch, the total
// with its four buckets, then a row apiece for the folded detail) so the page
// doesn't jump around when the figures land.
export default function Loading() {
  return (
    <div>
      <PageTitle>Debt</PageTitle>
      <div className="animate-pulse space-y-3">
        <div
          className="rounded-2xl border p-4"
          style={{
            background: "linear-gradient(150deg, #fff6f2 0%, #ffeae4 55%, #f6ecfb 100%)",
            borderColor: "#f3d9d0",
          }}
        >
          <div className="h-8 w-full rounded-full bg-white/60" />
          <div className="mt-4 h-3 w-36 rounded bg-black/10" />
          <div className="mt-2 h-8 w-32 rounded bg-black/10" />
        </div>

        <Card>
          <div className="grid grid-cols-2 gap-6">
            <div className="h-9 rounded bg-tint" />
            <div className="h-9 rounded bg-tint" />
          </div>
          <div className="mt-3 h-3 w-full rounded-full bg-tint" />
          <div className="mt-3 space-y-2">
            <div className="h-14 w-full rounded-xl bg-tint" />
            <div className="h-14 w-full rounded-xl bg-tint" />
            <div className="h-14 w-full rounded-xl bg-tint" />
            <div className="h-14 w-full rounded-xl bg-tint" />
          </div>
        </Card>

        <div className="h-3 w-24 rounded bg-tint" />
        {[0, 1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <div className="h-4 w-2/3 rounded bg-tint" />
          </Card>
        ))}
      </div>
    </div>
  );
}
