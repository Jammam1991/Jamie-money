import { Flag } from "lucide-react";
import { Card, Bar, PageTitle } from "@/components/ui";
import { debtFreeBy, money } from "@/lib/data";
import { getDebts } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function DebtPage() {
  const debts = await getDebts();
  const total = debts.reduce((sum, d) => sum + d.balance, 0);

  return (
    <div>
      <PageTitle>Debt</PageTitle>

      <div className="mb-4 rounded-2xl bg-warn-bg p-4">
        <p className="text-[13px] text-warn">You owe in total</p>
        <p className="text-3xl font-medium text-warn">{money(total)}</p>
      </div>

      <div className="space-y-3">
        {debts.map((d) => (
          <Card key={d.id}>
            <div className="flex items-center justify-between font-medium">
              <span>{d.name}</span>
              <span>{money(d.balance)}</span>
            </div>
            <p className="mb-2 mt-1 text-xs text-muted">
              {money(d.monthly)}/mo · {d.paidPct}% paid off
            </p>
            <Bar pct={d.paidPct} />
          </Card>
        ))}
      </div>

      <div className="mt-4 rounded-2xl bg-good-bg p-4 text-center">
        <p className="flex items-center justify-center gap-1.5 text-[13px] text-good">
          <Flag size={15} />
          Debt-free by
        </p>
        <p className="text-lg font-medium text-good">{debtFreeBy}</p>
      </div>
    </div>
  );
}
