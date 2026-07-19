import { CircleCheck, ArrowUpRight, Coffee, ShoppingCart, Banknote } from "lucide-react";
import { Card, Tint } from "@/components/ui";
import { summary, money, moneyCents, type Txn } from "@/lib/data";

const txnIcon = {
  coffee: Coffee,
  groceries: ShoppingCart,
  pay: Banknote,
  bill: Banknote,
  other: Banknote,
} as const;

function Row({ txn }: { txn: Txn }) {
  const Icon = txnIcon[txn.kind];
  const isIn = txn.amount > 0;
  return (
    <div className="flex items-center justify-between border-t border-border py-2.5 text-[15px] first:border-t-0">
      <span className="flex items-center gap-2.5">
        <Icon size={18} className="text-muted" />
        {txn.name}
      </span>
      <span style={{ color: isIn ? "var(--good)" : "var(--text)" }}>{moneyCents(txn.amount)}</span>
    </div>
  );
}

export default function HomePage() {
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

      <div className="rounded-2xl bg-good-bg p-4">
        <div className="flex items-center gap-2 font-medium text-good">
          <CircleCheck size={20} />
          {summary.statusLabel}
        </div>
        <p className="mt-1 text-sm text-good">{summary.statusNote}</p>
      </div>

      <Card>
        <p className="text-[13px] text-muted">Your net worth</p>
        <p className="text-3xl font-medium">{money(summary.netWorth)}</p>
        <p className="mt-1 flex items-center gap-1 text-[13px] text-good">
          <ArrowUpRight size={15} />
          up {money(summary.netWorthChange)} this month
        </p>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Tint>
          <p className="text-xs text-muted">Money in</p>
          <p className="text-lg font-medium text-good">{money(summary.moneyIn)}</p>
        </Tint>
        <Tint>
          <p className="text-xs text-muted">Money out</p>
          <p className="text-lg font-medium">{money(summary.moneyOut)}</p>
        </Tint>
      </div>

      <Card>
        <p className="mb-1 text-[13px] text-muted">Recent</p>
        {summary.recent.map((t) => (
          <Row key={t.id} txn={t} />
        ))}
      </Card>
    </div>
  );
}
