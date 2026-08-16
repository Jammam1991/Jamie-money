import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Scale } from "lucide-react";
import CashClient from "@/components/CashClient";
import { getBills, getCashLog } from "@/lib/store";
import { getRole } from "@/lib/auth";
import { jamiePageState } from "@/lib/visibility";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const role = await getRole();
  if (!role) redirect("/login");
  const [entries, bills, jamie] = await Promise.all([
    getCashLog(),
    getBills(),
    jamiePageState(),
  ]);
  // The side-trip card goes with the page. Parked as "Coming Soon" it stays —
  // that's the point of parking rather than hiding.
  const showCompare = !jamie.removed.includes("compare");

  const now = new Date();
  const today = now.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  // What next month's bills add up to — the target Jamie is saving toward.
  const nextMonthName = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    1
  ).toLocaleDateString("en-US", { month: "long" });
  const nextMonthTotal = bills.reduce((s, b) => s + b.amount, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <span className="text-lg font-medium">Hi Jamie</span>
        <span className="text-[13px] text-muted">{today}</span>
      </div>
      <CashClient
        initialEntries={entries}
        admin={role === "admin"}
        nextMonthName={nextMonthName}
        nextMonthTotal={nextMonthTotal}
      />
      {/* Optional side trip: what a W-2 job would have to pay to match the
          business. Only here if he feels like looking. */}
      {showCompare && (
        <Link
          href="/compare"
          className="flex items-center justify-between rounded-2xl border border-border bg-card p-4"
        >
          <span className="flex items-center gap-2.5 text-[15px]">
            <Scale size={18} className="text-muted" />
            Job vs Business
          </span>
          <ChevronRight size={18} className="shrink-0 text-muted" />
        </Link>
      )}
    </div>
  );
}
