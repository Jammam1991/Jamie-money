"use client";

import { useState, useTransition } from "react";
import { Card, Tint } from "@/components/ui";
import { Plus, Trash2, Pencil } from "lucide-react";
import type { OverallDebt, OverallAsset, OverallContext } from "@/lib/store";
import {
  addOverallDebt,
  updateOverallDebt,
  deleteOverallDebt,
  addOverallAsset,
  updateOverallAsset,
  deleteOverallAsset,
  updateOverallContext,
} from "@/lib/actions";

interface Props {
  initialDebts: OverallDebt[];
  initialAssets: OverallAsset[];
  initialContext: OverallContext;
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

function getOwnerColor(owner: string): string {
  switch (owner) {
    case "Chris":
      return "#0e6f8a";
    case "Jamie":
      return "#9a6212";
    default:
      return "#167a5b";
  }
}

export default function OverallDebtClient({
  initialDebts,
  initialAssets,
  initialContext,
  admin,
}: Props) {
  const [debts, setDebts] = useState(initialDebts);
  const [assets, setAssets] = useState(initialAssets);
  const [context, setContext] = useState(initialContext);
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();

  const totalDebt = debts.reduce((sum, d) => sum + d.balance, 0);
  const totalAssets = assets.reduce((sum, a) => sum + a.value, 0);
  const netWorth = totalAssets - totalDebt;

  const debtByPerson = {
    Chris: debts.filter((d) => d.securedBy === "Chris").reduce((sum, d) => sum + d.balance, 0),
    Jamie: debts.filter((d) => d.securedBy === "Jamie").reduce((sum, d) => sum + d.balance, 0),
    Joint: debts.filter((d) => d.securedBy === "Joint").reduce((sum, d) => sum + d.balance, 0),
  };

  const assetsByOwner = {
    Chris: assets.filter((a) => a.owner === "Chris").reduce((sum, a) => sum + a.value, 0),
    Jamie: assets.filter((a) => a.owner === "Jamie").reduce((sum, a) => sum + a.value, 0),
    Joint: assets.filter((a) => a.owner === "Joint").reduce((sum, a) => sum + a.value, 0),
  };

  const onDeleteDebt = (id: string) => {
    startTransition(async () => {
      const result = await deleteOverallDebt(id);
      if (result.ok) {
        setDebts(debts.filter((d) => d.id !== id));
      }
    });
  };

  const onDeleteAsset = (id: string) => {
    startTransition(async () => {
      const result = await deleteOverallAsset(id);
      if (result.ok) {
        setAssets(assets.filter((a) => a.id !== id));
      }
    });
  };

  if (editing && admin) {
    return (
      <EditMode
        debts={debts}
        assets={assets}
        context={context}
        onSave={() => setEditing(false)}
        onAddDebt={(debt) => setDebts([...debts, debt])}
        onDeleteDebt={onDeleteDebt}
        onAddAsset={(asset) => setAssets([...assets, asset])}
        onDeleteAsset={onDeleteAsset}
        isPending={isPending}
        startTransition={startTransition}
      />
    );
  }

  return (
    <div className="space-y-4">
      {admin && (
        <button
          onClick={() => setEditing(true)}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-border py-2 text-sm text-muted"
        >
          <Pencil size={15} />
          Edit debts & assets
        </button>
      )}

      {/* Context Notes */}
      <Card className="bg-tint">
        <p className="mb-3 text-[13px] font-medium text-muted">Context</p>
        <ul className="space-y-2 text-[13px] text-muted">
          <li>• Marriage: {context.marriageStartDate} through {context.marriageEndDate}</li>
          <li>• Separated: {context.separatedDate}</li>
          <li>• Jamie salary: ${context.jamieSalary.toLocaleString()} ({context.jamieSalaryNote})</li>
          <li>• Chris salary: ${context.chrisSalary.toLocaleString()} ({context.chrisSalaryNote})</li>
          <li>• Condo: {context.condoNote}</li>
          <li>• {context.legalPlanNote}</li>
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
              {debts.map((debt) => (
                <tr key={debt.id} className="border-b border-border last:border-b-0">
                  <td className="py-3 pr-2">{debt.name}</td>
                  <td className="py-3 text-right font-medium">{money(debt.balance)}</td>
                  <td className="py-3 text-right">
                    <span
                      className="inline-block px-2 py-1 rounded-full text-xs font-medium text-white"
                      style={{ backgroundColor: getOwnerColor(debt.securedBy) }}
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
              {assets.map((asset) => (
                <tr key={asset.id} className="border-b border-border last:border-b-0">
                  <td className="py-3 pr-2">{asset.name}</td>
                  <td className="py-3 text-right font-medium">{money(asset.value)}</td>
                  <td className="py-3 text-right">
                    <span
                      className="inline-block px-2 py-1 rounded-full text-xs font-medium text-white"
                      style={{ backgroundColor: getOwnerColor(asset.owner) }}
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
          <p className="text-xs text-muted">
            Secured in Chris's name — though home equity tied to marital home
          </p>
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

function EditMode({
  debts,
  assets,
  context,
  onSave,
  onAddDebt,
  onDeleteDebt,
  onAddAsset,
  onDeleteAsset,
  isPending,
  startTransition,
}: {
  debts: OverallDebt[];
  assets: OverallAsset[];
  context: OverallContext;
  onSave: () => void;
  onAddDebt: (debt: OverallDebt) => void;
  onDeleteDebt: (id: string) => void;
  onAddAsset: (asset: OverallAsset) => void;
  onDeleteAsset: (id: string) => void;
  isPending: boolean;
  startTransition: (fn: () => Promise<void>) => void;
}) {
  const [debtName, setDebtName] = useState("");
  const [debtBalance, setDebtBalance] = useState("0");
  const [debtOwner, setDebtOwner] = useState<"Chris" | "Jamie" | "Joint">("Joint");

  const [assetName, setAssetName] = useState("");
  const [assetValue, setAssetValue] = useState("0");
  const [assetOwner, setAssetOwner] = useState<"Chris" | "Jamie" | "Joint">("Joint");

  const handleAddDebt = () => {
    if (!debtName.trim()) return;
    startTransition(async () => {
      const result = await addOverallDebt({
        name: debtName,
        balance: Number(debtBalance),
        secured_by: debtOwner,
      });
      if (result.ok) {
        setDebtName("");
        setDebtBalance("0");
        setDebtOwner("Joint");
      }
    });
  };

  const handleAddAsset = () => {
    if (!assetName.trim()) return;
    startTransition(async () => {
      const result = await addOverallAsset({
        name: assetName,
        value: Number(assetValue),
        owner: assetOwner,
      });
      if (result.ok) {
        setAssetName("");
        setAssetValue("0");
        setAssetOwner("Joint");
      }
    });
  };

  const inputClass =
    "w-full rounded-lg border border-border bg-card px-3 py-2 text-[13px] outline-none focus:border-[var(--muted)]";

  return (
    <div className="space-y-4">
      <Card>
        <p className="mb-4 text-[13px] font-medium text-muted">Add debt</p>
        <div className="space-y-2">
          <input
            type="text"
            placeholder="Debt name"
            value={debtName}
            onChange={(e) => setDebtName(e.target.value)}
            className={inputClass}
            disabled={isPending}
          />
          <input
            type="number"
            placeholder="Balance"
            value={debtBalance}
            onChange={(e) => setDebtBalance(e.target.value)}
            className={inputClass}
            disabled={isPending}
          />
          <select value={debtOwner} onChange={(e) => setDebtOwner(e.target.value as any)} className={inputClass} disabled={isPending}>
            <option value="Chris">Chris</option>
            <option value="Jamie">Jamie</option>
            <option value="Joint">Joint</option>
          </select>
          <button
            onClick={handleAddDebt}
            disabled={isPending || !debtName.trim()}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-warn px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            <Plus size={15} />
            Add debt
          </button>
        </div>
      </Card>

      {/* Existing debts */}
      {debts.length > 0 && (
        <Card>
          <p className="mb-3 text-[13px] font-medium text-muted">Existing debts</p>
          <div className="space-y-2">
            {debts.map((debt) => (
              <div key={debt.id} className="flex items-center justify-between p-2 rounded border border-border">
                <div>
                  <p className="text-sm font-medium">{debt.name}</p>
                  <p className="text-xs text-muted">{money(debt.balance)} — {debt.securedBy}</p>
                </div>
                <button
                  onClick={() => onDeleteDebt(debt.id)}
                  disabled={isPending}
                  className="p-1.5 hover:bg-tint rounded disabled:opacity-50"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <p className="mb-4 text-[13px] font-medium text-muted">Add asset</p>
        <div className="space-y-2">
          <input
            type="text"
            placeholder="Asset name"
            value={assetName}
            onChange={(e) => setAssetName(e.target.value)}
            className={inputClass}
            disabled={isPending}
          />
          <input
            type="number"
            placeholder="Value"
            value={assetValue}
            onChange={(e) => setAssetValue(e.target.value)}
            className={inputClass}
            disabled={isPending}
          />
          <select value={assetOwner} onChange={(e) => setAssetOwner(e.target.value as any)} className={inputClass} disabled={isPending}>
            <option value="Chris">Chris</option>
            <option value="Jamie">Jamie</option>
            <option value="Joint">Joint</option>
          </select>
          <button
            onClick={handleAddAsset}
            disabled={isPending || !assetName.trim()}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-good px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            <Plus size={15} />
            Add asset
          </button>
        </div>
      </Card>

      {/* Existing assets */}
      {assets.length > 0 && (
        <Card>
          <p className="mb-3 text-[13px] font-medium text-muted">Existing assets</p>
          <div className="space-y-2">
            {assets.map((asset) => (
              <div key={asset.id} className="flex items-center justify-between p-2 rounded border border-border">
                <div>
                  <p className="text-sm font-medium">{asset.name}</p>
                  <p className="text-xs text-muted">{money(asset.value)} — {asset.owner}</p>
                </div>
                <button
                  onClick={() => onDeleteAsset(asset.id)}
                  disabled={isPending}
                  className="p-1.5 hover:bg-tint rounded disabled:opacity-50"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}

      <button
        onClick={onSave}
        disabled={isPending}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-good px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        Done editing
      </button>
    </div>
  );
}
