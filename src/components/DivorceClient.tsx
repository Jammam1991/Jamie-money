"use client";

import { useState, useTransition } from "react";
import { Check, CalendarDays, Folder, Pencil, Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/ui";
import { money, type Divorce } from "@/lib/data";
import { updateDivorce } from "@/lib/actions";

const inputClass =
  "w-full rounded-lg border border-border bg-card px-3 py-2 text-[15px] outline-none focus:border-[var(--muted)]";
const smallInput =
  "w-full rounded-lg border border-border bg-card px-2 py-1.5 text-[15px] outline-none";

export default function DivorceClient({
  initial,
  admin,
}: {
  initial: Divorce;
  admin: boolean;
}) {
  const [data, setData] = useState<Divorce>(initial);
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <DivorceForm
        initial={data}
        onCancel={() => setEditing(false)}
        onSaved={(next) => {
          setData(next);
          setEditing(false);
        }}
      />
    );
  }

  return (
    <div className="space-y-3">
      {admin && (
        <button
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-border py-2 text-sm text-muted"
          onClick={() => setEditing(true)}
        >
          <Pencil size={15} />
          Edit divorce details
        </button>
      )}

      <Card>
        <p className="text-[13px] text-muted">Support you pay</p>
        <p className="text-2xl font-medium">
          {money(data.support.amount)}
          <span className="text-[13px] font-normal text-muted">/mo</span>
        </p>
        {data.support.paidThisMonth ? (
          <p className="mt-1 flex items-center gap-1 text-[13px] text-good">
            <Check size={15} />
            Paid this month · next {data.support.nextDate}
          </p>
        ) : (
          <p className="mt-1 text-[13px] text-muted">
            Next: {data.support.nextDate}
          </p>
        )}
      </Card>

      <Card>
        <p className="text-[13px] text-muted">Lawyer costs so far</p>
        <p className="text-xl font-medium">{money(data.lawyerCostsSoFar)}</p>
      </Card>

      <Card>
        <p className="mb-1.5 text-[13px] text-muted">What&apos;s being split</p>
        {data.split.map((s, i) => (
          <div key={i} className="flex justify-between py-1 text-[15px]">
            <span>{s.item}</span>
            <span className="text-muted">{s.note}</span>
          </div>
        ))}
      </Card>

      <Card>
        <p className="mb-1.5 text-[13px] text-muted">Key dates</p>
        {data.keyDates.map((d, i) => (
          <div key={i} className="flex justify-between py-1 text-[15px]">
            <span className="flex items-center gap-2">
              <CalendarDays size={16} className="text-muted" />
              {d.label}
            </span>
            <span>{d.date}</span>
          </div>
        ))}
      </Card>

      <Card>
        <p
          className="flex items-center gap-2 text-[15px]"
          style={{ color: "var(--good)" }}
        >
          <Folder size={17} />
          Documents ({data.documentsCount})
        </p>
      </Card>
    </div>
  );
}

