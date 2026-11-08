"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Pencil } from "lucide-react";
import { money } from "@/lib/data";
import { saveAssets } from "@/lib/actions";
import { ASSET_ROWS, type AssetKey, type Assets } from "@/lib/assets";

// What Jamie owns. Tap a number to change it; it saves on Enter or when you
// tap away. The IRA comes from Chris's 401k deal and isn't typed here — it's
// marked "Future" and left out of the total until the money actually moves.

export default function AssetsCard({ initial, ira }: { initial: Assets; ira: number | null }) {
  const [values, setValues] = useState<Assets>(initial);
  const [editing, setEditing] = useState<AssetKey | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const total = ASSET_ROWS.reduce((s, r) => s + (values[r.key] ?? 0), 0);

  function start(key: AssetKey) {
    setEditing(key);
    setDraft(values[key] === null ? "" : String(values[key]));
    setError(null);
  }

  function commit() {
    if (!editing) return;
    const n = Number(draft.replace(/[^0-9.]/g, ""));
    const next = { ...values, [editing]: draft.trim() === "" ? null : Number.isFinite(n) ? Math.round(n) : values[editing] };
    const before = values;
    setValues(next);
    setEditing(null);
    startTransition(async () => {
      const res = await saveAssets(next);
      if (!res.ok) {
        setValues(before);
        setError(res.error ?? "Not saved. Try again.");
      }
    });
  }

  // Chris's order: Jewelry, IRA, Real estate, Stocks, Life insurance.
  const [jewelry, ...rest] = ASSET_ROWS;

  return (
    <div className="rounded-3xl border border-border bg-card p-5">
      <div className="text-center">
        <div className="text-[12px] text-muted">You own</div>
        <div className="text-[34px] font-black leading-none tracking-tight tabular-nums" style={{ color: "var(--good)" }}>
          {money(total)}
        </div>
      </div>

      <ul className="mt-4 divide-y divide-border">
        <Row row={jewelry} value={values[jewelry.key]} editing={editing === jewelry.key} draft={draft} setDraft={setDraft} onEdit={start} onDone={commit} />
        <li className="flex items-center gap-3 py-3">
          <span className="text-[20px]" aria-hidden="true">🏦</span>
          <Link href="/retirement" className="min-w-0 flex-1 hover:underline">
            <span className="flex items-center gap-1.5 text-[15px] font-medium">
              IRA
              <span className="rounded-full px-1.5 text-[10px] font-semibold uppercase" style={{ color: "var(--warn)", background: "var(--warn-bg)" }}>
                Future
              </span>
            </span>
            <span className="block truncate text-[12px] text-muted">From Chris&apos;s 401k, not counted yet</span>
          </Link>
          <span className="text-[16px] font-semibold tabular-nums text-muted">{ira === null ? "—" : money(ira)}</span>
        </li>
        {rest.map((r) => (
          <Row key={r.key} row={r} value={values[r.key]} editing={editing === r.key} draft={draft} setDraft={setDraft} onEdit={start} onDone={commit} />
        ))}
      </ul>
      {error && <p className="mt-2 text-[13px] text-neg">{error}</p>}
    </div>
  );
}

function Row({
  row,
  value,
  editing,
  draft,
  setDraft,
  onEdit,
  onDone,
}: {
  row: (typeof ASSET_ROWS)[number];
  value: number | null;
  editing: boolean;
  draft: string;
  setDraft: (v: string) => void;
  onEdit: (key: AssetKey) => void;
  onDone: () => void;
}) {
  return (
    <li className="flex items-center gap-3 py-3">
      <span className="text-[20px]" aria-hidden="true">{row.emoji}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-medium">{row.label}</span>
        <span className="block truncate text-[12px] text-muted">{row.hint}</span>
      </span>
      {editing ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onDone();
          }}
          className="flex items-center rounded-xl border border-border bg-bg px-2"
        >
          <span className="text-muted">$</span>
          <input
            autoFocus
            inputMode="numeric"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={onDone}
            className="w-24 bg-transparent py-1.5 text-right tabular-nums outline-none"
            aria-label={row.label}
          />
        </form>
      ) : (
        <button type="button" onClick={() => onEdit(row.key)} className="flex items-center gap-1.5 text-[16px] font-semibold tabular-nums">
          {value === null ? <span className="text-[13px] font-medium text-muted">Add</span> : money(value)}
          <Pencil size={13} className="text-muted" />
        </button>
      )}
    </li>
  );
}
