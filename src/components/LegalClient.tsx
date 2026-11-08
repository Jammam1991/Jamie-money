"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, CalendarDays, ChevronDown, ChevronRight, Gavel, Hash, Plus, User } from "lucide-react";
import { Card } from "./ui";
import { StatusPill, dueWord, money, shortDate } from "./projectBits";
import { blankLegalMatter, detailValue, moneyTotals, nextDate, type Project } from "@/lib/projects";
import { saveProject } from "@/lib/actions";

// ── Legal: every case and law firm ───────────────────────────────────────────
// Each matter is a project filed under Legal, so tapping one opens the same
// editor Projects uses — steps with dates, the people (lawyers, the other
// side), every bill and payment, the case facts and a dated diary of who said
// what. This screen is the overview: what's open, what's coming up, and what's
// still owed to the lawyers.

export default function LegalClient({ matters, today }: { matters: Project[]; today: string }) {
  const open = matters.filter((m) => m.status !== "Done");
  const closed = matters.filter((m) => m.status === "Done");
  const [showClosed, setShowClosed] = useState(false);

  const totals = matters.reduce(
    (t, m) => {
      const mt = moneyTotals(m);
      return { spent: t.spent + (mt.costs - mt.stillToPay), owed: t.owed + mt.stillToPay };
    },
    { spent: 0, owed: 0 }
  );
  const soon = open
    .map((m) => ({ m, next: nextDate(m) }))
    .filter((x): x is { m: Project; next: { date: string; what: string } } => x.next !== null)
    .sort((a, b) => a.next.date.localeCompare(b.next.date));
  const firms = new Set(matters.map((m) => detailValue(m, "Law firm")).filter(Boolean));

  return (
    <div className="space-y-4 pb-8">
      <section
        className="rounded-3xl p-5 text-white shadow-sm"
        style={{ background: "linear-gradient(135deg, #1f2937 0%, #374151 60%, #4b5563 100%)" }}
      >
        <div className="flex items-center gap-2 text-[12px] font-medium uppercase tracking-wider text-white/70">
          <Gavel size={14} /> At a glance
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Stat label="Open" value={String(open.length)} sub={`${firms.size} firm${firms.size === 1 ? "" : "s"}`} />
          <Stat label="Owed to lawyers" value={money(totals.owed)} sub="not paid yet" />
          <Stat label="Paid so far" value={money(totals.spent)} sub="all matters" />
        </div>
        {soon[0] && (
          <Link href={`/projects/${soon[0].m.id}`} className="mt-3 flex items-center gap-2 rounded-2xl bg-white/10 px-3 py-2.5 text-[13px] hover:bg-white/15">
            <CalendarDays size={15} className="shrink-0" />
            <span className="min-w-0 flex-1 truncate">
              Next up: {soon[0].next.what} — {soon[0].m.name}
            </span>
            <span className="shrink-0 font-medium">
              {shortDate(soon[0].next.date, today)} ({dueWord(soon[0].next.date, today).text})
            </span>
          </Link>
        )}
      </section>

      <NewMatter />

      {open.length === 0 && (
        <Card className="text-center text-[14px] text-muted">
          No open legal matters. Tap &ldquo;New legal matter&rdquo; to add a case, a dispute or a law firm you&apos;re working with.
        </Card>
      )}

      <div className="space-y-3">
        {open.map((m) => (
          <MatterCard key={m.id} matter={m} today={today} />
        ))}
      </div>

      {closed.length > 0 && (
        <section>
          <button onClick={() => setShowClosed((v) => !v)} className="flex items-center gap-1 text-[14px] font-medium text-muted">
            {showClosed ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            Closed ({closed.length})
          </button>
          {showClosed && (
            <div className="mt-3 space-y-3">
              {closed.map((m) => (
                <MatterCard key={m.id} matter={m} today={today} />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="min-w-0 rounded-2xl px-3 py-2.5" style={{ background: "rgba(255,255,255,0.1)" }}>
      <div className="truncate text-[11px] text-white/70">{label}</div>
      <div className="truncate text-[18px] font-semibold tabular-nums">{value}</div>
      <div className="truncate text-[11px] text-white/60">{sub}</div>
    </div>
  );
}

function MatterCard({ matter: m, today }: { matter: Project; today: string }) {
  const firm = detailValue(m, "Law firm");
  const caseNo = detailValue(m, "Case number");
  const lawyer = m.people.find((p) => /attorney|lawyer|counsel/i.test(p.role)) ?? null;
  const upcoming = nextDate(m);
  const due = upcoming ? dueWord(upcoming.date, today) : null;
  const { stillToPay } = moneyTotals(m);

  return (
    <Link href={`/projects/${m.id}`} className="block">
      <Card className="rounded-3xl transition-colors hover:bg-tint/40">
        <div className="flex items-start justify-between gap-2">
          <div className="text-[16px] font-semibold leading-snug">{m.name}</div>
          <StatusPill status={m.status} />
        </div>
        <div className="mt-2 grid gap-1 text-[13px] text-muted">
          {firm && (
            <span className="flex items-center gap-1.5">
              <Building2 size={14} className="shrink-0" /> <span className="truncate">{firm}</span>
            </span>
          )}
          {lawyer && (
            <span className="flex items-center gap-1.5">
              <User size={14} className="shrink-0" />
              <span className="truncate">
                {lawyer.name}
                {lawyer.phone ? ` · ${lawyer.phone}` : ""}
              </span>
            </span>
          )}
          {caseNo && (
            <span className="flex items-center gap-1.5">
              <Hash size={14} className="shrink-0" /> <span className="truncate">Case {caseNo}</span>
            </span>
          )}
        </div>
        {m.nextStep && (
          <div className="mt-2 text-[14px]">
            <span className="text-muted">Next: </span>
            {m.nextStep}
          </div>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]">
          {upcoming && due && (
            <span className="flex items-center gap-1" style={{ color: due.late ? "var(--neg)" : due.soon ? "var(--warn)" : "var(--muted)" }}>
              <CalendarDays size={14} />
              {shortDate(upcoming.date, today)} ({due.text}) — {upcoming.what}
            </span>
          )}
          {stillToPay > 0 && <span style={{ color: "var(--neg)" }}>{money(stillToPay)} owed</span>}
        </div>
      </Card>
    </Link>
  );
}

// A name, and the firm and lawyer if he knows them. Case number, court and the
// rest are waiting as blanks on the matter's own screen, where this sends him.
function NewMatter() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [firm, setFirm] = useState("");
  const [lawyer, setLawyer] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-border bg-card px-4 py-3 text-[15px] font-medium"
      >
        <Plus size={18} />
        New legal matter
      </button>
    );
  }

  const create = () => {
    if (!name.trim()) {
      setError("Give it a name first.");
      return;
    }
    setError(null);
    const matter = blankLegalMatter(name.trim(), firm, lawyer);
    startTransition(async () => {
      const res = await saveProject(matter);
      if (!res.ok) {
        setError(res.error ?? "That didn't save. Give it another go.");
        return;
      }
      router.push(`/projects/${matter.id}`);
    });
  };

  const input = "mt-1 w-full rounded-xl border border-border bg-bg px-3 py-2.5 text-[16px]";
  return (
    <Card className="rounded-3xl">
      <div className="text-[15px] font-semibold">New legal matter</div>
      <label className="mt-3 block">
        <span className="text-[14px]">What is it?</span>
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Divorce, Landlord dispute, Partnership agreement" className={input} />
      </label>
      <label className="mt-3 block">
        <span className="text-[14px]">Law firm <span className="text-muted">(optional)</span></span>
        <input value={firm} onChange={(e) => setFirm(e.target.value)} placeholder="e.g. Smith & Lee LLP" className={input} />
      </label>
      <label className="mt-3 block">
        <span className="text-[14px]">Your lawyer <span className="text-muted">(optional)</span></span>
        <input value={lawyer} onChange={(e) => setLawyer(e.target.value)} onKeyDown={(e) => e.key === "Enter" && create()} placeholder="Name" className={input} />
      </label>
      {error && <div className="mt-2 text-[13px]" style={{ color: "var(--neg)" }}>{error}</div>}
      <div className="mt-4 flex gap-2">
        <button
          onClick={create}
          disabled={pending}
          className="rounded-xl px-4 py-2.5 text-[15px] font-medium text-white disabled:opacity-50"
          style={{ background: "#374151" }}
        >
          {pending ? "Making it…" : "Add matter"}
        </button>
        <button onClick={() => setOpen(false)} className="rounded-xl border border-border px-4 py-2.5 text-[15px]">
          Cancel
        </button>
      </div>
    </Card>
  );
}
