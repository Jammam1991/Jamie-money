"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { Plus, Trash2, Check, Pencil, Upload, FileText } from "lucide-react";
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
  unmarkBillPaid,
  updateBill,
  updateBillPayment,
  uploadBillDocument,
} from "@/lib/actions";

const inputClass =
  "w-full rounded-lg border border-border bg-card px-3 py-2 text-[15px] outline-none focus:border-[var(--muted)]";
const dateInputClass =
  "rounded-lg border border-border bg-card px-3 py-2 text-[15px] outline-none focus:border-[var(--muted)]";
const primaryBtn =
  "rounded-lg px-3 py-2 text-sm font-medium text-white disabled:opacity-50";

// The two big buckets on this page. FICO bills are the credit cards — paying
// those on time is what moves Jamie's credit score.
type Group = "fico" | "regular";

const GROUPS: Record<
  Group,
  { emoji: string; title: string; blurb: string; color: string; bg: string; line: string }
> = {
  fico: {
    emoji: "💳",
    title: "FICO Bills",
    blurb: "Credit cards — paying these on time grows your credit score.",
    color: "var(--fico)",
    bg: "var(--fico-bg)",
    line: "var(--fico-line)",
  },
  regular: {
    emoji: "🏠",
    title: "Regular Bills",
    blurb: "Everything else you pay every month.",
    color: "var(--reg)",
    bg: "var(--reg-bg)",
    line: "var(--reg-line)",
  },
};

// A friendly picture for each bill so the list can be read at a glance.
function billEmoji(name: string, fico: boolean): string {
  const n = name.toLowerCase();
  if (/rent|apartment|house|home|mortgage/.test(n)) return "🏠";
  if (/insur/.test(n)) return "🛡️";
  if (/car|auto|truck|vehicle/.test(n)) return "🚗";
  if (/phone|cell|mobile/.test(n)) return "📱";
  if (/internet|wifi|cable/.test(n)) return "📶";
  if (/util|electric|power|water|gas/.test(n)) return "💡";
  if (/grocer|food/.test(n)) return "🛒";
  if (/subscri|netflix|spotify|stream/.test(n)) return "📺";
  if (/gym|fitness/.test(n)) return "🏋️";
  if (/student|school|tuition/.test(n)) return "🎓";
  if (fico) return "💳";
  return "🧾";
}

function dueLabel(day: number): string {
  if (!day) return "any time this month";
  const suffix =
    day % 10 === 1 && day !== 11
      ? "st"
      : day % 10 === 2 && day !== 12
        ? "nd"
        : day % 10 === 3 && day !== 13
          ? "rd"
          : "th";
  return `due the ${day}${suffix}`;
}

