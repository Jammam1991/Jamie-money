"use client";

import { useRef, useState, useTransition } from "react";
import {
  Check,
  ChevronDown,
  FileText,
  Gauge,
  Plus,
  Trash2,
  TrendingDown,
  TrendingUp,
  Upload,
  X,
} from "lucide-react";
import { Card } from "@/components/ui";
import { money } from "@/lib/data";
import {
  parseCreditReport,
  todayIso,
  type ParsedDebt,
  type ParsedReport,
} from "@/lib/parseReport";
import { extractPdfText } from "@/lib/pdfText";
import type { CreditReport, FicoScoreEntry } from "@/lib/store";
import {
  addFicoScore,
  deleteCreditReport,
  deleteFicoScore,
  saveCreditReport,
} from "@/lib/actions";

const inputClass =
  "w-full rounded-lg border border-border bg-card px-3 py-2 text-[15px] outline-none focus:border-[var(--muted)]";
const primaryBtn =
  "rounded-lg px-3 py-2 text-sm font-medium text-white disabled:opacity-50";

// Plain-English label for a credit score.
function scoreLabel(score: number): string {
  if (score >= 800) return "Excellent";
  if (score >= 740) return "Very good";
  if (score >= 670) return "Good";
  if (score >= 580) return "Fair";
  return "Needs work";
}

function scoreColor(score: number): string {
  if (score >= 740) return "var(--good)";
  if (score >= 670) return "#fbbf24";
  if (score >= 580) return "#ff6b35";
  return "#dc2626";
}

