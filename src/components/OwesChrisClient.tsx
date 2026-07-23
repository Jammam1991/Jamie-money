"use client";

import { useState, useTransition } from "react";
import { Trash2, Check, Plus } from "lucide-react";
import { Card, Thermometer } from "@/components/ui";
import { money, type OwesCharge } from "@/lib/data";
import { addOwesCharge, deleteOwesCharge, updateOwesCharge } from "@/lib/actions";

const inputClass =
  "w-full rounded-lg border border-border bg-card px-3 py-2 text-[15px] outline-none focus:border-[var(--muted)]";
const primaryBtn =
  "rounded-lg px-3 py-2 text-sm font-medium text-white disabled:opacity-50";

export default function OwesChrisClient({
  initialCharges,
  admin,
}: {
  initialCharges: OwesCharge[];
  admin: boolean;
}) {
  const [charges, setCharges] = useState<OwesCharge[]>(initialCharges);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [, startTransition] = useTransition();

  const [newDescription, setNewDescription] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newDate, setNewDate] = useState(new Date().toISOString().split("T")[0]);

  const total = charges.reduce((sum, c) => sum + (c.paid ? 0 : c.amount), 0);
  const maxThermometer = 3000;

  function run(
    label: string,
    action: () => Promise<{ ok: boolean; error?: string }>
  ) {
    setStatus(null);
    startTransition(async () => {
      const res = await action();
      setStatus(
        res.ok
          ? { ok: true, msg: `${label} saved.` }
          : { ok: false, msg: res.error ?? "Couldn't save." }
      );
    });
  }

  function handleAdd() {
    if (!newDescription || !newAmount) return;
    run("Charge added", async () => {
      const res = await addOwesCharge({
        description: newDescription,
        amount: Number(newAmount),
        date: newDate,
      });
      if (res.ok) {
        const newCharge: OwesCharge = {
          id: res.id ?? String(Math.random()),
          description: newDescription,
          amount: Number(newAmount),
          date: newDate,
          paid: false,
        };
        setCharges([newCharge, ...charges]);
        setNewDescription("");
        setNewAmount("");
        setNewDate(new Date().toISOString().split("T")[0]);
        setAdding(false);
      }
      return res;
    });
  }

  function handleMarkPaid(charge: OwesCharge) {
    run("Charge marked", async () => {
      const res = await updateOwesCharge({
        ...charge,
        paid: !charge.paid,
      });
      if (res.ok) {
        setCharges(
          charges.map((c) =>
            c.id === charge.id ? { ...c, paid: !c.paid } : c
          )
        );
      }
      return res;
    });
  }

  function handleDelete(id: string) {
    run("Charge deleted", async () => {
      const res = await deleteOwesCharge(id);
      if (res.ok) {
        setCharges(charges.filter((c) => c.id !== id));
      }
      return res;
    });
  }

  return (
    <div>
      <Thermometer current={total} max={maxThermometer} />

      <Card className="mb-4">
        <div className="flex items-baseline justify-between">
          <div className="text-sm text-muted">Total Owed</div>
          <div className="text-3xl font-bold">{money(total)}</div>
        </div>
      </Card>

      {status && (
        <div
          className="mb-4 rounded-lg border px-3 py-2 text-sm"
          style={{
            backgroundColor: status.ok ? "rgba(34, 197, 94, 0.1)" : "rgba(239, 68, 68, 0.1)",
            borderColor: status.ok ? "var(--good)" : "var(--bad)",
            color: status.ok ? "var(--good)" : "var(--bad)",
          }}
        >
          {status.msg}
        </div>
      )}

      {admin && !adding && (
        <button
          onClick={() => setAdding(true)}
          className={`${primaryBtn} mb-4 w-full bg-slate-800 hover:bg-slate-700`}
        >
          <Plus size={16} className="mb-0.5 mr-2 inline" /> Add Charge
        </button>
      )}

      {admin && adding && (
        <Card className="mb-4 space-y-3">
          <div>
            <label className="text-xs font-medium text-muted">Description</label>
            <input
              type="text"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="e.g., Gas bill"
              className={inputClass}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted">Amount</label>
            <div className="flex items-center gap-2">
              <span className="text-muted">$</span>
              <input
                type="number"
                value={newAmount}
                onChange={(e) => setNewAmount(e.target.value)}
                placeholder="0.00"
                step="0.01"
                className={`${inputClass} flex-1`}
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted">Date</label>
            <input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className={inputClass}
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button
              onClick={handleAdd}
              className={`${primaryBtn} flex-1 bg-green-600 hover:bg-green-700`}
            >
              Save
            </button>
            <button
              onClick={() => {
                setAdding(false);
                setNewDescription("");
                setNewAmount("");
              }}
              className={`${primaryBtn} flex-1 bg-slate-400 hover:bg-slate-500`}
            >
              Cancel
            </button>
          </div>
        </Card>
      )}

      <div className="space-y-2">
        {charges.length === 0 ? (
          <Card>
            <div className="text-center text-sm text-muted">No charges yet.</div>
          </Card>
        ) : (
          charges.map((charge) => (
            <Card
              key={charge.id}
              className="flex items-center justify-between gap-3"
              style={{
                opacity: charge.paid ? 0.6 : 1,
                textDecoration: charge.paid ? "line-through" : "none",
              }}
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium">{charge.description}</div>
                <div className="text-xs text-muted">
                  {new Date(charge.date).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold">{money(charge.amount)}</div>
              </div>
              {admin && (
                <div className="flex gap-2 ml-2">
                  <button
                    onClick={() => handleMarkPaid(charge)}
                    className="p-2 rounded-lg hover:bg-tint transition-colors"
                    title={charge.paid ? "Mark unpaid" : "Mark paid"}
                  >
                    <Check
                      size={18}
                      style={{
                        color: charge.paid ? "var(--good)" : "var(--muted)",
                      }}
                    />
                  </button>
                  <button
                    onClick={() => handleDelete(charge.id)}
                    className="p-2 rounded-lg hover:bg-tint transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={18} style={{ color: "var(--bad)" }} />
                  </button>
                </div>
              )}
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
