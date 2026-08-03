"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui";
import { Pencil, X } from "lucide-react";
import type { OverallDebt } from "@/lib/store";
import { updateOverallContext } from "@/lib/actions";

interface Props {
  initialDebts: OverallDebt[];
  initialContext: any;
  admin: boolean;
}

function money(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

export default function OverallDebtClient({ initialDebts, initialContext, admin }: Props) {
  const [editing, setEditing] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Jamie's debts
  const jamieDebts = initialDebts.filter((d) => d.securedBy === "Jamie");
  const jamieResponsible = jamieDebts.reduce((sum, d) => sum + d.balance, 0);

  // Parse values from initialContext or use defaults
  const monthlyPayments = 2800; // example - this should be editable
  const financeFeesTotal = 1500; // example - this should be editable
  const interestAccruing = 450; // example - this should be editable

  const jamieAnnualIncome = initialContext.jamieSalary || 147000;
  const monthlyIncome = jamieAnnualIncome / 12;
  const percentageOfIncome = (monthlyPayments / monthlyIncome) * 100;

  if (editing && admin) {
    return <EditMode onClose={() => setEditing(false)} initialContext={initialContext} />;
  }

  return (
    <div className="space-y-4">
      {admin && (
        <button
          onClick={() => setEditing(true)}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-border py-2 text-sm text-muted"
        >
          <Pencil size={15} />
          Edit
        </button>
      )}

      {/* Main Summary */}
      <div className="space-y-2">
        <button
          onClick={() => setSelectedDetail("total")}
          className="w-full text-left rounded-2xl bg-warn-bg border border-border p-4 hover:opacity-80 transition-opacity"
        >
          <p className="text-[13px] text-warn mb-1">Jamie's total responsibility</p>
          <p className="text-4xl font-bold text-warn">{money(jamieResponsible)}</p>
          <p className="text-xs text-warn mt-1">Click to see details</p>
        </button>

        <button
          onClick={() => setSelectedDetail("payments")}
          className="w-full text-left rounded-2xl bg-card border border-border p-4 hover:opacity-80 transition-opacity"
        >
          <p className="text-[13px] text-muted mb-1">Monthly payments</p>
          <p className="text-3xl font-bold">{money(monthlyPayments)}</p>
          <p className="text-xs text-muted mt-1">{percentageOfIncome.toFixed(1)}% of monthly income</p>
        </button>

        <button
          onClick={() => setSelectedDetail("interest")}
          className="w-full text-left rounded-2xl bg-card border border-border p-4 hover:opacity-80 transition-opacity"
        >
          <p className="text-[13px] text-muted mb-1">Interest accruing (during AMLI lease)</p>
          <p className="text-3xl font-bold">{money(interestAccruing)}</p>
          <p className="text-xs text-muted mt-1">Monthly while lease is active</p>
        </button>

        <button
          onClick={() => setSelectedDetail("fees")}
          className="w-full text-left rounded-2xl bg-card border border-border p-4 hover:opacity-80 transition-opacity"
        >
          <p className="text-[13px] text-muted mb-1">Finance fees</p>
          <p className="text-3xl font-bold">{money(financeFeesTotal)}</p>
          <p className="text-xs text-muted mt-1">Click to see breakdown</p>
        </button>
      </div>

      {/* Details Popup */}
      {selectedDetail && (
        <Card className="bg-tint">
          <div className="flex items-start justify-between mb-3">
            <p className="text-sm font-medium">Details</p>
            <button onClick={() => setSelectedDetail(null)} className="p-1 hover:bg-border rounded">
              <X size={16} />
            </button>
          </div>

          {selectedDetail === "total" && (
            <div className="space-y-2 text-[13px]">
              {jamieDebts.map((debt) => (
                <div key={debt.id} className="flex justify-between">
                  <span>{debt.name}</span>
                  <span className="font-medium">{money(debt.balance)}</span>
                </div>
              ))}
              <div className="pt-2 border-t border-border flex justify-between font-medium">
                <span>Total</span>
                <span>{money(jamieResponsible)}</span>
              </div>
            </div>
          )}

          {selectedDetail === "payments" && (
            <div className="space-y-2 text-[13px]">
              <div>
                <p className="text-muted mb-1">Monthly income: {money(monthlyIncome)}</p>
                <p className="text-muted mb-2">Payment percentage: {percentageOfIncome.toFixed(1)}%</p>
                <p className="font-medium text-base">{money(monthlyPayments)}/month</p>
              </div>
            </div>
          )}

          {selectedDetail === "interest" && (
            <div className="space-y-2 text-[13px]">
              <p className="text-muted">Interest accumulating while AMLI lease is active</p>
              <p className="font-medium text-base">{money(interestAccruing)}/month</p>
              <p className="text-muted text-xs mt-2">No payments required during lease period</p>
            </div>
          )}

          {selectedDetail === "fees" && (
            <div className="space-y-2 text-[13px]">
              <p className="text-muted">Finance fees breakdown:</p>
              <div className="flex justify-between">
                <span>Total fees</span>
                <span className="font-medium">{money(financeFeesTotal)}</span>
              </div>
              <p className="text-muted text-xs mt-2">Click edit to adjust details</p>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

function EditMode({ onClose, initialContext }: { onClose: () => void; initialContext: any }) {
  const [monthlyPayments, setMonthlyPayments] = useState("2800");
  const [financeFeesTotal, setFinanceFeesTotal] = useState("1500");
  const [interestAccruing, setInterestAccruing] = useState("450");
  const [isPending, startTransition] = useTransition();

  const inputClass =
    "w-full rounded-lg border border-border bg-card px-3 py-2 text-[13px] outline-none focus:border-[var(--muted)]";

  return (
    <div className="space-y-4">
      <Card>
        <p className="mb-4 text-sm font-medium">Edit Jamie's Responsibility</p>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted block mb-1">Monthly Payments</label>
            <input
              type="number"
              value={monthlyPayments}
              onChange={(e) => setMonthlyPayments(e.target.value)}
              className={inputClass}
              disabled={isPending}
            />
          </div>

          <div>
            <label className="text-xs text-muted block mb-1">Finance Fees Total</label>
            <input
              type="number"
              value={financeFeesTotal}
              onChange={(e) => setFinanceFeesTotal(e.target.value)}
              className={inputClass}
              disabled={isPending}
            />
          </div>

          <div>
            <label className="text-xs text-muted block mb-1">Interest Accruing (monthly)</label>
            <input
              type="number"
              value={interestAccruing}
              onChange={(e) => setInterestAccruing(e.target.value)}
              className={inputClass}
              disabled={isPending}
            />
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-border py-2 text-sm font-medium hover:bg-tint transition-colors"
          >
            Done
          </button>
        </div>
      </Card>
    </div>
  );
}
