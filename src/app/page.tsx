import { redirect } from "next/navigation";
import CashClient from "@/components/CashClient";
import { getBills, getCashLog } from "@/lib/store";
import { getRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const role = await getRole();
  if (!role) redirect("/login");
  const [entries, bills] = await Promise.all([getCashLog(), getBills()]);

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
    </div>
  );
}
