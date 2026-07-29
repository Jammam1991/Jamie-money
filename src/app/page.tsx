import { redirect } from "next/navigation";
import CashClient from "@/components/CashClient";
import { getCashLog } from "@/lib/store";
import { getRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const role = await getRole();
  if (!role) redirect("/login");
  const entries = await getCashLog();

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <span className="text-lg font-medium">Hi Jamie</span>
        <span className="text-[13px] text-muted">{today}</span>
      </div>
      <CashClient initialEntries={entries} admin={role === "admin"} />
    </div>
  );
}
