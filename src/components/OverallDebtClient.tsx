"use client";

import { Card } from "@/components/ui";

interface HouseholdDebt {
  name: string;
  balance: number;
  securedBy: "Chris" | "Jamie" | "Joint";
  monthlyPayment: string;
  monthlyInterest: string;
}

interface HouseholdAsset {
  name: string;
  value: number;
  owner: "Chris" | "Jamie" | "Joint";
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

const ASSETS: HouseholdAsset[] = [
  { name: "Rolex watch", value: 25000, owner: "Joint" },
  { name: "Rolex watch", value: 15000, owner: "Joint" },
  { name: "401(k)", value: 35000, owner: "Chris" },
  { name: "Pension", value: 26000, owner: "Chris" },
  { name: "Jewelry", value: 10000, owner: "Jamie" },
  { name: "Miscellaneous items", value: 10000, owner: "Jamie" },
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
  const totalAssets = ASSETS.reduce((sum, a) => sum + a.value, 0);

  const debtByPerson = {
    Chris: DEBTS.filter(d => d.securedBy === "Chris").reduce((sum, d) => sum + d.balance, 0),
    Jamie: DEBTS.filter(d => d.securedBy === "Jamie").reduce((sum, d) => sum + d.balance, 0),
    Joint: DEBTS.filter(d => d.securedBy === "Joint").reduce((sum, d) => sum + d.balance, 0),
  };

  const assetsByOwner = {
    Chris: ASSETS.filter(a => a.owner === "Chris").reduce((sum, a) => sum + a.value, 0),
    Jamie: ASSETS.filter(a => a.owner === "Jamie").reduce((sum, a) => sum + a.value, 0),
    Joint: ASSETS.filter(a => a.owner === "Joint").reduce((sum, a) => sum + a.value, 0),
  };

  const netWorth = totalAssets - totalDebt;

  return (
    <div className="space-y-4">
      {/* Context Notes */}
      <Card className="bg-tint">
        <p className="mb-3 text-[13px] font-medium text-muted">Context</p>
        <ul className="space-y-2 text-[13px] text-muted">
          <li>• Marriage: July 2020 through present</li>
          <li>• Separated: 2023</li>
          <li>• Jamie salary: $147,000 (cash deposits)</li>
          <li>• Chris salary: $135,000 (rental deposits & W-2 income)</li>
          <li>• Condo: Separate property — purchased before marriage</li>
          <li>• Metlife Legal plan covers uncontested divorce legal fees</li>
        </ul>
      </Card>

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

      {/* Assets table */}
      <Card>
        <p className="mb-4 text-[13px] text-muted">All assets</p>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="pb-2 font-medium">Asset</th>
                <th className="pb-2 font-medium text-right">Value</th>
                <th className="pb-2 font-medium text-right">Owner</th>
              </tr>
            </thead>
            <tbody>
              {ASSETS.map((asset, idx) => (
                <tr key={idx} className="border-b border-border last:border-b-0">
                  <td className="py-3 pr-2">{asset.name}</td>
                  <td className="py-3 text-right font-medium">{money(asset.value)}</td>
                  <td className="py-3 text-right">
                    <span
                      className="inline-block px-2 py-1 rounded-full text-xs font-medium text-white"
                      style={{ backgroundColor: getSecuredByColor(asset.owner) }}
                    >
                      {asset.owner}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Net Worth Summary */}
      <Card className="bg-good-bg">
        <p className="mb-3 text-[13px] text-muted">Net worth</p>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm">Total assets</span>
            <span className="font-medium">{money(totalAssets)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Total debts</span>
            <span className="font-medium">−{money(totalDebt)}</span>
          </div>
          <div className="pt-2 border-t border-border flex items-center justify-between">
            <span className="text-sm font-medium">Net worth</span>
            <span className="text-lg font-medium" style={{ color: netWorth >= 0 ? "var(--good)" : "#dc2626" }}>
              {netWorth >= 0 ? "+" : "−"}{money(Math.abs(netWorth))}
            </span>
          </div>
        </div>
      </Card>

      {/* Bank Ownership */}
      <Card>
        <p className="mb-4 text-[13px] text-muted">Bank Ownership</p>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm">Chris's debt</span>
            <span className="font-medium">{money(debtByPerson.Chris)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Jamie's debt</span>
            <span className="font-medium">{money(debtByPerson.Jamie)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Joint debt</span>
            <span className="font-medium">{money(debtByPerson.Joint)}</span>
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