export default function BillsClient({
  initialBills,
  initialIncome,
  initialPaidIds,
  initialRolloverIds,
  admin,
}: {
  initialBills: Bill[];
  initialIncome: number;
  initialPaidIds: string[];
  initialRolloverIds: string[];
  admin: boolean;
}) {
  const [bills, setBills] = useState<Bill[]>(initialBills);
  const [paidIds, setPaidIds] = useState<Set<string>>(new Set(initialPaidIds));
  const [rolloverIds, setRolloverIds] = useState<Set<string>>(
    new Set(initialRolloverIds)
  );
  const [income, setIncome] = useState<number>(initialIncome);
  const [incomeDraft, setIncomeDraft] = useState<string>(String(initialIncome));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addingIn, setAddingIn] = useState<Group | null>(null);
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
  const prevMonthName = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() - 1, 1).toLocaleDateString(
      "en-US",
      { month: "long" }
    );
  }, []);

  const monthlyTotal = bills.reduce((s, b) => s + b.amount, 0);
  const paidTotal = bills.reduce(
    (s, b) => s + (paidIds.has(b.id) ? b.amount : 0),
    0
  );
  // Anything not paid last month rolls over and is still owed on top of
  // this month's bills.
  const rolloverBills = bills.filter((b) => rolloverIds.has(b.id));
  const rolloverTotal = rolloverBills.reduce((s, b) => s + b.amount, 0);
  const owedTotal = monthlyTotal + rolloverTotal;
  const leftToPay = monthlyTotal - paidTotal + rolloverTotal;
  const allPaid = leftToPay <= 0;

  // Calculate weeks remaining in current month
  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const daysRemaining = lastDay.getDate() - now.getDate() + 1;
  const weeksRemaining = Math.ceil(daysRemaining / 7);

  // Weekly target with rollover: divide what's owed by weeks remaining
  const weeklyTarget = weeksRemaining > 0 ? leftToPay / weeksRemaining : leftToPay;
  const donePct = owedTotal > 0 ? Math.round((paidTotal / owedTotal) * 100) : 100;

  const ficoBills = bills.filter((b) => b.fico);
  const regularBills = bills.filter((b) => !b.fico);

  function saveIncome() {
    const value = Math.max(0, Math.round(Number(incomeDraft) || 0));
    setIncome(value);
    setIncomeDraft(String(value));
    run("Income", () => setWeeklyIncome(value));
  }

  function handleAdd(bill: Omit<Bill, "id">) {
    const tid = String(tempId.current--);
    setBills((b) => [...b, { ...bill, id: tid }]);
    setAddingIn(null);
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

  // Tap "Not yet" to pick a date, then confirm to log a real payment row for
  // that date. Unmarking removes this month's newest payment. Open to Jamie
  // and Chris alike — either of them might be the one who actually paid it.
  function handleMarkPaid(bill: Bill, paidDate: string) {
    setPaidIds((p) => new Set(p).add(bill.id));
    run("Bill", async () => {
      const res = await addBillPayment({
        billId: bill.id,
        amount: bill.amount,
        paidDate: paidDate || todayIso(),
      });
      if (!res.ok) {
        setPaidIds((p) => {
          const next = new Set(p);
          next.delete(bill.id);
          return next;
        });
      } else if (details[bill.id]) {
        refreshDetail(bill.id);
      }
      return res;
    });
  }

  // Settle a bill left over from last month: the payment is dated the last
  // day of that month (so it counts for the month it covers), and the note
  // records the actual date it was paid, picked from the date field.
  function handleMarkRolloverPaid(bill: Bill, actualPaidDate: string) {
    setRolloverIds((r) => {
      const next = new Set(r);
      next.delete(bill.id);
      return next;
    });
    run("Bill", async () => {
      const now = new Date();
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      const endIso = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(
        end.getDate()
      ).padStart(2, "0")}`;
      const paidOn = actualPaidDate || todayIso();
      const res = await addBillPayment({
        billId: bill.id,
        amount: bill.amount,
        paidDate: endIso,
        note: `Paid late (${shortDate(paidOn)})`,
      });
      if (!res.ok) {
        setRolloverIds((r) => new Set(r).add(bill.id));
      } else if (details[bill.id]) {
        refreshDetail(bill.id);
      }
      return res;
    });
  }

  function handleUnmarkPaid(bill: Bill) {
    setPaidIds((p) => {
      const next = new Set(p);
      next.delete(bill.id);
      return next;
    });
    run("Bill", async () => {
      const res = await unmarkBillPaid(bill.id);
      if (!res.ok) {
        setPaidIds((p) => new Set(p).add(bill.id));
      } else if (details[bill.id]) {
        refreshDetail(bill.id);
      }
      return res;
    });
  }

  function renderGroup(group: Group, groupBills: Bill[]) {
    const cfg = GROUPS[group];
    const total = groupBills.reduce((s, b) => s + b.amount, 0);
    const paidCount = groupBills.filter((b) => paidIds.has(b.id)).length;
    const pct = groupBills.length
      ? Math.round((paidCount / groupBills.length) * 100)
      : 0;

    // A group with no bills is only worth showing to Chris, who can fill it.
    if (groupBills.length === 0 && !admin) return null;

    return (
      <section
        className="overflow-hidden rounded-2xl border"
        style={{ background: cfg.bg, borderColor: cfg.line }}
      >
        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2
                className="flex items-center gap-2 text-[19px] font-bold"
                style={{ color: cfg.color }}
              >
                <span aria-hidden>{cfg.emoji}</span>
                {cfg.title}
              </h2>
              <p className="mt-0.5 text-[13px] text-muted">{cfg.blurb}</p>
            </div>
            <p
              className="shrink-0 text-right text-[17px] font-bold"
              style={{ color: cfg.color }}
            >
              {money(total)}
              <span className="block text-[11px] font-medium text-muted">
                a month
              </span>
            </p>
          </div>

          {groupBills.length > 0 && (
            <>
              <div
                className="mt-3 h-2.5 w-full overflow-hidden rounded-full"
                style={{ background: cfg.line }}
              >
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${pct}%`, background: cfg.color }}
                />
              </div>
              <p className="mt-1.5 text-[13px] font-medium" style={{ color: cfg.color }}>
                {paidCount} of {groupBills.length} paid this month
              </p>
            </>
          )}
        </div>

        <div className="space-y-2 px-2 pb-2">
          {groupBills.map((b) =>
            editingId === b.id ? (
              <div key={b.id} className="rounded-xl bg-card p-3">
                <BillForm
                  initial={b}
                  onCancel={() => setEditingId(null)}
                  onSave={(data) => handleUpdate({ ...data, id: b.id })}
                />
              </div>
            ) : (
              <BillRow
                key={b.id}
                bill={b}
                color={cfg.color}
                paid={paidIds.has(b.id)}
                expanded={expandedId === b.id}
                admin={admin}
                onOpen={() => toggleExpand(b.id)}
                onMarkPaid={(date) => handleMarkPaid(b, date)}
                onUnmarkPaid={() => handleUnmarkPaid(b)}
                onEdit={() => setEditingId(b.id)}
                onDelete={() => handleDelete(b.id)}
                detail={
                  <BillDetail
                    billId={b.id}
                    admin={admin}
                    loading={details[b.id]?.loading ?? true}
                    payments={details[b.id]?.payments ?? []}
                    documents={details[b.id]?.documents ?? []}
                    onRefresh={() => refreshDetail(b.id)}
                  />
                }
              />
            )
          )}

          {admin &&
            (addingIn === group ? (
              <div className="rounded-xl bg-card p-3">
                <BillForm
                  defaultFico={group === "fico"}
                  onCancel={() => setAddingIn(null)}
                  onSave={handleAdd}
                />
              </div>
            ) : (
              <button
                className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed py-2.5 text-sm font-medium"
                style={{ borderColor: cfg.color, color: cfg.color }}
                onClick={() => setAddingIn(group)}
              >
                <Plus size={16} />
                Add a {group === "fico" ? "credit card" : "bill"}
              </button>
            ))}
        </div>
      </section>
    );
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

      {/* Headline: what's still left to pay this week */}
      <div
        className="rounded-2xl p-5 text-center text-white"
        style={{
          background: allPaid
            ? "linear-gradient(135deg, #1a8f68, #0f6f7a)"
            : "linear-gradient(135deg, #f0821e, #d2432f)",
        }}
      >
        {allPaid ? (
          <>
            <p className="text-[15px] font-semibold">🎉 All {monthName} bills are paid!</p>
            <p className="mt-1 text-5xl font-bold">{money(0)}</p>
            <p className="mt-1 text-[13px] opacity-90">Nothing left to pay this month.</p>
          </>
        ) : (
          <>
            <p className="text-[15px] font-semibold">This week's target</p>
            <p className="mt-1 text-5xl font-bold">{money(Math.round(weeklyTarget))}</p>
            <div className="mx-auto mt-3 h-2.5 max-w-xs overflow-hidden rounded-full bg-white/30">
              <div
                className="h-full rounded-full bg-white transition-all"
                style={{ width: `${donePct}%` }}
              />
            </div>
            <p className="mt-2 text-[13px] opacity-90">
              {money(leftToPay)} total for {monthName}
              {rolloverTotal > 0 &&
                ` (includes ${money(rolloverTotal)} from ${prevMonthName})`}
            </p>
          </>
        )}
      </div>

      {/* Bills that didn't get paid last month — they roll over and stay
          owed until they're settled. */}
      {rolloverBills.length > 0 && (
        <section
          className="rounded-2xl border p-4"
          style={{ background: "var(--warn-bg)", borderColor: "#eddcb6" }}
        >
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[15px] font-bold text-warn">
              ⏰ Left over from {prevMonthName}
            </p>
            <p className="text-[15px] font-bold text-warn">{money(rolloverTotal)}</p>
          </div>
          <div className="space-y-2">
            {rolloverBills.map((b) => (
              <RolloverRow
                key={b.id}
                bill={b}
                prevMonthName={prevMonthName}
                onMarkPaid={(date) => handleMarkRolloverPaid(b, date)}
              />
            ))}
          </div>
        </section>
      )}

      {/* The two big buckets: credit cards first, then everything else. */}
      {renderGroup("fico", ficoBills)}
      {renderGroup("regular", regularBills)}

      {/* Weekly income from massage — Chris-only detail, hidden from Jamie
          so the page stays about one thing: are the bills paid? */}
      {admin && (
        <Card>
          <p className="text-[13px] text-muted">Jamie&apos;s weekly massage income</p>
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
          <p className="mt-2 text-xs text-muted">
            About {money(income * WEEKS_PER_MONTH)}/month coming in — bills need
            about {money(weeklyTarget)}/week.
          </p>
        </Card>
      )}
    </div>
  );
}

