"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Trash2, Check, ChevronRight, Plus } from "lucide-react";
import { Card, Thermometer } from "@/components/ui";
import { money, type CashEntry, type OwesCharge } from "@/lib/data";
import { addOwesCharge, deleteOwesCharge, updateOwesCharge } from "@/lib/actions";
import { computePastDue, EMERGENCY_AT } from "@/lib/pastDue";

const inputClass =
  "w-full rounded-lg border border-border bg-card px-3 py-2 text-[15px] outline-none focus:border-[var(--muted)]";
const primaryBtn =
  "rounded-lg px-3 py-2 text-sm font-medium text-white disabled:opacity-50";

function formatGivenDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export default function OwesChrisClient({
  initialCharges,
  givenEntries,
  admin,
  monthStart,
}: {
  initialCharges: OwesCharge[];
  givenEntries: CashEntry[]; // "Gave cash to Chris" taps from the home screen
  admin: boolean;
  monthStart: string; // "YYYY-MM-01" — anything older that's unpaid is late
}) {
  const [charges, setCharges] = useState<OwesCharge[]>(initialCharges);
  const [adding, setAdding] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [, startTransition] = useTransition();

  const [newDescription, setNewDescription] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newDate, setNewDate] = useState(new Date().toISOString().split("T")[0]);

  // Past due = what Chris covered in months that already ended and still hasn't
  // been paid back. This month's charges aren't late yet.
  const pastDue = computePastDue(charges, givenEntries, monthStart);
  const ahead = pastDue.givenTotal - pastDue.chargesTotal; // > 0 = overpaid
  const lateCharges = pastDue.openCharges.filter((c) => c.late);
  const emergency = pastDue.amount >= EMERGENCY_AT;

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

  // Nothing late? Jamie doesn't need this page at all — the tab is hidden for
  // him too. Chris still gets the full tools so he can log new charges.
  if (pastDue.amount <= 0 && !admin) {
    return (
      <Card className="text-center">
        <div className="text-4xl">🎉</div>
        <div className="mt-2 text-lg font-medium">Nothing past due</div>
        <p className="mt-1 text-sm text-muted">
          {pastDue.thisMonth > 0
            ? `You're all caught up. ${money(pastDue.thisMonth)} from this month isn't late yet.`
            : "You're all caught up with Chris."}
        </p>
      </Card>
    );
  }

  return (
    <div>
      {/* Jamie sees his number and the bar climbing — never the ceiling. */}
      <Thermometer
        current={pastDue.amount}
        max={EMERGENCY_AT}
        title="Past due"
        showScale={admin}
      />

      {emergency && (
        <Card
          className="mb-4 text-center"
          style={{ borderColor: "#dc2626", backgroundColor: "rgba(220, 38, 38, 0.08)" }}
        >
          <div className="text-lg font-bold" style={{ color: "#dc2626" }}>
            🚨 Emergency Mode
          </div>
          <p className="mt-1 text-sm text-muted">
            This has gone too far. Talk to Chris today.
          </p>
        </Card>
      )}

      <Card className="mb-4">
        <div className="flex items-baseline justify-between text-[15px]">
          <span className="text-muted">What Chris covered</span>
          <span>{money(pastDue.chargesTotal)}</span>
        </div>
        <div className="flex items-baseline justify-between text-[15px]">
          <span className="text-muted">Cash you gave him</span>
          <span style={{ color: "var(--good)" }}>−{money(pastDue.givenTotal)}</span>
        </div>
        <div className="mt-2 flex items-baseline justify-between border-t border-border pt-2">
          <span className="text-sm text-muted">Past due</span>
          <span className="text-3xl font-bold">{money(pastDue.amount)}</span>
        </div>
        {pastDue.thisMonth > 0 && (
          <p className="mt-1 text-[13px] text-muted">
            {money(pastDue.thisMonth)} from this month isn&apos;t late yet.
          </p>
        )}
        {ahead > 0 && (
          <p className="mt-1 text-[13px]" style={{ color: "var(--good)" }}>
            🎉 You&apos;re ahead by {money(ahead)}.
          </p>
        )}
      </Card>

      {/* The hand-overs logged on the home screen — proof the balance moved. */}
      {givenEntries.length > 0 && (
        <Card className="mb-4">
          <p className="mb-1 text-[13px] text-muted">🤝 Cash you gave Chris</p>
          {givenEntries.slice(0, 5).map((e) => (
            <div
              key={e.id}
              className="flex items-center justify-between border-t border-border py-2 text-[15px] first:border-t-0"
            >
              <span className="text-muted">{formatGivenDate(e.happenedOn)}</span>
              <span style={{ color: "var(--good)" }}>−{money(e.amount)}</span>
            </div>
          ))}
          <Link
            href="/"
            className="mt-2 flex items-center justify-center gap-1 rounded-lg border border-border py-2 text-sm text-muted"
          >
            See the full log
            <ChevronRight size={15} />
          </Link>
        </Card>
      )}

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

      {/* Chris manages every charge; Jamie only sees the late ones. */}
      <div className="space-y-2">
        {admin ? (
          charges.length === 0 ? (
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
                    {formatGivenDate(charge.date)}
                    {!charge.paid && charge.date < monthStart && " · past due"}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold">{money(charge.amount)}</div>
                </div>
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
              </Card>
            ))
          )
        ) : (
          lateCharges.map((charge) => (
            <Card
              key={charge.id}
              className="flex items-center justify-between gap-3"
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium">{charge.description}</div>
                <div className="text-xs text-muted">
                  {formatGivenDate(charge.date)}
                </div>
              </div>
              <div className="text-right font-bold">
                {money(charge.remaining)}
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
