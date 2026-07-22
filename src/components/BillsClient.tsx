"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { Plus, Trash2, Check, Pencil, Upload, FileText, ChevronDown } from "lucide-react";
import { Card } from "@/components/ui";
import { money, WEEKS_PER_MONTH, type Bill, type BillDocument, type BillPayment } from "@/lib/data";
import {
  addBill,
  addBillPayment,
  deleteBill,
  deleteBillDocument,
  deleteBillPayment,
  getBillDetail,
  setWeeklyIncome,
  updateBill,
  updateBillPayment,
  uploadBillDocument,
} from "@/lib/actions";

const inputClass =
  "w-full rounded-lg border border-border bg-card px-3 py-2 text-[15px] outline-none focus:border-[var(--muted)]";
const primaryBtn =
  "rounded-lg px-3 py-2 text-sm font-medium text-white disabled:opacity-50";

function dueLabel(day: number): string {
  if (!day) return "monthly";
  const suffix =
    day % 10 === 1 && day !== 11
      ? "st"
      : day % 10 === 2 && day !== 12
        ? "nd"
        : day % 10 === 3 && day !== 13
          ? "rd"
          : "th";
  return `due ${day}${suffix}`;
}

export default function BillsClient({
  initialBills,
  initialIncome,
  admin,
}: {
  initialBills: Bill[];
  initialIncome: number;
  admin: boolean;
}) {
  const [bills, setBills] = useState<Bill[]>(initialBills);
  const [income, setIncome] = useState<number>(initialIncome);
  const [incomeDraft, setIncomeDraft] = useState<string>(String(initialIncome));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [, startTransition] = useTransition();
  const tempId = useRef(-1);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [details, setDetails] = useState<
    Record<string, { payments: BillPayment[]; documents: BillDocument[]; loading: boolean }>
  >({});

  function toggleExpand(id: string) {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    if (details[id]) return;
    setDetails((d) => ({ ...d, [id]: { payments: [], documents: [], loading: true } }));
    startTransition(async () => {
      const res = await getBillDetail(id);
      setDetails((d) => ({
        ...d,
        [id]: { payments: res.payments ?? [], documents: res.documents ?? [], loading: false },
      }));
    });
  }

  function refreshDetail(id: string) {
    startTransition(async () => {
      const res = await getBillDetail(id);
      setDetails((d) => ({
        ...d,
        [id]: { payments: res.payments ?? [], documents: res.documents ?? [], loading: false },
      }));
    });
  }

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

  const monthName = useMemo(
    () => new Date().toLocaleDateString("en-US", { month: "long" }),
    []
  );

  const monthlyTotal = bills.reduce((s, b) => s + b.amount, 0);
  const weeklyTarget = monthlyTotal / WEEKS_PER_MONTH;
  const gap = income - weeklyTarget; // + = spare, - = short
  const covered = gap >= 0;

  function saveIncome() {
    const value = Math.max(0, Math.round(Number(incomeDraft) || 0));
    setIncome(value);
    setIncomeDraft(String(value));
    run("Income", () => setWeeklyIncome(value));
  }

  function handleAdd(bill: Omit<Bill, "id">) {
    const tid = String(tempId.current--);
    setBills((b) => [...b, { ...bill, id: tid }]);
    setAdding(false);
    run("Bill", async () => {
      const res = await addBill(bill);
      // Swap the temporary id for the real database id so a later edit/delete
      // doesn't send "-4" to a uuid column. Drop the row if the save failed.
      if (res.ok && res.id) {
        setBills((b) => b.map((x) => (x.id === tid ? { ...x, id: res.id! } : x)));
      } else if (!res.ok) {
        setBills((b) => b.filter((x) => x.id !== tid));
      }
      return res;
    });
  }

  function handleUpdate(bill: Bill) {
    setBills((b) => b.map((x) => (x.id === bill.id ? bill : x)));
    setEditingId(null);
    run("Bill", () => updateBill(bill));
  }

  function handleDelete(id: string) {
    setBills((b) => b.filter((x) => x.id !== id));
    run("Bill", () => deleteBill(id));
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

      {/* Headline: what he needs per week */}
      <div
        className="rounded-2xl p-4"
        style={{
          background: covered ? "var(--good-bg)" : "var(--warn-bg)",
          color: covered ? "var(--good)" : "var(--warn)",
        }}
      >
        <p className="text-[13px]">To cover {monthName}&apos;s bills, you need</p>
        <p className="text-3xl font-medium">
          {money(weeklyTarget)}
          <span className="text-[13px] font-normal">/week</span>
        </p>
        <p className="mt-1 text-[13px]">
          {covered
            ? `You're on track — about ${money(gap)}/week to spare.`
            : `You're about ${money(-gap)}/week short right now.`}
        </p>
      </div>

      {/* Weekly income from massage */}
      <Card>
        <p className="text-[13px] text-muted">Your weekly massage income</p>
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
                value={incomeDraft}
                onChange={(e) => setIncomeDraft(e.target.value)}
              />
            </div>
            <button
              className={primaryBtn}
              style={{ background: "var(--good)" }}
              onClick={saveIncome}
            >
              Save
            </button>
          </div>
        ) : (
          <p className="mt-1 text-2xl font-medium">{money(income)}/week</p>
        )}
        <p className="mt-2 text-xs text-muted">
          About {money(income * WEEKS_PER_MONTH)}/month coming in.
        </p>
      </Card>

      {/* Bills list */}
      <Card>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[13px] text-muted">{monthName} bills</p>
          <p className="text-[13px] font-medium">{money(monthlyTotal)}/mo</p>
        </div>

        <div className="divide-y divide-border">
          {bills.map((b) =>
            editingId === b.id ? (
              <BillForm
                key={b.id}
                initial={b}
                onCancel={() => setEditingId(null)}
                onSave={(data) => handleUpdate({ ...data, id: b.id })}
              />
            ) : (
              <div key={b.id} className="py-2.5">
                <div className="flex items-center justify-between">
                  <button
                    className="flex min-w-0 items-center gap-1.5 text-left"
                    onClick={() => toggleExpand(b.id)}
                  >
                    <ChevronDown
                      size={14}
                      className="shrink-0 text-muted transition-transform"
                      style={{
                        transform: expandedId === b.id ? "rotate(0deg)" : "rotate(-90deg)",
                      }}
                    />
                    <span className="min-w-0">
                      <p className="truncate text-[15px]">{b.name}</p>
                      <p className="text-xs text-muted">{dueLabel(b.dueDay)}</p>
                    </span>
                  </button>
                  <div className="flex items-center gap-3">
                    <span className="text-[15px]">{money(b.amount)}</span>
                    {admin && (
                      <>
                        <button
                          aria-label="Edit"
                          className="text-muted"
                          onClick={() => setEditingId(b.id)}
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          aria-label="Delete"
                          className="text-muted"
                          onClick={() => handleDelete(b.id)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
                {expandedId === b.id && (
                  <BillDetail
                    billId={b.id}
                    admin={admin}
                    loading={details[b.id]?.loading ?? true}
                    payments={details[b.id]?.payments ?? []}
                    documents={details[b.id]?.documents ?? []}
                    onRefresh={() => refreshDetail(b.id)}
                  />
                )}
              </div>
            )
          )}
        </div>

        {admin &&
          (adding ? (
            <div className="pt-2">
              <BillForm onCancel={() => setAdding(false)} onSave={handleAdd} />
            </div>
          ) : (
            <button
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-border py-2 text-sm text-muted"
              onClick={() => setAdding(true)}
            >
              <Plus size={16} />
              Add a bill
            </button>
          ))}
      </Card>
    </div>
  );
}

// Small inline form for adding or editing one bill.
function BillForm({
  initial,
  onCancel,
  onSave,
}: {
  initial?: Bill;
  onCancel: () => void;
  onSave: (data: Omit<Bill, "id">) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [amount, setAmount] = useState(String(initial?.amount ?? ""));
  const [dueDay, setDueDay] = useState(String(initial?.dueDay ?? ""));

  function submit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave({
      name: trimmed,
      amount: Math.max(0, Math.round(Number(amount) || 0)),
      dueDay: Math.min(31, Math.max(0, Math.round(Number(dueDay) || 0))),
    });
  }

  return (
    <div className="space-y-3 py-3">
      <div>
        <label className="mb-1 block text-[13px] text-muted">Bill name</label>
        <input
          className={inputClass}
          placeholder="e.g. Rent"
          value={name}
          onChange={(e) => setName(e.target.value)}
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
        <div className="w-28">
          <label className="mb-1 block text-[13px] text-muted">Due day</label>
          <input
            type="number"
            inputMode="numeric"
            className={inputClass}
            placeholder="1–31"
            value={dueDay}
            onChange={(e) => setDueDay(e.target.value)}
          />
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

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

// Payment history + lease/agreement documents for one bill, shown inline
// under its row when expanded.
function BillDetail({
  billId,
  admin,
  loading,
  payments,
  documents,
  onRefresh,
}: {
  billId: string;
  admin: boolean;
  loading: boolean;
  payments: BillPayment[];
  documents: BillDocument[];
  onRefresh: () => void;
}) {
  const [addingPayment, setAddingPayment] = useState(false);
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function savePayment(data: { amount: number; paidDate: string; note?: string }, id?: string) {
    setAddingPayment(false);
    setEditingPaymentId(null);
    startTransition(async () => {
      if (id) {
        await updateBillPayment({ id, ...data });
      } else {
        await addBillPayment({ billId, ...data });
      }
      onRefresh();
    });
  }

  function removePayment(id: string) {
    startTransition(async () => {
      await deleteBillPayment(id);
      onRefresh();
    });
  }

  function removeDocument(id: string) {
    startTransition(async () => {
      await deleteBillDocument(id);
      onRefresh();
    });
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.type !== "application/pdf") {
      setUploadError("Only PDF files are supported.");
      return;
    }
    setUploading(true);
    setUploadError(null);
    const formData = new FormData();
    formData.set("billId", billId);
    formData.set("file", file);
    const res = await uploadBillDocument(formData);
    setUploading(false);
    if (!res.ok) {
      setUploadError(res.error ?? "Couldn't upload that file.");
      return;
    }
    onRefresh();
  }

  return (
    <div className="mt-2 space-y-4 rounded-xl bg-tint p-3">
      {loading ? (
        <p className="text-xs text-muted">Loading…</p>
      ) : (
        <>
          {/* Payment history */}
          <div>
            <p className="mb-1.5 text-[13px] font-medium">Payment history</p>
            {payments.length === 0 && !addingPayment && (
              <p className="text-xs text-muted">No payments logged yet.</p>
            )}
            <div className="space-y-1">
              {payments.map((p) =>
                editingPaymentId === p.id ? (
                  <PaymentForm
                    key={p.id}
                    initial={p}
                    onCancel={() => setEditingPaymentId(null)}
                    onSave={(data) => savePayment(data, p.id)}
                  />
                ) : (
                  <div key={p.id} className="flex items-center justify-between py-1 text-[13px]">
                    <span className="min-w-0 truncate">
                      {formatDate(p.paidDate)}
                      {p.note ? ` · ${p.note}` : ""}
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      {money(p.amount)}
                      {admin && (
                        <>
                          <button
                            aria-label="Edit payment"
                            className="text-muted"
                            onClick={() => setEditingPaymentId(p.id)}
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            aria-label="Delete payment"
                            className="text-muted"
                            onClick={() => removePayment(p.id)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </span>
                  </div>
                )
              )}
            </div>
            {admin &&
              (addingPayment ? (
                <PaymentForm onCancel={() => setAddingPayment(false)} onSave={(data) => savePayment(data)} />
              ) : (
                <button
                  className="mt-2 flex items-center gap-1.5 text-xs text-muted"
                  onClick={() => setAddingPayment(true)}
                >
                  <Plus size={14} />
                  Log a payment
                </button>
              ))}
          </div>

          {/* Lease / agreement documents */}
          <div>
            <p className="mb-1.5 text-[13px] font-medium">Documents</p>
            {documents.length === 0 && (
              <p className="text-xs text-muted">No documents uploaded yet.</p>
            )}
            <div className="space-y-1">
              {documents.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between py-1 text-[13px]">
                  {doc.url ? (
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex min-w-0 items-center gap-1.5 truncate text-[var(--good)] underline"
                    >
                      <FileText size={14} className="shrink-0" />
                      {doc.fileName}
                    </a>
                  ) : (
                    <span className="flex min-w-0 items-center gap-1.5 truncate text-muted">
                      <FileText size={14} className="shrink-0" />
                      {doc.fileName}
                    </span>
                  )}
                  {admin && (
                    <button
                      aria-label="Delete document"
                      className="shrink-0 text-muted"
                      onClick={() => removeDocument(doc.id)}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {admin && (
              <>
                <label className="mt-2 flex cursor-pointer items-center gap-1.5 text-xs text-muted">
                  <Upload size={14} />
                  {uploading ? "Uploading…" : "Upload a lease/agreement PDF"}
                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    className="hidden"
                    onChange={onFile}
                    disabled={uploading}
                  />
                </label>
                {uploadError && <p className="mt-1 text-xs text-warn">{uploadError}</p>}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// Small inline form for adding or editing one payment entry.
function PaymentForm({
  initial,
  onCancel,
  onSave,
}: {
  initial?: BillPayment;
  onCancel: () => void;
  onSave: (data: { amount: number; paidDate: string; note?: string }) => void;
}) {
  const [amount, setAmount] = useState(String(initial?.amount ?? ""));
  const [paidDate, setPaidDate] = useState(initial?.paidDate ?? todayIso());
  const [note, setNote] = useState(initial?.note ?? "");

  function submit() {
    onSave({
      amount: Math.max(0, Math.round(Number(amount) || 0)),
      paidDate: paidDate || todayIso(),
      note: note.trim() || undefined,
    });
  }

  return (
    <div className="space-y-2 rounded-lg bg-card p-2">
      <div className="flex gap-2">
        <input
          type="date"
          className={inputClass}
          value={paidDate}
          onChange={(e) => setPaidDate(e.target.value)}
        />
        <input
          type="number"
          inputMode="numeric"
          className={inputClass}
          placeholder="Amount ($)"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </div>
      <input
        className={inputClass}
        placeholder="Note (optional)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <div className="flex justify-end gap-2">
        <button className="rounded-lg px-2 py-1 text-xs text-muted" onClick={onCancel}>
          Cancel
        </button>
        <button
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-white"
          style={{ background: "var(--good)" }}
          onClick={submit}
        >
          <Check size={13} />
          Save
        </button>
      </div>
    </div>
  );
}