// "2026-05-03" → "May 3, 2026". Split by hand so the date never slides a day
// because of time zones.
function niceDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return isoDate;
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${months[m - 1]} ${d}, ${y}`;
}

export default function CreditReportClient({
  initialReports,
  initialScores,
  admin,
}: {
  initialReports: CreditReport[];
  initialScores: FicoScoreEntry[];
  admin: boolean;
}) {
  const [reports, setReports] = useState(initialReports);
  const [scores, setScores] = useState(initialScores);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const tempId = useRef(-1);

  // Newest first for reports; oldest first for scores (so the chart reads
  // left to right).
  const latest = reports[0] ?? null;
  const previous = reports[1] ?? null;
  const latestScore = scores.length > 0 ? scores[scores.length - 1] : null;
  const priorScore = scores.length > 1 ? scores[scores.length - 2] : null;

  function handleSaveReport(input: {
    reportDate: string;
    bureau: string;
    score: number | null;
    accounts: ParsedDebt[];
  }) {
    const tid = String(tempId.current--);
    const total = input.accounts.reduce((s, a) => s + a.balance, 0);
    const optimistic: CreditReport = {
      id: tid,
      reportDate: input.reportDate,
      bureau: input.bureau,
      ficoScore: input.score,
      totalBalance: total,
      note: null,
      accounts: input.accounts.map((a, i) => ({
        id: `${tid}-${i}`,
        reportId: tid,
        name: a.name,
        balance: a.balance,
        apr: a.apr,
        minPayment: a.minPayment,
      })),
    };
    setReports((r) =>
      [optimistic, ...r].sort((a, b) => b.reportDate.localeCompare(a.reportDate))
    );
    if (input.score !== null) {
      setScores((s) =>
        [
          ...s,
          {
            id: `${tid}-score`,
            score: input.score!,
            scoredOn: input.reportDate,
            source: "report",
          },
        ].sort((a, b) => a.scoredOn.localeCompare(b.scoredOn))
      );
    }
    setUploading(false);
    setError(null);

    startTransition(async () => {
      const res = await saveCreditReport(input);
      if (res.ok && res.id) {
        setReports((r) => r.map((x) => (x.id === tid ? { ...x, id: res.id! } : x)));
      } else if (!res.ok) {
        setReports((r) => r.filter((x) => x.id !== tid));
        setScores((s) => s.filter((x) => x.id !== `${tid}-score`));
        setError(res.error ?? "Couldn't save that report.");
      }
    });
  }

  function handleDeleteReport(id: string) {
    const removed = reports.find((r) => r.id === id);
    setReports((r) => r.filter((x) => x.id !== id));
    // The report's own score entry goes with it (the database cascades too).
    setScores((s) =>
      s.filter(
        (x) => !(x.source === "report" && x.scoredOn === removed?.reportDate)
      )
    );
    startTransition(() => {
      deleteCreditReport(id);
    });
  }

  function handleAddScore(score: number, scoredOn: string) {
    const tid = String(tempId.current--);
    setScores((s) =>
      [...s, { id: tid, score, scoredOn, source: "manual" }].sort((a, b) =>
        a.scoredOn.localeCompare(b.scoredOn)
      )
    );
    startTransition(async () => {
      const res = await addFicoScore({ score, scoredOn });
      if (res.ok && res.id) {
        setScores((s) => s.map((x) => (x.id === tid ? { ...x, id: res.id! } : x)));
      } else if (!res.ok) {
        setScores((s) => s.filter((x) => x.id !== tid));
        setError(res.error ?? "Couldn't save that score.");
      }
    });
  }

  function handleDeleteScore(id: string) {
    setScores((s) => s.filter((x) => x.id !== id));
    startTransition(() => {
      deleteFicoScore(id);
    });
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-2xl bg-warn-bg p-3 text-[13px] text-warn">{error}</div>
      )}

      {/* Credit score right now */}
      <ScoreHeadline latest={latestScore} prior={priorScore} />

      {/* Upload a new report */}
      {admin &&
        (uploading ? (
          <UploadPanel
            onCancel={() => setUploading(false)}
            onSave={handleSaveReport}
          />
        ) : (
          <button
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-4 text-sm text-muted"
            onClick={() => {
              setError(null);
              setUploading(true);
            }}
          >
            <Upload size={16} />
            Upload a credit report
          </button>
        ))}

      {/* Score history */}
      <ScoreHistory
        scores={scores}
        admin={admin}
        onAdd={handleAddScore}
        onDelete={handleDeleteScore}
      />

      {/* What the newest report says he owes */}
      {latest && <LatestReport report={latest} previous={previous} />}

      {/* Every report, oldest kept forever */}
      {reports.length > 0 && (
        <Card>
          <p className="mb-2 flex items-center gap-1.5 text-[13px] text-muted">
            <FileText size={15} />
            Report history
          </p>
          <div className="space-y-2">
            {reports.map((r) => (
              <ReportRow
                key={r.id}
                report={r}
                admin={admin}
                onDelete={() => handleDeleteReport(r.id)}
              />
            ))}
          </div>
        </Card>
      )}

      {reports.length === 0 && scores.length === 0 && (
        <Card>
          <p className="text-sm text-muted">
            Nothing here yet. Upload a credit report and this page will keep the
            debts it lists, the score, and how both change over time.
          </p>
        </Card>
      )}
    </div>
  );
}

// ── The big number at the top ─────────────────────────────────────────────────
function ScoreHeadline({
  latest,
  prior,
}: {
  latest: FicoScoreEntry | null;
  prior: FicoScoreEntry | null;
}) {
  if (!latest) {
    return (
      <Card>
        <p className="flex items-center gap-1.5 text-[13px] text-muted">
          <Gauge size={15} />
          Credit score
        </p>
        <p className="mt-2 text-sm text-muted">
          No score saved yet. It gets filled in the first time a report is
          uploaded.
        </p>
      </Card>
    );
  }

  const change = prior ? latest.score - prior.score : 0;

  return (
    <Card>
      <p className="flex items-center gap-1.5 text-[13px] text-muted">
        <Gauge size={15} />
        Credit score
      </p>
      <div className="mt-2 flex items-baseline justify-between">
        <span
          className="text-4xl font-medium"
          style={{ color: scoreColor(latest.score) }}
        >
          {latest.score}
        </span>
        <span className="text-[13px] text-muted">{scoreLabel(latest.score)}</span>
      </div>
      <p className="mt-1 text-xs text-muted">As of {niceDate(latest.scoredOn)}</p>
      {prior && (
        <p
          className="mt-2 flex items-center gap-1.5 text-[13px]"
          style={{
            color:
              change > 0 ? "var(--good)" : change < 0 ? "var(--warn)" : "var(--muted)",
          }}
        >
          {change > 0 ? (
            <TrendingUp size={15} />
          ) : change < 0 ? (
            <TrendingDown size={15} />
          ) : null}
          {change === 0
            ? `No change since ${niceDate(prior.scoredOn)}`
            : `${change > 0 ? "Up" : "Down"} ${Math.abs(change)} point${
                Math.abs(change) === 1 ? "" : "s"
              } since ${niceDate(prior.scoredOn)}`}
        </p>
      )}
    </Card>
  );
}

// ── Score history: a small line chart plus the list ───────────────────────────
function ScoreHistory({
  scores,
  admin,
  onAdd,
  onDelete,
}: {
  scores: FicoScoreEntry[];
  admin: boolean;
  onAdd: (score: number, scoredOn: string) => void;
  onDelete: (id: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [score, setScore] = useState("");
  const [when, setWhen] = useState(todayIso());

  function submit() {
    const n = Number(score);
    if (!(n >= 300 && n <= 850)) return;
    onAdd(Math.round(n), when);
    setScore("");
    setWhen(todayIso());
    setAdding(false);
  }

  return (
    <Card>
      <p className="mb-2 text-[13px] text-muted">Score history</p>

      {scores.length === 0 ? (
        <p className="text-sm text-muted">No scores saved yet.</p>
      ) : (
        <>
          <ScoreChart scores={scores} />
          <div className="mt-3 space-y-2">
            {[...scores].reverse().map((s) => (
              <div key={s.id} className="flex items-center justify-between text-[15px]">
                <span className="text-muted">{niceDate(s.scoredOn)}</span>
                <span className="flex items-center gap-3">
                  <span className="font-medium" style={{ color: scoreColor(s.score) }}>
                    {s.score}
                  </span>
                  {admin && (
                    <button
                      aria-label="Delete score"
                      className="text-muted"
                      onClick={() => onDelete(s.id)}
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {admin &&
        (adding ? (
          <div className="mt-3 space-y-2 rounded-xl bg-tint p-3">
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="mb-1 block text-[11px] text-muted">Score</span>
                <input
                  type="number"
                  inputMode="numeric"
                  className={inputClass}
                  placeholder="700"
                  value={score}
                  onChange={(e) => setScore(e.target.value)}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] text-muted">Date</span>
                <input
                  type="date"
                  className={inputClass}
                  value={when}
                  onChange={(e) => setWhen(e.target.value)}
                />
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <button
                className="rounded-lg px-3 py-2 text-sm text-muted"
                onClick={() => setAdding(false)}
              >
                Cancel
              </button>
              <button
                className={primaryBtn + " flex items-center gap-1.5"}
                style={{ background: "var(--good)" }}
                onClick={submit}
                disabled={!(Number(score) >= 300 && Number(score) <= 850)}
              >
                <Check size={16} />
                Save
              </button>
            </div>
          </div>
        ) : (
          <button
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-border py-2 text-sm text-muted"
            onClick={() => setAdding(true)}
          >
            <Plus size={16} />
            Add a score by hand
          </button>
        ))}
    </Card>
  );
}

// A simple line chart of the scores over time.
function ScoreChart({ scores }: { scores: FicoScoreEntry[] }) {
  const values = scores.map((s) => s.score);
  const lo = Math.min(...values) - 10;
  const hi = Math.max(...values) + 10;
  const span = Math.max(1, hi - lo);

  const x = (i: number) =>
    scores.length === 1 ? 150 : 10 + (i / (scores.length - 1)) * 280;
  const y = (v: number) => 90 - ((v - lo) / span) * 80;

  const points = scores.map((s, i) => `${x(i)},${y(s.score)}`).join(" ");
  const last = scores[scores.length - 1];

  return (
    <div className="rounded-xl bg-tint p-2">
      <svg viewBox="0 0 300 100" className="h-24 w-full" aria-hidden="true">
        {scores.length > 1 && (
          <polyline
            points={points}
            fill="none"
            stroke={scoreColor(last.score)}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}
        {scores.map((s, i) => (
          <circle
            key={s.id}
            cx={x(i)}
            cy={y(s.score)}
            r={3}
            fill={scoreColor(s.score)}
          />
        ))}
      </svg>
      <div className="flex justify-between px-1 text-[11px] text-muted">
        <span>{niceDate(scores[0].scoredOn)}</span>
        {scores.length > 1 && <span>{niceDate(last.scoredOn)}</span>}
      </div>
    </div>
  );
}

// ── What the newest report says ───────────────────────────────────────────────
function LatestReport({
  report,
  previous,
}: {
  report: CreditReport;
  previous: CreditReport | null;
}) {
  const change = previous ? report.totalBalance - previous.totalBalance : 0;
  const minTotal = report.accounts.reduce((s, a) => s + a.minPayment, 0);

  return (
    <>
      <div className="rounded-2xl bg-warn-bg p-4">
        <p className="text-[13px] text-warn">Owed on the newest report</p>
        <p className="text-3xl font-medium text-warn">{money(report.totalBalance)}</p>
        <p className="mt-1 text-[13px] text-warn">
          {report.accounts.length} account{report.accounts.length === 1 ? "" : "s"} ·{" "}
          {report.bureau} · {niceDate(report.reportDate)}
        </p>
        {previous && change !== 0 && (
          <p className="mt-2 text-[13px] text-warn">
            {change < 0 ? "Down" : "Up"} {money(Math.abs(change))} since{" "}
            {niceDate(previous.reportDate)}.
          </p>
        )}
      </div>

      <Card>
        <p className="mb-2 text-[13px] text-muted">Accounts on that report</p>
        <div className="space-y-3">
          {report.accounts.map((a) => (
            <div key={a.id}>
              <div className="flex items-center justify-between font-medium">
                <span className="truncate">{a.name}</span>
                <span>{money(a.balance)}</span>
              </div>
              <p className="mt-1 text-xs text-muted">
                {a.apr}% interest · {money(a.minPayment)}/mo minimum
              </p>
            </div>
          ))}
          {report.accounts.length === 0 && (
            <p className="text-sm text-muted">No accounts were read off it.</p>
          )}
        </div>
        {minTotal > 0 && (
          <p className="mt-3 text-xs text-muted">
            Minimum payments add up to {money(minTotal)} a month.
          </p>
        )}
      </Card>
    </>
  );
}

// ── One row in the report history, tap to open ────────────────────────────────
function ReportRow({
  report,
  admin,
  onDelete,
}: {
  report: CreditReport;
  admin: boolean;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl bg-tint p-3">
      <div className="flex items-center justify-between">
        <button
          className="flex flex-1 items-center gap-2 text-left"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
        >
          <ChevronDown
            size={16}
            className={`shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`}
          />
          <span>
            <span className="block text-[15px] font-medium">
              {niceDate(report.reportDate)}
            </span>
            <span className="block text-xs text-muted">
              {report.bureau} · {money(report.totalBalance)}
              {report.ficoScore !== null && ` · score ${report.ficoScore}`}
            </span>
          </span>
        </button>
        {admin && (
          <button aria-label="Delete report" className="text-muted" onClick={onDelete}>
            <Trash2 size={15} />
          </button>
        )}
      </div>

      {open && (
        <div className="mt-3 space-y-2 border-t border-border pt-3">
          {report.accounts.map((a) => (
            <div key={a.id} className="flex items-center justify-between text-[13px]">
              <span className="truncate text-muted">{a.name}</span>
              <span>{money(a.balance)}</span>
            </div>
          ))}
          {report.accounts.length === 0 && (
            <p className="text-[13px] text-muted">No accounts on this one.</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Upload / paste a report, check what was read, then save ───────────────────
function UploadPanel({
  onCancel,
  onSave,
}: {
  onCancel: () => void;
  onSave: (input: {
    reportDate: string;
    bureau: string;
    score: number | null;
    accounts: ParsedDebt[];
  }) => void;
}) {
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState<ParsedReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setNote(null);
    try {
      const extracted = await extractPdfText(file);
      if (!extracted.trim()) {
        setNote(
          "Couldn't read text from that PDF. Try copy-pasting the report text below."
        );
      } else {
        setText(extracted);
        setParsed(parseCreditReport(extracted));
      }
    } catch {
      setNote(
        "Couldn't open that file. Try copy-pasting the report text below instead."
      );
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  function updateAccount(i: number, patch: Partial<ParsedDebt>) {
    setParsed((p) =>
      p
        ? {
            ...p,
            accounts: p.accounts.map((a, idx) =>
              idx === i ? { ...a, ...patch } : a
            ),
          }
        : p
    );
  }

  function removeAccount(i: number) {
    setParsed((p) =>
      p ? { ...p, accounts: p.accounts.filter((_, idx) => idx !== i) } : p
    );
  }

  if (parsed === null) {
    return (
      <Card>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[13px] font-medium">Upload a credit report</p>
          <button aria-label="Close" className="text-muted" onClick={onCancel}>
            <X size={18} />
          </button>
        </div>

        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border py-4 text-sm text-muted">
          <Upload size={16} />
          {busy ? "Reading…" : "Pick a credit-report PDF"}
          <input
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={onFile}
            disabled={busy}
          />
        </label>

        <p className="my-2 text-center text-xs text-muted">or paste the text</p>
        <textarea
          className={inputClass + " h-28 resize-none"}
          placeholder="Paste the text from the credit report here…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        {note && <p className="mt-2 text-xs text-warn">{note}</p>}
        <div className="mt-3 flex justify-end">
          <button
            className={primaryBtn}
            style={{ background: "var(--good)" }}
            onClick={() => setParsed(parseCreditReport(text))}
            disabled={!text.trim()}
          >
            Read the report
          </button>
        </div>
      </Card>
    );
  }

  const total = parsed.accounts.reduce((s, a) => s + a.balance, 0);

  return (
    <Card>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[13px] font-medium">Check what was read</p>
        <button aria-label="Close" className="text-muted" onClick={onCancel}>
          <X size={18} />
        </button>
      </div>
      <p className="mb-3 text-xs text-muted">
        Fix anything wrong, then save. Nothing is stored until you tap save.
      </p>

      <div className="grid grid-cols-3 gap-2">
        <label className="block">
          <span className="mb-1 block text-[11px] text-muted">Report date</span>
          <input
            type="date"
            className={inputClass}
            value={parsed.reportDate}
            onChange={(e) =>
              setParsed({ ...parsed, reportDate: e.target.value })
            }
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] text-muted">Bureau</span>
          <select
            className={inputClass}
            value={parsed.bureau}
            onChange={(e) => setParsed({ ...parsed, bureau: e.target.value })}
          >
            <option>Experian</option>
            <option>Equifax</option>
            <option>TransUnion</option>
            <option>Unknown</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] text-muted">Score</span>
          <input
            type="number"
            inputMode="numeric"
            placeholder="—"
            className={inputClass}
            value={parsed.score ?? ""}
            onChange={(e) =>
              setParsed({
                ...parsed,
                score: e.target.value === "" ? null : Number(e.target.value),
              })
            }
          />
        </label>
      </div>

      <p className="mb-2 mt-4 text-xs text-muted">
        {parsed.accounts.length === 0
          ? "No accounts found — you can still save the score."
          : `Found ${parsed.accounts.length} account${
              parsed.accounts.length === 1 ? "" : "s"
            }, ${money(total)} in total.`}
      </p>

      <div className="space-y-3">
        {parsed.accounts.map((a, i) => (
          <div key={i} className="rounded-xl bg-tint p-3">
            <div className="mb-2 flex items-center gap-2">
              <input
                className={inputClass}
                value={a.name}
                onChange={(e) => updateAccount(i, { name: e.target.value })}
              />
              <button
                aria-label="Remove"
                className="text-muted"
                onClick={() => removeAccount(i)}
              >
                <Trash2 size={16} />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <NumberField
                label="Balance $"
                value={a.balance}
                onChange={(v) => updateAccount(i, { balance: v })}
              />
              <NumberField
                label="Rate %"
                value={a.apr}
                onChange={(v) => updateAccount(i, { apr: v })}
              />
              <NumberField
                label="Min $/mo"
                value={a.minPayment}
                onChange={(v) => updateAccount(i, { minPayment: v })}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 flex justify-end gap-2">
        <button
          className="rounded-lg px-3 py-2 text-sm text-muted"
          onClick={() => setParsed(null)}
        >
          Back
        </button>
        <button
          className={primaryBtn + " flex items-center gap-1.5"}
          style={{ background: "var(--good)" }}
          onClick={() =>
            onSave({
              reportDate: parsed.reportDate,
              bureau: parsed.bureau,
              score:
                parsed.score !== null &&
                parsed.score >= 300 &&
                parsed.score <= 850
                  ? parsed.score
                  : null,
              accounts: parsed.accounts,
            })
          }
        >
          <Check size={16} />
          Save report
        </button>
      </div>
    </Card>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] text-muted">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        className="w-full rounded-lg border border-border bg-card px-2 py-1.5 text-[15px] outline-none"
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
      />
    </label>
  );
}