// One bill: a tappable card that opens its history underneath. Jamie can mark
// bills paid and pick the date just like Chris; the edit/delete buttons stay
// Chris-only.
function BillRow({
  bill,
  color,
  paid,
  expanded,
  admin,
  onOpen,
  onMarkPaid,
  onUnmarkPaid,
  onEdit,
  onDelete,
  detail,
}: {
  bill: Bill;
  color: string;
  paid: boolean;
  expanded: boolean;
  admin: boolean;
  onOpen: () => void;
  onMarkPaid: (date: string) => void;
  onUnmarkPaid: () => void;
  onEdit: () => void;
  onDelete: () => void;
  detail: React.ReactNode;
}) {
  const [picking, setPicking] = useState(false);
  return (
    <div className="rounded-xl bg-card">
      <div className="flex items-center justify-between gap-2 p-3">
        <button
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
          onClick={onOpen}
          aria-expanded={expanded}
        >
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl"
            style={{ background: "var(--tint)" }}
            aria-hidden
          >
            {billEmoji(bill.name, bill.fico)}
          </span>
          <span className="min-w-0">
            <p className="truncate text-[17px] font-semibold" style={{ color }}>
              {bill.name}
            </p>
            <p className="text-[13px] text-muted">
              {money(bill.amount)} · {dueLabel(bill.dueDay)}
            </p>
          </span>
        </button>
        <div className="flex shrink-0 items-center gap-2">
          <PaidPill
            paid={paid}
            onMarkClick={() => setPicking(true)}
            onUnmark={onUnmarkPaid}
          />
          {admin && (
            <>
              <button aria-label="Edit" className="text-muted" onClick={onEdit}>
                <Pencil size={16} />
              </button>
              <button aria-label="Delete" className="text-muted" onClick={onDelete}>
                <Trash2 size={16} />
              </button>
            </>
          )}
        </div>
      </div>
      {picking && (
        <div className="px-3 pb-3">
          <MarkPaidPanel
            color={color}
            onConfirm={(date) => {
              setPicking(false);
              onMarkPaid(date);
            }}
            onCancel={() => setPicking(false)}
          />
        </div>
      )}
      {expanded && <div className="px-3 pb-3">{detail}</div>}
    </div>
  );
}