function DivorceForm({
  initial,
  onCancel,
  onSaved,
}: {
  initial: Divorce;
  onCancel: () => void;
  onSaved: (next: Divorce) => void;
}) {
  const [amount, setAmount] = useState(String(initial.support.amount));
  const [nextDate, setNextDate] = useState(initial.support.nextDate);
  const [paid, setPaid] = useState(initial.support.paidThisMonth);
  const [lawyer, setLawyer] = useState(String(initial.lawyerCostsSoFar));
  const [docs, setDocs] = useState(String(initial.documentsCount));
  const [split, setSplit] = useState(initial.split);
  const [keyDates, setKeyDates] = useState(initial.keyDates);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    const next: Divorce = {
      support: {
        amount: Math.max(0, Math.round(Number(amount) || 0)),
        nextDate: nextDate.trim(),
        paidThisMonth: paid,
      },
      lawyerCostsSoFar: Math.max(0, Math.round(Number(lawyer) || 0)),
      documentsCount: Math.max(0, Math.round(Number(docs) || 0)),
      split: split.filter((s) => s.item.trim()),
      keyDates: keyDates.filter((d) => d.label.trim()),
    };
    setError(null);
    startTransition(async () => {
      const res = await updateDivorce({
        supportAmount: next.support.amount,
        supportNextDate: next.support.nextDate,
        supportPaidThisMonth: next.support.paidThisMonth,
        lawyerCosts: next.lawyerCostsSoFar,
        documentsCount: next.documentsCount,
        split: next.split,
        keyDates: next.keyDates,
      });
      if (res.ok) onSaved(next);
      else setError(res.error ?? "Couldn't save.");
    });
  }

  return (
    <div className="space-y-3">
      <Card>
        <label className="text-[13px] text-muted">Support you pay ($/mo)</label>
        <input
          type="number"
          inputMode="numeric"
          className={inputClass + " mt-1"}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <label className="mt-3 block text-[13px] text-muted">
          Next payment date
        </label>
        <input
          className={inputClass + " mt-1"}
          placeholder="e.g. Aug 1"
          value={nextDate}
          onChange={(e) => setNextDate(e.target.value)}
        />
        <label className="mt-3 flex items-center gap-2 text-[15px]">
          <input
            type="checkbox"
            checked={paid}
            onChange={(e) => setPaid(e.target.checked)}
            className="h-4 w-4 accent-[var(--good)]"
          />
          Paid this month
        </label>
      </Card>

      <Card>
        <label className="text-[13px] text-muted">Lawyer costs so far ($)</label>
        <input
          type="number"
          inputMode="numeric"
          className={inputClass + " mt-1"}
          value={lawyer}
          onChange={(e) => setLawyer(e.target.value)}
        />
        <label className="mt-3 block text-[13px] text-muted">
          Number of documents
        </label>
        <input
          type="number"
          inputMode="numeric"
          className={inputClass + " mt-1"}
          value={docs}
          onChange={(e) => setDocs(e.target.value)}
        />
      </Card>

      <ListEditor
        title="What's being split"
        rows={split}
        cols={["item", "note"]}
        placeholders={["Item (e.g. House)", "Note (e.g. 50 / 50)"]}
        onChange={setSplit}
      />

      <ListEditor
        title="Key dates"
        rows={keyDates}
        cols={["label", "date"]}
        placeholders={["Label (e.g. Court date)", "Date (e.g. Sep 12)"]}
        onChange={setKeyDates}
      />

      {error && <p className="text-[13px] text-warn">{error}</p>}

      <div className="flex justify-end gap-2">
        <button
          className="rounded-lg px-3 py-2 text-sm text-muted"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          style={{ background: "var(--good)" }}
          onClick={save}
          disabled={pending}
        >
          <Check size={16} />
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

// A small editor for a list of two-field rows (used for split and key dates).
function ListEditor<T extends Record<string, string>>({
  title,
  rows,
  cols,
  placeholders,
  onChange,
}: {
  title: string;
  rows: T[];
  cols: [string, string];
  placeholders: [string, string];
  onChange: (rows: T[]) => void;
}) {
  function update(i: number, key: string, value: string) {
    onChange(rows.map((r, idx) => (idx === i ? { ...r, [key]: value } : r)));
  }
  function remove(i: number) {
    onChange(rows.filter((_, idx) => idx !== i));
  }
  function add() {
    onChange([...rows, { [cols[0]]: "", [cols[1]]: "" } as T]);
  }

  return (
    <Card>
      <p className="mb-2 text-[13px] text-muted">{title}</p>
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              className={smallInput}
              placeholder={placeholders[0]}
              value={r[cols[0]]}
              onChange={(e) => update(i, cols[0], e.target.value)}
            />
            <input
              className={smallInput}
              placeholder={placeholders[1]}
              value={r[cols[1]]}
              onChange={(e) => update(i, cols[1], e.target.value)}
            />
            <button
              aria-label="Remove"
              className="text-muted"
              onClick={() => remove(i)}
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
      <button
        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-border py-2 text-sm text-muted"
        onClick={add}
      >
        <Plus size={16} />
        Add row
      </button>
    </Card>
  );
}
