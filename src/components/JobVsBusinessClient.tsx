"use client";

import { useState } from "react";
import { Card } from "./ui";
import { Plus, X, ChevronDown, Trash2 } from "lucide-react";
import type {
  JobVsBusiness,
  ProCon,
  JobPosting,
  DecisionEntry,
} from "@/lib/store";

// The five numbers live in Supabase under snake_case column names, but the app
// carries them around in camelCase. Without this map the save goes out with the
// wrong field name and the database quietly drops it.
const COLUMN: Record<string, string> = {
  businessMonthlyIncome: "business_monthly_income",
  jobSalaryAnnual: "job_salary_annual",
  benefitsValue: "benefits_value",
  businessHoursPerWeek: "business_hours_per_week",
  jobHoursPerWeek: "job_hours_per_week",
};

const money = (n: number) => "$" + Math.round(n).toLocaleString("en-US");

type SideKey = "business" | "job";

// Each side gets its own colour and emoji so the two are told apart at a
// glance, before a single word is read.
const SIDES: Record<
  SideKey,
  {
    label: string;
    emoji: string;
    gradient: string;
    pro: ProCon["type"];
    con: ProCon["type"];
  }
> = {
  business: {
    label: "My Business",
    emoji: "🚀",
    gradient: "linear-gradient(135deg,#7c3aed 0%,#c026d3 100%)",
    pro: "business_pro",
    con: "business_con",
  },
  job: {
    label: "A Job",
    emoji: "💼",
    gradient: "linear-gradient(135deg,#0284c7 0%,#0d9488 100%)",
    pro: "job_pro",
    con: "job_con",
  },
};

// Friendly starters so an empty list is an invitation instead of a blank box.
const SUGGESTIONS: Record<ProCon["type"], string[]> = {
  business_pro: [
    "I set my own hours",
    "Nobody is my boss",
    "Every extra client is mine",
    "I'm building something of my own",
  ],
  business_con: [
    "Some weeks are slow",
    "No paid days off",
    "I pay for my own health cover",
    "I have to find the work",
  ],
  job_pro: [
    "Same paycheck every time",
    "Health benefits included",
    "Paid time off",
    "Someone else brings the work",
  ],
  job_con: [
    "Someone else owns my day",
    "Raises are small and slow",
    "The drive eats my time",
    "I could be let go",
  ],
};

