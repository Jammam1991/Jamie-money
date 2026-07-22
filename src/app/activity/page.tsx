import { redirect } from "next/navigation";
import { Activity } from "lucide-react";
import { PageTitle, Card } from "@/components/ui";
import { getRole } from "@/lib/auth";
import { getLogins } from "@/lib/store";

export const dynamic = "force-dynamic";

function when(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function ActivityPage() {
  const role = await getRole();
  if (role !== "admin") redirect("/login");

  const { count, recent } = await getLogins();

  return (
    <div>
      <PageTitle>Activity</PageTitle>

      <div className="mb-4 rounded-2xl bg-good-bg p-4">
        <p className="flex items-center gap-1.5 text-[13px] text-good">
          <Activity size={15} />
          Jamie has logged in
        </p>
        <p className="text-3xl font-medium text-good">
          {count}
          <span className="text-[13px] font-normal"> time{count === 1 ? "" : "s"}</span>
        </p>
      </div>

      <Card>
        <p className="mb-2 text-[13px] text-muted">Recent logins</p>
        {recent.length === 0 ? (
          <p className="py-2 text-[15px] text-muted">
            No logins yet. Once Jamie logs in with his password, they&apos;ll show
            up here.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {recent.map((iso, i) => (
              <div key={i} className="py-2.5 text-[15px]">
                {when(iso)}
              </div>
            ))}
          </div>
        )}
      </Card>

      <p className="mt-3 text-xs text-muted">
        Showing the {recent.length} most recent of {count} total.
      </p>
    </div>
  );
}
