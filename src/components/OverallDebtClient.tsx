"use client";

import { Card } from "@/components/ui";

interface HouseholdDebt {
  name: string;
  balance: number;
  securedBy: "Chris" | "Jamie" | "Joint";
  monthlyPayment: string;
  monthlyInterest: string;
}

const DEBTS: HouseholdDebt[] = [
  {
    name: "Home Equity Loan",
    balance: 210000,
    securedBy: "Chris",
    monthlyPayment: "TBD",
    monthlyInterest: "TBD",
  },
  {
    name: "Auto Loan",
    balance: 86000,
    securedBy: "Joint",
    monthlyPayment: "TBD",
    monthlyInterest: "TBD",
  },
  {
    name: "Jamie Personal Credit Cards",
    balance: 35000,
    securedBy: "Jamie",
    monthlyPayment: "TBD",
    monthlyInterest: "TBD",
  },
  {
    name: "Personal Loan (Dad)",
    balance: 55000,
    securedBy: "Chris",
    monthlyPayment: "TBD",
    monthlyInterest: "TBD",
  },
  {
    name: "Chris Credit Card Debt",
    balance: 25000,
    securedBy: "Chris",
    monthlyPayment: "TBD",
    monthlyInterest: "TBD",
  },
  {
    name: "Personal Line of Credit",
    balance: 20000,
    securedBy: "Chris",
    monthlyPayment: "TBD",
    monthlyInterest: "TBD",
  },
  {
    name: "Line of Credit",
    balance: 30000,
    securedBy: "Chris",
    monthlyPayment: "TBD",
    monthlyInterest: "TBD",
  },
  {
    name: "Business Loan",
    balance: 45000,
    securedBy: "Jamie",
    monthlyPayment: "TBD",
    monthlyInterest: "TBD",
  },
  {
    name: "Business Credit Card",
    balance: 6000,
    securedBy: "Jamie",
    monthlyPayment: "TBD",
    monthlyInterest: "TBD",
  },
  {
    name: "Business Loan (small)",
    balance: 2500,
    securedBy: "Jamie",
    monthlyPayment: "TBD",
    monthlyInterest: "TBD",
  },
];

function money(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function getSecuredByColor(secured: string): string {
  switch (secured) {
    case "Chris":
      return "#0e6f8a"; // blue-ish
    case "Jamie":
      return "#9a6212"; // warm
    default:
      return "#167a5b"; // green
  }
}

export default function OverallDebtClient() {
  const totalDebt = DEBTS.reduce((sum, d) => sum + d.balance, 0);

  const breakdownByPerson = {
    Chris: DEBTS.filter(d => d.securedBy === "Chris").reduce((sum, d) => sum + d.balance, 0),
    Jamie: DEBTS.filter(d => d.securedBy === "Jamie").reduce((sum, d) => sum + d.balance, 0),
    Joint: DEBTS.filter(d => d.securedBy === "Joint").reduce((sum, d) => sum + d.balance, 0),
  };

  return (
    <div className="space-y-4">
      {/* Total debt */}
      <div className="rounded-2xl bg-warn-bg p-4">
        <p className="text-[13px] text-warn">Total communal property</p>
        <p className="text-3xl font-medium text-warn">{money(totalDebt)}</p>
      </div>

      {/* Debt table */}
      <Card>
        <p className="mb-4 text-[13px] text-muted">All debts</p>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="pb-2 font-medium">Debt</th>
                <th className="pb-2 font-medium text-right">Balance</th>
                <th className="pb-2 font-medium text-right">Secured by</th>
              </tr>
            </thead>
            <tbody>
              {DEBTS.map((debt, idx) => (
                <tr key={idx} className="border-b border-border last:border-b-0">
                  <td className="py-3 pr-2">{debt.name}</td>
                  <td className="py-3 text-right font-medium">{money(debt.balance)}</td>
                  <td className="py-3 text-right">
                    <span
                      className="inline-block px-2 py-1 rounded-full text-xs font-medium text-white"
                      style={{ backgroundColor: getSecuredByColor(debt.securedBy) }}
                    >
                      {debt.securedBy}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Bank Ownership */}
      <Card>
        <p className="mb-4 text-[13px] text-muted">Bank Ownership</p>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm">Chris's debt</span>
            <span className="font-medium">{money(breakdownByPerson.Chris)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Jamie's debt</span>
            <span className="font-medium">{money(breakdownByPerson.Jamie)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Joint debt</span>
            <span className="font-medium">{money(breakdownByPerson.Joint)}</span>
          </div>
        </div>
      </Card>

      {/* Actual Ownership Responsibility */}
      <Card>
        <p className="mb-4 text-[13px] text-muted">Actual Ownership Responsibility</p>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm">Jamie's responsibility</span>
            <span className="font-medium">{money(88500)}</span>
          </div>
          <p className="text-xs text-muted">Personal credit cards ($35k) + business debt ($53.5k)</p>
          <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
            <span className="text-sm">Shared responsibility</span>
            <span className="font-medium">{money(86000)}</span>
          </div>
          <p className="text-xs text-muted">Joint auto loan — split depends on asset/income division</p>
          <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
            <span className="text-sm">Chris's responsibility</span>
            <span className="font-medium">{money(365000)}</span>
          </div>
          <p className="text-xs text-muted">Secured in Chris's name — though home equity tied to marital home</p>
        </div>
      </Card>

      {/* Summary notes */}
      <Card>
        <p className="text-[13px] text-muted">Monthly payments & interest</p>
        <p className="mt-2 text-xs text-muted">
          Payment and interest details marked as TBD pending account review.
        </p>
      </Card>
    </div>
  );
}