export default function JobVsBusinessClient({
  initialComparison,
  initialProsCons,
  initialPostings,
  initialJournal,
}: {
  initialComparison: JobVsBusiness | null;
  initialProsCons: ProCon[];
  initialPostings: JobPosting[];
  initialJournal: DecisionEntry[];
}) {
  const [comparison, setComparison] = useState<Partial<JobVsBusiness>>(
    initialComparison || {}
  );
  const [prosCons, setProsCons] = useState<ProCon[]>(initialProsCons);
  const [postings, setPostings] = useState<JobPosting[]>(initialPostings);
  const [journal, setJournal] = useState<DecisionEntry[]>(initialJournal);

  const [side, setSide] = useState<SideKey>("business");
  const [showNumbers, setShowNumbers] = useState(false);
  const [showPostings, setShowPostings] = useState(false);
  const [showJournal, setShowJournal] = useState(false);

  const [showNewPosting, setShowNewPosting] = useState(false);
  const [newPostingForm, setNewPostingForm] = useState({
    company_name: "",
    role_title: "",
    salary: "",
    link: "",
    notes: "",
  });
  const [showNewJournal, setShowNewJournal] = useState(false);
  const [newJournalForm, setNewJournalForm] = useState({
    date: new Date().toISOString().split("T")[0],
    notes: "",
  });

  // Typing updates the screen right away; the save waits for the field to lose
  // focus so we aren't firing a request on every keystroke.
  const setField = (key: keyof JobVsBusiness, value: number) =>
    setComparison((c) => ({ ...c, [key]: value }));

  const saveField = async (key: keyof JobVsBusiness) => {
    const column = COLUMN[key];
    if (!column) return;
    await fetch("/api/job-vs-business", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [column]: comparison[key] ?? 0 }),
    });
  };

  const addProCon = async (type: ProCon["type"], text: string) => {
    const clean = text.trim();
    if (!clean) return;
    const res = await fetch("/api/pros-cons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, text: clean, sort: prosCons.length }),
    });
    if (!res.ok) return;
    const created = await res.json();
    setProsCons((list) => [...list, created]);
  };

  const deleteProCon = async (id: string) => {
    setProsCons((list) => list.filter((p) => p.id !== id));
    await fetch(`/api/pros-cons/${id}`, { method: "DELETE" });
  };

  const addPosting = async () => {
    if (!newPostingForm.company_name.trim() || !newPostingForm.role_title.trim())
      return;
    const res = await fetch("/api/job-postings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        company_name: newPostingForm.company_name,
        role_title: newPostingForm.role_title,
        salary: newPostingForm.salary || null,
        link: newPostingForm.link || null,
        status: "Interested",
        notes: newPostingForm.notes || null,
      }),
    });
    if (res.ok) {
      setPostings([await res.json(), ...postings]);
      setNewPostingForm({
        company_name: "",
        role_title: "",
        salary: "",
        link: "",
        notes: "",
      });
      setShowNewPosting(false);
    }
  };

  const updatePostingStatus = async (
    id: string,
    status: JobPosting["status"]
  ) => {
    setPostings(postings.map((p) => (p.id === id ? { ...p, status } : p)));
    await fetch(`/api/job-postings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
  };

  const deletePosting = async (id: string) => {
    setPostings(postings.filter((p) => p.id !== id));
    await fetch(`/api/job-postings/${id}`, { method: "DELETE" });
  };

  const addJournalEntry = async () => {
    if (!newJournalForm.notes.trim()) return;
    const res = await fetch("/api/decision-journal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entry_date: newJournalForm.date,
        notes: newJournalForm.notes,
      }),
    });
    if (res.ok) {
      setJournal([await res.json(), ...journal]);
      setNewJournalForm({
        date: new Date().toISOString().split("T")[0],
        notes: "",
      });
      setShowNewJournal(false);
    }
  };

  const deleteJournalEntry = async (id: string) => {
    setJournal(journal.filter((j) => j.id !== id));
    await fetch(`/api/decision-journal/${id}`, { method: "DELETE" });
  };

  // ── The math behind the face-off ───────────────────────────────────────────
  const bizMonthly = comparison.businessMonthlyIncome || 0;
  const jobAnnual = comparison.jobSalaryAnnual || 0;
  const benefits = comparison.benefitsValue || 0;
  const bizHours = comparison.businessHoursPerWeek || 0;
  const jobHours = comparison.jobHoursPerWeek || 0;

  // A job's benefits are real money, so they count toward what it pays.
  const jobMonthly = (jobAnnual + benefits) / 12;
  const bizPerHour = bizHours ? (bizMonthly * 12) / (bizHours * 52) : 0;
  const jobPerHour = jobHours ? (jobAnnual + benefits) / (jobHours * 52) : 0;

  const gap = bizMonthly - jobMonthly;
  const hasNumbers = bizMonthly > 0 || jobMonthly > 0;
  const winner: SideKey | null = !hasNumbers || gap === 0 ? null : gap > 0 ? "business" : "job";

  const count = (type: ProCon["type"]) =>
    prosCons.filter((p) => p.type === type).length;

  return (
    <div className="space-y-5 pb-8">
      {/* ── The face-off ──────────────────────────────────────────────────── */}
      <div className="relative">
        <div className="grid grid-cols-2 gap-2.5">
          {(["business", "job"] as SideKey[]).map((key) => (
            <ScoreCard
              key={key}
              side={SIDES[key]}
              amount={key === "business" ? bizMonthly : jobMonthly}
              hours={key === "business" ? bizHours : jobHours}
              perHour={key === "business" ? bizPerHour : jobPerHour}
              winner={winner === key}
            />
          ))}
        </div>
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-bg bg-card text-[11px] font-bold tracking-wide shadow-sm">
          VS
        </div>
      </div>

      {/* The one-line answer. */}
      <Card className="text-center">
        {!hasNumbers ? (
          <p className="text-[14px] text-muted">
            Pop your numbers in below and we&apos;ll show you who&apos;s ahead. 👇
          </p>
        ) : winner === null ? (
          <p className="text-[15px]">🤝 Dead heat — the money comes out the same.</p>
        ) : (
          <>
            <p className="text-[15px] leading-snug">
              {SIDES[winner].emoji} <b>{SIDES[winner].label}</b> puts{" "}
              <b style={{ color: "var(--good)" }}>{money(Math.abs(gap))}</b> more
              in your pocket every month.
            </p>
            {bizHours > 0 && jobHours > 0 && bizHours !== jobHours && (
              <p className="mt-1.5 text-[13px] text-muted">
                {bizHours < jobHours ? "🚀 Business" : "💼 The job"} also gives you{" "}
                <b>{Math.abs(bizHours - jobHours)} hours</b> back each week.
              </p>
            )}
          </>
        )}
      </Card>

      {/* ── Money race ────────────────────────────────────────────────────── */}
      {hasNumbers && (
        <Card>
          <p className="mb-3 text-[13px] text-muted">Take-home, month by month</p>
          <div className="space-y-3">
            <RaceBar
              side={SIDES.business}
              amount={bizMonthly}
              max={Math.max(bizMonthly, jobMonthly)}
            />
            <RaceBar
              side={SIDES.job}
              amount={jobMonthly}
              max={Math.max(bizMonthly, jobMonthly)}
            />
          </div>
          {benefits > 0 && (
            <p className="mt-3 text-[12px] text-muted">
              The job&apos;s bar includes {money(benefits / 12)} a month of benefits.
            </p>
          )}
        </Card>
      )}

      {/* ── The good and the tough ────────────────────────────────────────── */}
      <div>
        <div className="mb-3 grid grid-cols-2 gap-2.5">
          {(["business", "job"] as SideKey[]).map((key) => {
            const s = SIDES[key];
            const on = side === key;
            return (
              <button
                key={key}
                onClick={() => setSide(key)}
                className="rounded-2xl border p-3 text-left transition-all"
                style={{
                  borderColor: on ? "transparent" : "var(--border)",
                  background: on ? s.gradient : "var(--card)",
                  color: on ? "#fff" : "var(--text)",
                }}
              >
                <div className="text-[15px] font-medium">
                  {s.emoji} {s.label}
                </div>
                <div
                  className="mt-0.5 text-[12px]"
                  style={{ color: on ? "rgba(255,255,255,.8)" : "var(--muted)" }}
                >
                  {count(s.pro)} good · {count(s.con)} tough
                </div>
              </button>
            );
          })}
        </div>

        <div className="space-y-3">
          <ProConList
            title="What's great about it"
            emoji="✅"
            tone="good"
            type={SIDES[side].pro}
            items={prosCons.filter((p) => p.type === SIDES[side].pro)}
            onAdd={addProCon}
            onDelete={deleteProCon}
          />
          <ProConList
            title="What's tough about it"
            emoji="⚠️"
            tone="warn"
            type={SIDES[side].con}
            items={prosCons.filter((p) => p.type === SIDES[side].con)}
            onAdd={addProCon}
            onDelete={deleteProCon}
          />
        </div>
      </div>

      {/* ── The numbers, tucked away ──────────────────────────────────────── */}
      <Section
        title="🎛️ Tweak the numbers"
        open={showNumbers}
        onToggle={() => setShowNumbers(!showNumbers)}
      >
        <div className="space-y-3.5">
          <NumberField
            emoji="🚀"
            label="Business — take-home a month"
            unit="money"
            value={comparison.businessMonthlyIncome || 0}
            onChange={(v) => setField("businessMonthlyIncome", v)}
            onCommit={() => saveField("businessMonthlyIncome")}
          />
          <NumberField
            emoji="💼"
            label="Job — salary a year"
            unit="money"
            value={comparison.jobSalaryAnnual || 0}
            onChange={(v) => setField("jobSalaryAnnual", v)}
            onCommit={() => saveField("jobSalaryAnnual")}
          />
          <NumberField
            emoji="🏥"
            label="Job — benefits a year"
            unit="money"
            value={comparison.benefitsValue || 0}
            onChange={(v) => setField("benefitsValue", v)}
            onCommit={() => saveField("benefitsValue")}
          />
          <NumberField
            emoji="⏰"
            label="Business — hours a week"
            unit="hours"
            value={comparison.businessHoursPerWeek || 0}
            onChange={(v) => setField("businessHoursPerWeek", v)}
            onCommit={() => saveField("businessHoursPerWeek")}
          />
          <NumberField
            emoji="⏰"
            label="Job — hours a week"
            unit="hours"
            value={comparison.jobHoursPerWeek || 0}
            onChange={(v) => setField("jobHoursPerWeek", v)}
            onCommit={() => saveField("jobHoursPerWeek")}
          />
        </div>
      </Section>

      {/* ── Jobs worth a look ─────────────────────────────────────────────── */}
      <Section
        title={`💼 Jobs worth a look${postings.length ? ` (${postings.length})` : ""}`}
        open={showPostings}
        onToggle={() => setShowPostings(!showPostings)}
      >
        <button
          onClick={() => setShowNewPosting(!showNewPosting)}
          className="mb-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border py-2.5 text-[13px] text-muted"
        >
          <Plus size={15} /> Add a job you spotted
        </button>

        {showNewPosting && (
          <div className="mb-3 space-y-2 rounded-xl bg-tint p-3">
            {(
              [
                ["company_name", "Company name"],
                ["role_title", "Role / title"],
                ["salary", "Pay (optional)"],
                ["link", "Link (optional)"],
              ] as const
            ).map(([field, placeholder]) => (
              <input
                key={field}
                type="text"
                placeholder={placeholder}
                value={newPostingForm[field]}
                onChange={(e) =>
                  setNewPostingForm({ ...newPostingForm, [field]: e.target.value })
                }
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-[15px]"
              />
            ))}
            <textarea
              placeholder="Notes (optional)"
              value={newPostingForm.notes}
              onChange={(e) =>
                setNewPostingForm({ ...newPostingForm, notes: e.target.value })
              }
              rows={2}
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-[15px]"
            />
            <div className="flex gap-2">
              <button
                onClick={addPosting}
                className="flex-1 rounded-lg bg-good py-2 text-[14px] font-medium text-card"
              >
                Save it
              </button>
              <button
                onClick={() => setShowNewPosting(false)}
                className="flex-1 rounded-lg border border-border py-2 text-[14px]"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {postings.length === 0 ? (
          <p className="py-1 text-[14px] text-muted">
            Nothing here yet. Add a job posting to keep track of it.
          </p>
        ) : (
          <div className="space-y-2.5">
            {postings.map((posting) => (
              <div
                key={posting.id}
                className="rounded-xl border border-border p-3"
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="text-[15px] font-medium">
                      {posting.companyName}
                    </div>
                    <div className="text-[13px] text-muted">
                      {posting.roleTitle}
                      {posting.salary ? ` · ${posting.salary}` : ""}
                    </div>
                  </div>
                  <button
                    onClick={() => deletePosting(posting.id)}
                    aria-label="Delete posting"
                    className="p-1 text-muted"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(
                    [
                      "Interested",
                      "Applied",
                      "Interview",
                      "Offer",
                      "Rejected",
                    ] as const
                  ).map((status) => (
                    <button
                      key={status}
                      onClick={() => updatePostingStatus(posting.id, status)}
                      className={`rounded-full px-2.5 py-1 text-[12px] transition-colors ${
                        posting.status === status
                          ? "bg-good text-card"
                          : "border border-border text-muted"
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
                {posting.notes && (
                  <p className="mt-2 text-[13px] text-muted">{posting.notes}</p>
                )}
                {posting.link && (
                  <a
                    href={posting.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-block text-[13px] text-good"
                  >
                    View posting →
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* ── How I'm feeling ───────────────────────────────────────────────── */}
      <Section
        title={`📓 How I'm feeling${journal.length ? ` (${journal.length})` : ""}`}
        open={showJournal}
        onToggle={() => setShowJournal(!showJournal)}
      >
        <button
          onClick={() => setShowNewJournal(!showNewJournal)}
          className="mb-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border py-2.5 text-[13px] text-muted"
        >
          <Plus size={15} /> Write down a thought
        </button>

        {showNewJournal && (
          <div className="mb-3 space-y-2 rounded-xl bg-tint p-3">
            <input
              type="date"
              value={newJournalForm.date}
              onChange={(e) =>
                setNewJournalForm({ ...newJournalForm, date: e.target.value })
              }
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-[15px]"
            />
            <textarea
              placeholder="What's on your mind today?"
              value={newJournalForm.notes}
              onChange={(e) =>
                setNewJournalForm({ ...newJournalForm, notes: e.target.value })
              }
              rows={3}
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-[15px]"
            />
            <div className="flex gap-2">
              <button
                onClick={addJournalEntry}
                className="flex-1 rounded-lg bg-good py-2 text-[14px] font-medium text-card"
              >
                Save it
              </button>
              <button
                onClick={() => setShowNewJournal(false)}
                className="flex-1 rounded-lg border border-border py-2 text-[14px]"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {journal.length === 0 ? (
          <p className="py-1 text-[14px] text-muted">
            Nothing written yet. Jot down how you feel about the choice — it
            helps to look back on it later.
          </p>
        ) : (
          <div className="space-y-2.5">
            {journal.map((entry) => (
              <div key={entry.id} className="rounded-xl border border-border p-3">
                <div className="mb-1.5 flex items-start justify-between gap-2">
                  <span className="text-[12px] font-medium text-muted">
                    {new Date(entry.entryDate).toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                  <button
                    onClick={() => deleteJournalEntry(entry.id)}
                    aria-label="Delete entry"
                    className="p-1 text-muted"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
                <p className="whitespace-pre-wrap text-[14px]">{entry.notes}</p>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

// ── Pieces ───────────────────────────────────────────────────────────────────

function ScoreCard({
  side,
  amount,
  hours,
  perHour,
  winner,
}: {
  side: (typeof SIDES)[SideKey];
  amount: number;
  hours: number;
  perHour: number;
  winner: boolean;
}) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl p-4 text-white"
      style={{ background: side.gradient }}
    >
      {winner && (
        <div className="absolute right-0 top-0 rounded-bl-xl bg-white/25 px-2 py-1 text-[10px] font-semibold">
          AHEAD
        </div>
      )}
      <div className="text-[26px] leading-none">{side.emoji}</div>
      <div className="mt-2 text-[12px] font-medium text-white/80">
        {side.label}
      </div>
      <div className="mt-0.5 text-[26px] font-semibold leading-none">
        {money(amount)}
      </div>
      <div className="mt-0.5 text-[11px] text-white/70">a month</div>

      <div className="mt-3 space-y-1 border-t border-white/25 pt-2.5 text-[11px]">
        <div className="flex justify-between">
          <span className="text-white/70">Hours/wk</span>
          <span className="font-semibold">{hours || "—"}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/70">Per hour</span>
          <span className="font-semibold">
            {perHour ? money(perHour) : "—"}
          </span>
        </div>
      </div>
    </div>
  );
}

function RaceBar({
  side,
  amount,
  max,
}: {
  side: (typeof SIDES)[SideKey];
  amount: number;
  max: number;
}) {
  const pct = max > 0 ? Math.max(4, (amount / max) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-[13px]">
        <span>
          {side.emoji} {side.label}
        </span>
        <span className="font-semibold">{money(amount)}</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-tint">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: side.gradient }}
        />
      </div>
    </div>
  );
}

function ProConList({
  title,
  emoji,
  tone,
  type,
  items,
  onAdd,
  onDelete,
}: {
  title: string;
  emoji: string;
  tone: "good" | "warn";
  type: ProCon["type"];
  items: ProCon[];
  onAdd: (type: ProCon["type"], text: string) => void;
  onDelete: (id: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState("");

  const bg = tone === "good" ? "var(--good-bg)" : "var(--warn-bg)";
  const fg = tone === "good" ? "var(--good)" : "var(--warn)";

  const submit = () => {
    onAdd(type, text);
    setText("");
    setAdding(false);
  };

  // Only suggest what isn't on the list already.
  const unused = SUGGESTIONS[type].filter(
    (s) => !items.some((i) => i.text === s)
  );

  return (
    <Card>
      <p className="mb-2.5 text-[13px] font-medium" style={{ color: fg }}>
        {emoji} {title}
      </p>

      {items.length > 0 && (
        <div className="mb-2.5 space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-start gap-2.5 rounded-xl px-3 py-2.5"
              style={{ background: bg }}
            >
              <span className="flex-1 text-[14px] leading-snug">
                {item.text}
              </span>
              <button
                onClick={() => onDelete(item.id)}
                aria-label="Remove"
                className="-m-1 p-1 opacity-50"
              >
                <X size={15} />
              </button>
            </div>
          ))}
        </div>
      )}

      {adding ? (
        <div className="space-y-2">
          <input
            autoFocus
            type="text"
            value={text}
            placeholder="Type it in your own words…"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-[15px]"
          />
          <div className="flex gap-2">
            <button
              onClick={submit}
              className="flex-1 rounded-lg py-2 text-[14px] font-medium text-white"
              style={{ background: fg }}
            >
              Add
            </button>
            <button
              onClick={() => {
                setAdding(false);
                setText("");
              }}
              className="flex-1 rounded-lg border border-border py-2 text-[14px]"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-1 text-[13px]"
            style={{ color: fg }}
          >
            <Plus size={15} /> Add your own
          </button>

          {items.length === 0 && unused.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {unused.slice(0, 4).map((s) => (
                <button
                  key={s}
                  onClick={() => onAdd(type, s)}
                  className="rounded-full border border-border px-2.5 py-1 text-[12px] text-muted"
                >
                  + {s}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </Card>
  );
}

function NumberField({
  emoji,
  label,
  unit,
  value,
  onChange,
  onCommit,
}: {
  emoji: string;
  label: string;
  unit: "money" | "hours";
  value: number;
  onChange: (v: number) => void;
  onCommit: () => void;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] text-muted">
        {emoji} {label}
      </span>
      <div className="relative">
        {unit === "money" && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[15px] text-muted">
            $
          </span>
        )}
        <input
          type="number"
          inputMode="decimal"
          step={unit === "hours" ? 0.5 : 1}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          onBlur={onCommit}
          className={`w-full rounded-xl border border-border bg-bg py-2.5 text-[16px] font-medium ${
            unit === "money" ? "pl-7 pr-3" : "pl-3 pr-12"
          }`}
        />
        {unit === "hours" && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-muted">
            hrs
          </span>
        )}
      </div>
    </label>
  );
}

function Section({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <Card className={open ? "" : "py-3"}>
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between text-left"
      >
        <span className="text-[15px] font-medium">{title}</span>
        <ChevronDown
          size={18}
          className="text-muted transition-transform"
          style={{ transform: open ? "rotate(180deg)" : "none" }}
        />
      </button>
      {open && <div className="mt-4">{children}</div>}
    </Card>
  );
}
