"use client";

import { useRef, useState, useTransition } from "react";
import { Plus, Trash2, Check, Pencil } from "lucide-react";
import { Card } from "@/components/ui";
import { advanceTotal, money, type Advance } from "@/lib/data";
import {
  addAdvance,
  deleteAdvance,
  setDefaultLimit,
  updateAdvance,
} from "@/lib/actions";

const inputClass =
  "w-full rounded-lg border border-border bg-card px-3 py-2 text-[15px] outline-none focus:border-[var(--muted)]";
const primaryBtn =
  "rounded-lg px-3 py-2 text-sm font-medium text-white disabled:opacity-50";

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function OwedClient({
  initialAdvances,
  initialLimit,
  admin,
}: {
  initialAdvances: Advance[];
  initialLimit: number;
  admin: boolean;
}) {
  const [advances, setAdvances] = useState<Advance[]>(initialAdvances);
  const [limit, setLimit] = useState<number>(initialLimit);
  const [limitDraft, setLimitDraft] = useState<string>(String(initialLimit));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [, startTransition] = useTransition();
  const tempId = useRef(-1);

  // Run a save action and show whether it worked, so failures aren't silent.
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

  const owed = advanceTotal(advances);
  const ratio = limit > 0 ? owed / limit : owed > 0 ? 1 : 0;
  const state: "good" | "warn" | "danger" =
    owed <= 0 ? "good" : ratio >= 1 ? "danger" : "warn";
  const stateBg =
    state === "good"
      ? "var(--good-bg)"
      : state === "warn"
        ? "var(--warn-bg)"
        : "var(--danger-bg)";
  const stateColor =
    state === "good"
      ? "var(--good)"
      : state === "warn"
        ? "var(--warn)"
        : "var(--danger)";

  function saveLimit() {
    const value = Math.max(0, Math.round(Number(limitDraft) || 0));
    setLimit(value);
    setLimitDraft(String(value));
    run("Limit", () => setDefaultLimit(value));
  }

  function handleAdd(entry: Omit<Advance, "id">) {
    const tid = String(tempId.current--);
    setAdvances((a) => [{ ...entry, id: tid }, ...a]);
    setAdding(false);
    run("Entry", async () => {
      const res = await addAdvance(entry);
      // Swap the temporary id for the real database id so a later edit/delete
      // doesn't send "-4" to a uuid column. Drop the row if the save failed.
      if (res.ok && res.id) {
        setAdvances((a) => a.map((x) => (x.id === tid ? { ...x, id: res.id! } : x)));
      } else if (!res.ok) {
        setAdvances((a) => a.filter((x) => x.id !== tid));
      }
      return res;
    });
  }

  function handleUpdate(entry: Advance) {
    setAdvances((a) => a.map((x) => (x.id === entry.id ? entry : x)));
    setEditingId(null);
    run("Entry", () => updateAdvance(entry));
  }

  function handleDelete(id: string) {
    setAdvances((a) => a.filter((x) => x.id !== id));
    run("Entry", () => deleteAdvance(id));
  }

  return (
    <div className="space-y-4">
      {status && (
        <div
          className="rounded-xl px-3 py-2 text-[13px]"
          style={{
            background: status.ok ? "var(--good-bg)" : "var(--warn-bg)",
            color: status.ok ? "var(--good)" : "var(--warn)",
          }}
        >
          {status.ok ? "✓ " : "⚠ "}
          {status.msg}
        </div>
      )}

      {/* Headline: what Jamie currently owes, colored by how close to the limit */}
      <div
        className="rounded-2xl p-4"
        style={{ background: stateBg, color: stateColor }}
      >
        <p className="text-[13px]">Jamie currently owes you</p>
        <p className="text-3xl font-medium">{money(Math.max(0, owed))}</p>
        <p className="mt-1 text-[13px]">
          {state === "good" &&
            "He's all paid up — nothing owed right now."}
          {state === "warn" &&
            `Your limit is ${money(limit)} — ${money(Math.max(0, limit - owed))} of room left.`}
          {state === "danger" &&
            "You've hit your limit. Time to stop covering him until he pays you back."}
        </p>
      </div>

      {/* The limit setting */}
      <Card>
        <p className="text-[13px] text-muted">
          Your limit — the most you&apos;ll lend before you have to stop covering him
        </p>
        {admin ? (
          <div className="mt-2 flex items-center gap-2">
            <div className="relative flex-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
                $
              </span>
              <input
                type="number"
                inputMode="numeric"
                className={inputClass + " pl-7"}
                value={limitDraft}
                onChange={(e) => setLimitDraft(e.target.value)}
              />
            </div>
            <button
              className={primaryBtn}
              style={{ background: "var(--good)" }}
              onClick={saveLimit}
            >
              Save
            </button>
          </div>
        ) : (
          <p className="mt-1 text-2xl font-medium">{money(limit)}</p>
        )}
      </Card>

      {/* Ledger */}
      <Card>
        <p className="mb-2 text-[13px] text-muted">History</p>

        <div className="divide-y divide-border">
          {advances.length === 0 && (
            <p className="py-3 text-[13px] text-muted">Nothing logged yet.</p>
          )}
          {advances.map((a) =>
            editingId === a.id ? (
              <AdvanceForm
                key={a.id}
                initial={a}
                onCancel={() => setEditingId(null)}
                onSave={(data) => handleUpdate({ ...data, id: a.id })}
              />
            ) : (
              <div
                key={a.id}
                className="flex items-center justify-between py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-[15px]">{a.note}</p>
                  <p className="text-xs text-muted">
                    {formatDate(a.date)} ·{" "}
                    {a.kind === "repaid" ? "he paid you back" : "you covered it"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className="text-[15px]"
                    style={{
                      color: a.kind === "repaid" ? "var(--good)" : "var(--warn)",
                    }}
                  >
                    {a.kind === "repaid" ? "-" : "+"}
                    {money(a.amount)}
                  </span>
                  {admin && (
                    <>
                      <button
                        aria-label="Edit"
                        className="text-muted"
                        onClick={() => setEditingId(a.id)}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        aria-label="Delete"
                        className="text-muted"
                        onClick={() => handleDelete(a.id)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          )}
        </div>

        {admin &&
          (adding ? (
            <div className="pt-2">
              <AdvanceForm onCancel={() => setAdding(false)} onSave={handleAdd} />
            </div>
          ) : (
            <button
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-border py-2 text-sm text-muted"
              onClick={() => setAdding(true)}
            >
              <Plus size={16} />
              Log an entry
            </button>
          ))}
      </Card>
    </div>
  );
}

// Small inline form for adding or editing one ledger entry.
function AdvanceForm({
  initial,
  onCancel,
  onSave,
}: {
  initial?: Advance;
  onCancel: () => void;
  onSave: (data: Omit<Advance, "id">) => void;
}) {
  const [note, setNote] = useState(initial?.note ?? "");
  const [amount, setAmount] = useState(String(initial?.amount ?? ""));
  const [date, setDate] = useState(initial?.date || todayISO());
  const [kind, setKind] = useState<"covered" | "repaid">(initial?.kind ?? "covered");

  function submit() {
    const trimmed = note.trim();
    if (!trimmed) return;
    onSave({
      note: trimmed,
      amount: Math.max(0, Math.round(Number(amount) || 0)),
      date,
      kind,
    });
  }

  return (
    <div className="space-y-3 py-3">
      <div>
        <label className="mb-1 block text-[13px] text-muted">What was it for</label>
        <input
          className={inputClass}
          placeholder="e.g. Rent — he didn't have it"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="mb-1 block text-[13px] text-muted">Amount ($)</label>
          <input
            type="number"
            inputMode="numeric"
            className={inputClass}
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <div className="w-36">
          <label className="mb-1 block text-[13px] text-muted">Date</label>
          <input
            type="date"
            className={inputClass}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-[13px] text-muted">Type</label>
        <div className="flex gap-2">
          <button
            type="button"
            className="flex-1 rounded-lg border py-2 text-sm"
            style={{
              borderColor: kind === "covered" ? "var(--warn)" : "var(--border)",
              background: kind === "covered" ? "var(--warn-bg)" : "transparent",
              color: kind === "covered" ? "var(--warn)" : "var(--text)",
            }}
            onClick={() => setKind("covered")}
          >
            You covered it
          </button>
          <button
            type="button"
            className="flex-1 rounded-lg border py-2 text-sm"
            style={{
              borderColor: kind === "repaid" ? "var(--good)" : "var(--border)",
              background: kind === "repaid" ? "var(--good-bg)" : "transparent",
              color: kind === "repaid" ? "var(--good)" : "var(--text)",
            }}
            onClick={() => setKind("repaid")}
          >
            He paid you back
          </button>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button className="rounded-lg px-3 py-2 text-sm text-muted" onClick={onCancel}>
          Cancel
        </button>
        <button
          className={primaryBtn + " flex items-center gap-1.5"}
          style={{ background: "var(--good)" }}
          onClick={submit}
        >
          <Check size={16} />
          Save
        </button>
      </div>
    </div>
  );
}