// One "left over from last month" bill. Same mark-paid-with-a-date flow as a
// regular bill; it disappears from this list once it's settled.
function RolloverRow({
  bill,
  prevMonthName,
  onMarkPaid,
}: {
  bill: Bill;
  prevMonthName: string;
  onMarkPaid: (date: string) => void;
}) {
  const [picking, setPicking] = useState(false);
  return (
    <div className="rounded-xl bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2.5">
          <span className="text-xl" aria-hidden>
            {billEmoji(bill.name, bill.fico)}
          </span>
          <span className="min-w-0">
            <p className="truncate text-[16px] font-semibold">{bill.name}</p>
            <p className="text-xs text-muted">
              {money(bill.amount)} · from {prevMonthName}
            </p>
          </span>
        </span>
        <PaidPill paid={false} onMarkClick={() => setPicking(true)} onUnmark={() => {}} />
      </div>
      {picking && (
        <div className="mt-2">
          <MarkPaidPanel
            color="var(--warn)"
            onConfirm={(date) => {
              setPicking(false);
              onMarkPaid(date);
            }}
            onCancel={() => setPicking(false)}
          />
        </div>
      )}
    </div>
  );
}

// The "Paid" / "Not yet" badge on each bill. Anyone can tap it — marking paid
// opens a date picker below; tapping an already-paid bill unmarks it.
function PaidPill({
  paid,
  onMarkClick,
  onUnmark,
}: {
  paid: boolean;
  onMarkClick: () => void;
  onUnmark: () => void;
}) {
  const style = paid
    ? { background: "var(--good-bg)", color: "var(--good)" }
    : { background: "var(--warn-bg)", color: "var(--warn)" };
  const label = paid ? "✓ Paid" : "Not yet";
  return (
    <button
      className="rounded-full px-3 py-1.5 text-[13px] font-bold active:scale-95"
      style={style}
      onClick={paid ? onUnmark : onMarkClick}
      title={paid ? "Unmark paid" : "Mark paid"}
    >
      {label}
    </button>
  );
}

// The date picker that drops down when marking a bill paid, so whoever's
// paying it can say which day the money actually went out.
function MarkPaidPanel({
  color,
  onConfirm,
  onCancel,
}: {
  color: string;
  onConfirm: (date: string) => void;
  onCancel: () => void;
}) {
  const [date, setDate] = useState(todayIso());
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg bg-tint p-2">
      <span className="text-[13px] text-muted">Paid on</span>
      <input
        type="date"
        className={dateInputClass + " flex-1 min-w-[140px]"}
        value={date}
        onChange={(e) => setDate(e.target.value)}
      />
      <button className="rounded-lg px-2 py-1.5 text-xs text-muted" onClick={onCancel}>
        Cancel
      </button>
      <button
        className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold text-white"
        style={{ background: color }}
        onClick={() => onConfirm(date || todayIso())}
      >
        <Check size={13} />
        Mark paid
      </button>
    </div>
  );
}

// Small inline form for adding or editing one bill.
function BillForm({
  initial,
  defaultFico,
  onCancel,
  onSave,
}: {
  initial?: Bill;
  defaultFico?: boolean;
  onCancel: () => void;
  onSave: (data: Omit<Bill, "id">) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [amount, setAmount] = useState(String(initial?.amount ?? ""));
  const [dueDay, setDueDay] = useState(String(initial?.dueDay ?? ""));
  const [fico, setFico] = useState(initial?.fico ?? defaultFico ?? false);

  function submit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave({
      name: trimmed,
      amount: Math.max(0, Math.round(Number(amount) || 0)),
      dueDay: Math.min(31, Math.max(0, Math.round(Number(dueDay) || 0))),
      fico,
    });
  }

  return (
    <div className="space-y-3 py-1">
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
      <div>
        <label className="mb-1 block text-[13px] text-muted">Which list?</label>
        <div className="flex gap-2">
          <GroupChoice
            active={fico}
            group="fico"
            onClick={() => setFico(true)}
          />
          <GroupChoice
            active={!fico}
            group="regular"
            onClick={() => setFico(false)}
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

function GroupChoice({
  active,
  group,
  onClick,
}: {
  active: boolean;
  group: Group;
  onClick: () => void;
}) {
  const cfg = GROUPS[group];
  return (
    <button
      className="flex-1 rounded-lg border px-3 py-2 text-[13px] font-semibold"
      style={{
        borderColor: active ? cfg.color : "var(--border)",
        background: active ? cfg.bg : "transparent",
        color: active ? cfg.color : "var(--muted)",
      }}
      onClick={onClick}
    >
      {cfg.emoji} {cfg.title}
    </button>
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

function shortDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
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
    <div className="space-y-4 rounded-xl bg-tint p-3">
      {loading ? (
        <p className="text-xs text-muted">Loading…</p>
      ) : (
        <>
          {/* Payment history */}
          <div>
            <p className="mb-1.5 text-[13px] font-bold">🧾 Payment history</p>
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
            <p className="mb-1.5 text-[13px] font-bold">📄 Documents</p>
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
