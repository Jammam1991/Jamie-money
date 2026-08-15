"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import {
  Briefcase,
  Compass,
  ExternalLink,
  FileText,
  Plus,
  Search,
  Trash2,
  Upload,
  Users,
  Wand2,
  X,
} from "lucide-react";
import { Card } from "./ui";
import {
  APPLICATION_STATUSES,
  PATH_STATUSES,
  SOURCE_KINDS,
  daysSince,
  pathScore,
  sortPaths,
  type ApplicationStatus,
  type CareerPath,
  type JobApplication,
  type NetworkSource,
  type PathStatus,
  type Resume,
  type SourceKind,
} from "@/lib/career";
import {
  addCareerPath,
  addJobApplication,
  addNetworkSource,
  deleteCareerPath,
  deleteJobApplication,
  deleteNetworkSource,
  deleteResume,
  previewJobLink,
  searchJobs,
  updateCareerPath,
  updateJobApplication,
  updateNetworkSource,
  uploadResume,
  type ActionResult,
} from "@/lib/actions";
import type { JobHit, LinkPreview } from "@/lib/jobSearch";

// ── The Career page ──────────────────────────────────────────────────────────
// Three jobs on one screen, one tab each:
//   1. Which path — score every option the same three ways and let the list
//      sort itself, so the shortlist falls out of the numbers.
//   2. Applications — the resumes he keeps, and where each one has been sent.
//   3. People — who to talk to, and when he last did.

type TabKey = "paths" | "applications" | "people";

const TABS: { key: TabKey; label: string; Icon: typeof Compass }[] = [
  { key: "paths", label: "Which path", Icon: Compass },
  { key: "applications", label: "Applying", Icon: Briefcase },
  { key: "people", label: "People", Icon: Users },
];

const money = (n: number) => "$" + Math.round(n).toLocaleString("en-US");

const shortDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

const today = () => new Date().toISOString().split("T")[0];

// Where a path stands, in a colour Jamie can read without the word.
const STATUS_STYLE: Record<PathStatus, { bg: string; fg: string }> = {
  Exploring: { bg: "var(--tint)", fg: "var(--muted)" },
  Shortlist: { bg: "var(--good-bg)", fg: "var(--good)" },
  "Ruled out": { bg: "var(--tint)", fg: "var(--faint)" },
};

// A fit score means nothing on its own — this is what the number is saying.
function scoreWord(score: number): string {
  if (score >= 80) return "Really strong fit";
  if (score >= 60) return "Worth a proper look";
  if (score >= 40) return "Could work";
  return "Probably not it";
}

function scoreColor(score: number): string {
  if (score >= 80) return "var(--good)";
  if (score >= 60) return "var(--reg)";
  if (score >= 40) return "var(--warn)";
  return "var(--faint)";
}

export default function CareerClient({
  initialPaths,
  initialResumes,
  initialApplications,
  initialSources,
  searchOn,
}: {
  initialPaths: CareerPath[];
  initialResumes: Resume[];
  initialApplications: JobApplication[];
  initialSources: NetworkSource[];
  /** Whether the search keys are set in Vercel. */
  searchOn: boolean;
}) {
  const [tab, setTab] = useState<TabKey>("paths");
  const [paths, setPaths] = useState(initialPaths);
  const [resumes, setResumes] = useState(initialResumes);
  const [apps, setApps] = useState(initialApplications);
  const [sources, setSources] = useState(initialSources);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Every save goes through here: the screen updates first, and if the server
  // says no the change is put back the way it was and the reason is said out
  // loud. A save that quietly fails looks exactly like a broken button.
  function run(
    action: () => Promise<ActionResult>,
    { onFail, onDone }: { onFail?: () => void; onDone?: (res: ActionResult) => void } = {}
  ) {
    setError(null);
    startTransition(async () => {
      const res = await action();
      if (!res.ok) {
        onFail?.();
        setError(res.error ?? "That didn't save. Give it another go.");
        return;
      }
      onDone?.(res);
    });
  }

  return (
    <div className="space-y-4 pb-8">
      {/* ── The three jobs this page does ─────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-1.5">
        {TABS.map(({ key, label, Icon }) => {
          const on = tab === key;
          return (
            <button
              key={key}
              onClick={() => setTab(key)}
              className="flex flex-col items-center gap-1 rounded-2xl border px-2 py-2.5 transition-colors"
              style={{
                borderColor: on ? "transparent" : "var(--border)",
                background: on ? "var(--text)" : "var(--card)",
                color: on ? "var(--card)" : "var(--muted)",
              }}
            >
              <Icon size={17} />
              <span className="text-[12px] font-medium">{label}</span>
            </button>
          );
        })}
      </div>

      {error && (
        <div
          className="rounded-2xl px-4 py-3 text-[14px] leading-snug"
          style={{ background: "var(--warn-bg)", color: "var(--warn)" }}
        >
          {error}
        </div>
      )}

      {tab === "paths" && (
        <PathsTab paths={paths} setPaths={setPaths} run={run} />
      )}
      {tab === "applications" && (
        <ApplicationsTab
          apps={apps}
          setApps={setApps}
          resumes={resumes}
          setResumes={setResumes}
          paths={paths}
          run={run}
          setError={setError}
          searchOn={searchOn}
        />
      )}
      {tab === "people" && (
        <PeopleTab sources={sources} setSources={setSources} run={run} />
      )}
    </div>
  );
}

type Run = (
  action: () => Promise<ActionResult>,
  opts?: { onFail?: () => void; onDone?: (res: ActionResult) => void }
) => void;

// ── 1. Which path ────────────────────────────────────────────────────────────

function PathsTab({
  paths,
  setPaths,
  run,
}: {
  paths: CareerPath[];
  setPaths: React.Dispatch<React.SetStateAction<CareerPath[]>>;
  run: Run;
}) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({
    name: "",
    whatItIs: "",
    whatItTakes: "",
    payLow: "",
    payHigh: "",
  });
  const [openId, setOpenId] = useState<string | null>(null);

  // Ruled-out paths stay on file — he can change his mind — but they fold away
  // so the list on screen is only what's still in the running.
  const [showRuledOut, setShowRuledOut] = useState(false);
  const live = paths.filter((p) => p.status !== "Ruled out");
  const out = paths.filter((p) => p.status === "Ruled out");
  const top = live[0];

  function add() {
    const name = form.name.trim();
    if (!name) return;
    const payLow = form.payLow ? Number(form.payLow) : null;
    const payHigh = form.payHigh ? Number(form.payHigh) : null;
    const draft = { ...form, name, payLow, payHigh };
    run(
      () =>
        addCareerPath({
          name,
          whatItIs: draft.whatItIs,
          whatItTakes: draft.whatItTakes,
          payLow,
          payHigh,
        }),
      {
        onDone: (res) => {
          setPaths((prev) =>
            sortPaths([
              ...prev,
              {
                id: res.id!,
                name,
                whatItIs: draft.whatItIs.trim() || null,
                whatItTakes: draft.whatItTakes.trim() || null,
                payLow,
                payHigh,
                wantIt: 3,
                paysEnough: 3,
                easyToStart: 3,
                status: "Exploring",
                notes: null,
              },
            ])
          );
          setForm({ name: "", whatItIs: "", whatItTakes: "", payLow: "", payHigh: "" });
          setAdding(false);
        },
      }
    );
  }

  function patch(id: string, changes: Partial<CareerPath>) {
    const before = paths;
    setPaths((prev) =>
      sortPaths(prev.map((p) => (p.id === id ? { ...p, ...changes } : p)))
    );
    run(() => updateCareerPath({ id, ...changes }), {
      onFail: () => setPaths(before),
    });
  }

  function remove(id: string) {
    const before = paths;
    setPaths((prev) => prev.filter((p) => p.id !== id));
    run(() => deleteCareerPath(id), { onFail: () => setPaths(before) });
  }

  return (
    <div className="space-y-4">
      <p className="text-[14px] leading-snug text-muted">
        Put every idea in here, then answer the same three questions about each
        one. The best fit floats to the top on its own.
      </p>

      {/* The one-line answer, so the point of the page is on screen before any
          scrolling happens. */}
      {top && (
        <Card>
          <div className="text-[12px] font-medium text-muted">
            Leading right now
          </div>
          <div className="mt-0.5 text-[20px] font-semibold">{top.name}</div>
          <div className="mt-1 text-[13px]" style={{ color: scoreColor(pathScore(top)) }}>
            {pathScore(top)}% fit · {scoreWord(pathScore(top))}
          </div>
          {live.length > 1 && (
            <div className="mt-1 text-[13px] text-muted">
              Ahead of {live.length - 1} other{live.length - 1 === 1 ? "" : ""} option
              {live.length - 1 === 1 ? "" : "s"} you&apos;re still weighing up.
            </div>
          )}
        </Card>
      )}

      {live.length === 0 && (
        <Card>
          <p className="text-[14px] leading-snug text-muted">
            Nothing on the list yet. Add the first thing you&apos;ve thought
            about doing — even the half-formed one. Nothing here is a promise.
          </p>
        </Card>
      )}

      <div className="space-y-2.5">
        {live.map((p) => (
          <PathCard
            key={p.id}
            path={p}
            open={openId === p.id}
            onToggle={() => setOpenId(openId === p.id ? null : p.id)}
            onPatch={(changes) => patch(p.id, changes)}
            onDelete={() => remove(p.id)}
          />
        ))}
      </div>

      {/* ── Add one ───────────────────────────────────────────────────────── */}
      {adding ? (
        <Card className="space-y-2">
          <Field
            label="What's the path?"
            placeholder="e.g. Massage therapist"
            value={form.name}
            onChange={(v) => setForm({ ...form, name: v })}
            autoFocus
          />
          <Field
            label="What is it, in your words? (optional)"
            placeholder="What the day actually looks like"
            value={form.whatItIs}
            onChange={(v) => setForm({ ...form, whatItIs: v })}
            multiline
          />
          <Field
            label="What would it take to start? (optional)"
            placeholder="Course, licence, hours, gear…"
            value={form.whatItTakes}
            onChange={(v) => setForm({ ...form, whatItTakes: v })}
            multiline
          />
          <div className="grid grid-cols-2 gap-2">
            <Field
              label="Pay — low end a year"
              placeholder="40000"
              value={form.payLow}
              onChange={(v) => setForm({ ...form, payLow: v })}
              numeric
            />
            <Field
              label="Pay — good year"
              placeholder="80000"
              value={form.payHigh}
              onChange={(v) => setForm({ ...form, payHigh: v })}
              numeric
            />
          </div>
          <SaveCancel onSave={add} onCancel={() => setAdding(false)} saveLabel="Add it" />
        </Card>
      ) : (
        <AddButton label="Add a path you're thinking about" onClick={() => setAdding(true)} />
      )}

      {/* ── Ruled out ─────────────────────────────────────────────────────── */}
      {out.length > 0 && (
        <div>
          <button
            onClick={() => setShowRuledOut(!showRuledOut)}
            className="text-[13px] text-muted"
          >
            {showRuledOut ? "Hide" : "Show"} the {out.length} you&apos;ve ruled out
          </button>
          {showRuledOut && (
            <div className="mt-2.5 space-y-2.5">
              {out.map((p) => (
                <PathCard
                  key={p.id}
                  path={p}
                  open={openId === p.id}
                  onToggle={() => setOpenId(openId === p.id ? null : p.id)}
                  onPatch={(changes) => patch(p.id, changes)}
                  onDelete={() => remove(p.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PathCard({
  path,
  open,
  onToggle,
  onPatch,
  onDelete,
}: {
  path: CareerPath;
  open: boolean;
  onToggle: () => void;
  onPatch: (changes: Partial<CareerPath>) => void;
  onDelete: () => void;
}) {
  const score = pathScore(path);
  const color = scoreColor(score);
  const dimmed = path.status === "Ruled out";
  const [notes, setNotes] = useState(path.notes ?? "");

  return (
    <Card className={dimmed ? "opacity-60" : ""}>
      <button onClick={onToggle} className="w-full text-left">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-[16px] font-medium">{path.name}</div>
            {(path.payLow || path.payHigh) && (
              <div className="mt-0.5 text-[13px] text-muted">
                {path.payLow && path.payHigh
                  ? `${money(path.payLow)} – ${money(path.payHigh)} a year`
                  : `${money(path.payLow ?? path.payHigh ?? 0)} a year`}
              </div>
            )}
          </div>
          <div className="text-right">
            <div className="text-[22px] font-semibold leading-none" style={{ color }}>
              {score}%
            </div>
            <div className="mt-0.5 text-[11px] text-muted">fit</div>
          </div>
        </div>

        <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-tint">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${score}%`, background: color }}
          />
        </div>

        <div className="mt-2 flex items-center justify-between">
          <span
            className="rounded-full px-2.5 py-1 text-[12px] font-medium"
            style={{
              background: STATUS_STYLE[path.status].bg,
              color: STATUS_STYLE[path.status].fg,
            }}
          >
            {path.status}
          </span>
          <span className="text-[12px] text-muted">
            {open ? "Tap to close" : "Tap to score it"}
          </span>
        </div>
      </button>

      {open && (
        <div className="mt-4 space-y-4 border-t border-border pt-4">
          {path.whatItIs && (
            <p className="whitespace-pre-wrap text-[14px] leading-snug">{path.whatItIs}</p>
          )}
          {path.whatItTakes && (
            <div className="rounded-xl bg-tint p-3">
              <div className="text-[12px] font-medium text-muted">To get started</div>
              <p className="mt-1 whitespace-pre-wrap text-[14px] leading-snug">
                {path.whatItTakes}
              </p>
            </div>
          )}

          <Rating
            label="Do I actually want to do this?"
            low="Not really"
            high="Love it"
            value={path.wantIt}
            onChange={(v) => onPatch({ wantIt: v })}
          />
          <Rating
            label="Does the money work for my life?"
            low="Not close"
            high="Plenty"
            value={path.paysEnough}
            onChange={(v) => onPatch({ paysEnough: v })}
          />
          <Rating
            label="How easy is it to start?"
            low="Years away"
            high="Could start now"
            value={path.easyToStart}
            onChange={(v) => onPatch({ easyToStart: v })}
          />

          <div>
            <div className="mb-1.5 text-[13px] text-muted">Where it stands</div>
            <div className="flex flex-wrap gap-1.5">
              {PATH_STATUSES.map((s) => (
                <button
                  key={s}
                  onClick={() => onPatch({ status: s })}
                  className="rounded-full px-3 py-1.5 text-[13px] transition-colors"
                  style={
                    path.status === s
                      ? { background: "var(--text)", color: "var(--card)" }
                      : { border: "1px solid var(--border)", color: "var(--muted)" }
                  }
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-1.5 text-[13px] text-muted">Notes to yourself</div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => notes !== (path.notes ?? "") && onPatch({ notes })}
              rows={2}
              placeholder="Anything you want to remember about this one"
              className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-[15px]"
            />
          </div>

          <button
            onClick={onDelete}
            className="flex items-center gap-1.5 text-[13px] text-muted"
          >
            <Trash2 size={14} /> Take this off the list
          </button>
        </div>
      )}
    </Card>
  );
}

// Five taps instead of a slider: one tap is one save, and a thumb hits a
// button far more reliably than it drags a track on a phone.
function Rating({
  label,
  low,
  high,
  value,
  onChange,
}: {
  label: string;
  low: string;
  high: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="mb-1.5 text-[14px]">{label}</div>
      <div className="flex gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            onClick={() => onChange(n)}
            aria-label={`${label} — ${n} out of 5`}
            className="h-10 flex-1 rounded-xl text-[14px] font-medium transition-colors"
            style={
              n <= value
                ? { background: "var(--good)", color: "#fff" }
                : { background: "var(--tint)", color: "var(--faint)" }
            }
          >
            {n}
          </button>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-faint">
        <span>{low}</span>
        <span>{high}</span>
      </div>
    </div>
  );
}

// ── 2. Applications and resumes ──────────────────────────────────────────────

function ApplicationsTab({
  apps,
  setApps,
  resumes,
  setResumes,
  paths,
  run,
  setError,
  searchOn,
}: {
  apps: JobApplication[];
  setApps: React.Dispatch<React.SetStateAction<JobApplication[]>>;
  resumes: Resume[];
  setResumes: React.Dispatch<React.SetStateAction<Resume[]>>;
  paths: CareerPath[];
  run: Run;
  setError: (m: string | null) => void;
  searchOn: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({
    companyName: "",
    roleTitle: "",
    salary: "",
    link: "",
    appliedOn: "",
    resumeId: "",
    pathId: "",
    notes: "",
  });

  const counts = useMemo(() => {
    const map = new Map<ApplicationStatus, number>();
    for (const s of APPLICATION_STATUSES) map.set(s, 0);
    for (const a of apps) map.set(a.status, (map.get(a.status) ?? 0) + 1);
    return map;
  }, [apps]);

  const resumeName = (id: string | null) =>
    id ? resumes.find((r) => r.id === id)?.label ?? null : null;
  const pathName = (id: string | null) =>
    id ? paths.find((p) => p.id === id)?.name ?? null : null;

  function add() {
    const companyName = form.companyName.trim();
    const roleTitle = form.roleTitle.trim();
    if (!companyName || !roleTitle) {
      setError("Needs at least a company and a job title.");
      return;
    }
    const draft = { ...form, companyName, roleTitle };
    run(
      () =>
        addJobApplication({
          companyName,
          roleTitle,
          salary: draft.salary,
          link: draft.link,
          appliedOn: draft.appliedOn || null,
          resumeId: draft.resumeId || null,
          pathId: draft.pathId || null,
          notes: draft.notes,
          status: draft.appliedOn ? "Applied" : "Interested",
        }),
      {
        onDone: (res) => {
          setApps((prev) => [
            {
              id: res.id!,
              companyName,
              roleTitle,
              salary: draft.salary.trim() || null,
              link: draft.link.trim() || null,
              status: draft.appliedOn ? "Applied" : "Interested",
              notes: draft.notes.trim() || null,
              appliedOn: draft.appliedOn || null,
              resumeId: draft.resumeId || null,
              pathId: draft.pathId || null,
              createdAt: new Date().toISOString(),
            },
            ...prev,
          ]);
          setForm({
            companyName: "",
            roleTitle: "",
            salary: "",
            link: "",
            appliedOn: "",
            resumeId: "",
            pathId: "",
            notes: "",
          });
          setAdding(false);
        },
      }
    );
  }

  function patch(id: string, changes: Partial<JobApplication>) {
    const before = apps;
    setApps((prev) => prev.map((a) => (a.id === id ? { ...a, ...changes } : a)));
    run(() => updateJobApplication({ id, ...changes }), {
      onFail: () => setApps(before),
    });
  }

  function remove(id: string) {
    const before = apps;
    setApps((prev) => prev.filter((a) => a.id !== id));
    run(() => deleteJobApplication(id), { onFail: () => setApps(before) });
  }

  // Saving straight off a search result. Everything the feed knows goes in;
  // the rest he fills in later on the card.
  function saveHit(hit: JobHit) {
    run(
      () =>
        addJobApplication({
          companyName: hit.company || hit.source,
          roleTitle: hit.title,
          salary: hit.salary ?? undefined,
          link: hit.url,
          notes: hit.location ? `Where: ${hit.location}` : undefined,
          status: "Interested",
        }),
      {
        onDone: (res) => {
          setApps((prev) => [
            {
              id: res.id!,
              companyName: hit.company || hit.source,
              roleTitle: hit.title,
              salary: hit.salary,
              link: hit.url,
              status: "Interested",
              notes: hit.location ? `Where: ${hit.location}` : null,
              appliedOn: null,
              resumeId: null,
              pathId: null,
              createdAt: new Date().toISOString(),
            },
            ...prev,
          ]);
        },
      }
    );
  }

  // So a result he's already saved says so instead of quietly going in twice.
  const savedLinks = useMemo(
    () => new Set(apps.map((a) => a.link).filter(Boolean) as string[]),
    [apps]
  );

  return (
    <div className="space-y-4">
      <JobFinder
        searchOn={searchOn}
        savedLinks={savedLinks}
        onSave={saveHit}
        setError={setError}
      />

      {/* ── Where things stand ────────────────────────────────────────────── */}
      {apps.length > 0 && (
        <Card>
          <div className="mb-2.5 text-[13px] text-muted">Where things stand</div>
          <div className="grid grid-cols-4 gap-2 text-center">
            {(["Applied", "Interview", "Offer", "Rejected"] as ApplicationStatus[]).map(
              (s) => (
                <div key={s} className="rounded-xl bg-tint py-2">
                  <div className="text-[18px] font-semibold leading-none">
                    {counts.get(s) ?? 0}
                  </div>
                  <div className="mt-1 text-[11px] text-muted">{s}</div>
                </div>
              )
            )}
          </div>
        </Card>
      )}

      <div>
        <h2 className="mb-2 text-[15px] font-medium">Jobs I&apos;m going for</h2>
        {apps.length === 0 ? (
          <Card>
            <p className="text-[14px] leading-snug text-muted">
              No jobs on the list yet. Add one the moment you spot it — even
              before you apply — so nothing gets forgotten.
            </p>
          </Card>
        ) : (
          <div className="space-y-2.5">
            {apps.map((a) => (
              <Card key={a.id}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-[16px] font-medium">{a.companyName}</div>
                    <div className="text-[13px] text-muted">
                      {a.roleTitle}
                      {a.salary ? ` · ${a.salary}` : ""}
                    </div>
                  </div>
                  <button
                    onClick={() => remove(a.id)}
                    aria-label={`Remove ${a.companyName}`}
                    className="p-1 text-muted"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>

                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {APPLICATION_STATUSES.map((s) => (
                    <button
                      key={s}
                      onClick={() =>
                        patch(a.id, {
                          status: s,
                          // Moving it to "Applied" without a date on file
                          // stamps today — otherwise the date is a guess later.
                          ...(s === "Applied" && !a.appliedOn
                            ? { appliedOn: today() }
                            : {}),
                        })
                      }
                      className="rounded-full px-2.5 py-1 text-[12px] transition-colors"
                      style={
                        a.status === s
                          ? { background: "var(--good)", color: "#fff" }
                          : { border: "1px solid var(--border)", color: "var(--muted)" }
                      }
                    >
                      {s}
                    </button>
                  ))}
                </div>

                <div className="mt-2.5 space-y-1 text-[13px] text-muted">
                  {a.appliedOn && <div>Sent {shortDate(a.appliedOn)}</div>}
                  {resumeName(a.resumeId) && (
                    <div>Resume used: {resumeName(a.resumeId)}</div>
                  )}
                  {pathName(a.pathId) && <div>Path: {pathName(a.pathId)}</div>}
                  {a.notes && (
                    <p className="whitespace-pre-wrap text-text">{a.notes}</p>
                  )}
                </div>

                {a.link && (
                  <a
                    href={a.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-[13px] text-good"
                  >
                    Open the posting <ExternalLink size={13} />
                  </a>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>

      {adding ? (
        <Card className="space-y-2">
          <LinkPaste
            setError={setError}
            onRead={(preview) =>
              setForm((f) => ({
                ...f,
                // Only fill what's still blank, so a re-read can't wipe
                // something he already typed himself.
                companyName: f.companyName || preview.companyName || "",
                roleTitle: f.roleTitle || preview.roleTitle || "",
                salary: f.salary || preview.salary || "",
                link: preview.url,
                notes:
                  f.notes ||
                  (preview.location ? `Where: ${preview.location}` : ""),
              }))
            }
          />
          <Field
            label="Company"
            placeholder="Who's hiring"
            value={form.companyName}
            onChange={(v) => setForm({ ...form, companyName: v })}
          />
          <Field
            label="Job title"
            placeholder="What the role is called"
            value={form.roleTitle}
            onChange={(v) => setForm({ ...form, roleTitle: v })}
          />
          <div className="grid grid-cols-2 gap-2">
            <Field
              label="Pay (optional)"
              placeholder="$25/hr"
              value={form.salary}
              onChange={(v) => setForm({ ...form, salary: v })}
            />
            <Field
              label="Date sent (optional)"
              value={form.appliedOn}
              onChange={(v) => setForm({ ...form, appliedOn: v })}
              type="date"
            />
          </div>
          <Field
            label="Link to the posting (optional)"
            placeholder="https://…"
            value={form.link}
            onChange={(v) => setForm({ ...form, link: v })}
          />
          <Picker
            label="Which resume did you send?"
            value={form.resumeId}
            onChange={(v) => setForm({ ...form, resumeId: v })}
            empty="Not sure yet"
            options={resumes.map((r) => ({ value: r.id, label: r.label }))}
          />
          <Picker
            label="Which path is this?"
            value={form.pathId}
            onChange={(v) => setForm({ ...form, pathId: v })}
            empty="Not tied to one"
            options={paths.map((p) => ({ value: p.id, label: p.name }))}
          />
          <Field
            label="Notes (optional)"
            placeholder="Who you spoke to, what they said…"
            value={form.notes}
            onChange={(v) => setForm({ ...form, notes: v })}
            multiline
          />
          <SaveCancel onSave={add} onCancel={() => setAdding(false)} saveLabel="Add the job" />
        </Card>
      ) : (
        <AddButton label="Add a job" onClick={() => setAdding(true)} />
      )}

      <ResumeShelf
        resumes={resumes}
        setResumes={setResumes}
        run={run}
        setError={setError}
      />
    </div>
  );
}

// ── Find jobs ────────────────────────────────────────────────────────────────
// Searches the free aggregators. They carry listings syndicated from a lot of
// boards, which is as close to searching Indeed from in here as anyone can get:
// Indeed's own API closed to new builders in 2024 and LinkedIn's has been
// partner-only since 2015.

function JobFinder({
  searchOn,
  savedLinks,
  onSave,
  setError,
}: {
  searchOn: boolean;
  savedLinks: Set<string>;
  onSave: (hit: JobHit) => void;
  setError: (m: string | null) => void;
}) {
  const [what, setWhat] = useState("");
  const [where, setWhere] = useState("");
  const [hits, setHits] = useState<JobHit[] | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const [busy, startSearch] = useTransition();

  function go() {
    setError(null);
    startSearch(async () => {
      const res = await searchJobs({ what, where });
      if (!res.ok) {
        setHits(null);
        setNotes([]);
        setError(res.error ?? "The search didn't come back.");
        return;
      }
      setHits(res.hits ?? []);
      setNotes(res.problems ?? []);
    });
  }

  if (!searchOn) {
    return (
      <Card>
        <div className="text-[15px] font-medium">🔍 Find jobs</div>
        <p className="mt-1 text-[14px] leading-snug text-muted">
          Searching isn&apos;t switched on yet — Chris needs to add the search
          keys. You can still add jobs by hand below, or paste a link and let
          the app fill it in.
        </p>
      </Card>
    );
  }

  return (
    <Card className="space-y-2.5">
      <div className="text-[15px] font-medium">🔍 Find jobs</div>
      <div className="grid grid-cols-2 gap-2">
        <input
          value={what}
          onChange={(e) => setWhat(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && go()}
          placeholder="What kind of work?"
          className="w-full rounded-xl border border-border bg-bg px-3 py-2.5 text-[16px]"
        />
        <input
          value={where}
          onChange={(e) => setWhere(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && go()}
          placeholder="Where?"
          className="w-full rounded-xl border border-border bg-bg px-3 py-2.5 text-[16px]"
        />
      </div>
      <button
        onClick={go}
        disabled={busy}
        className="flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-[15px] font-medium text-white disabled:opacity-60"
        style={{ background: "var(--good)" }}
      >
        <Search size={15} /> {busy ? "Looking…" : "Search"}
      </button>

      {notes.map((n) => (
        <p key={n} className="text-[12px]" style={{ color: "var(--warn)" }}>
          {n}
        </p>
      ))}

      {hits !== null && hits.length === 0 && (
        <p className="text-[14px] text-muted">
          Nothing came back for that. Try fewer words, or a bigger area.
        </p>
      )}

      {hits !== null && hits.length > 0 && (
        <div className="space-y-2.5 pt-1">
          <p className="text-[12px] text-muted">
            {hits.length} found · tap Save to add one to your list
          </p>
          {hits.map((hit) => {
            const already = savedLinks.has(hit.url);
            return (
              <div key={hit.externalId} className="rounded-xl border border-border p-3">
                <div className="text-[15px] font-medium leading-snug">
                  {hit.title}
                </div>
                <div className="mt-0.5 text-[13px] text-muted">
                  {[hit.company, hit.location].filter(Boolean).join(" · ") ||
                    hit.source}
                </div>
                {hit.salary && (
                  <div className="mt-0.5 text-[13px]" style={{ color: "var(--good)" }}>
                    {hit.salary}
                  </div>
                )}
                {hit.snippet && (
                  <p className="mt-1.5 text-[13px] leading-snug text-muted">
                    {hit.snippet}
                  </p>
                )}
                <div className="mt-2.5 flex items-center gap-2">
                  <button
                    onClick={() => onSave(hit)}
                    disabled={already}
                    className="rounded-full px-3 py-1.5 text-[13px] font-medium disabled:opacity-60"
                    style={
                      already
                        ? { background: "var(--tint)", color: "var(--muted)" }
                        : { background: "var(--good)", color: "#fff" }
                    }
                  >
                    {already ? "Already saved" : "Save it"}
                  </button>
                  <a
                    href={hit.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[13px] text-muted"
                  >
                    Open <ExternalLink size={13} />
                  </a>
                  <span className="ml-auto text-[11px] text-faint">
                    via {hit.source}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

// ── Paste a link, let the app fill the form in ───────────────────────────────
// Reads the job page's own listing data — the same thing Google reads to build
// its job results — so most boards and company career pages fill themselves in.

function LinkPaste({
  onRead,
  setError,
}: {
  onRead: (preview: LinkPreview) => void;
  setError: (m: string | null) => void;
}) {
  const [url, setUrl] = useState("");
  const [done, setDone] = useState(false);
  const [busy, startRead] = useTransition();

  function read() {
    if (!url.trim()) {
      setError("Paste a link first.");
      return;
    }
    setError(null);
    setDone(false);
    startRead(async () => {
      const res = await previewJobLink(url);
      if (!res.ok || !res.preview) {
        setError(res.error ?? "Couldn't read that page.");
        return;
      }
      onRead(res.preview);
      setDone(true);
    });
  }

  return (
    <div className="rounded-xl bg-tint p-3">
      <div className="mb-1.5 text-[13px] font-medium">
        Got a link? Paste it and skip the typing
      </div>
      <input
        value={url}
        onChange={(e) => {
          setUrl(e.target.value);
          setDone(false);
        }}
        onKeyDown={(e) => e.key === "Enter" && read()}
        placeholder="https://…"
        autoFocus
        className="w-full rounded-lg border border-border bg-card px-3 py-2 text-[16px]"
      />
      <button
        onClick={read}
        disabled={busy}
        className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-card py-2 text-[14px] disabled:opacity-60"
      >
        <Wand2 size={14} /> {busy ? "Reading the page…" : "Fill it in for me"}
      </button>
      {done && (
        <p className="mt-1.5 text-[12px]" style={{ color: "var(--good)" }}>
          Filled in below — check it over before saving.
        </p>
      )}
    </div>
  );
}

function ResumeShelf({
  resumes,
  setResumes,
  run,
  setError,
}: {
  resumes: Resume[];
  setResumes: React.Dispatch<React.SetStateAction<Resume[]>>;
  run: Run;
  setError: (m: string | null) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState("");
  const [aimedAt, setAimedAt] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  function upload() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Pick a file first.");
      return;
    }
    if (!label.trim()) {
      setError("Give this resume a name so you can tell them apart.");
      return;
    }
    const data = new FormData();
    data.set("file", file);
    data.set("label", label.trim());
    data.set("aimedAt", aimedAt.trim());
    const snapshot = { label: label.trim(), aimedAt: aimedAt.trim(), fileName: file.name };
    run(() => uploadResume(data), {
      onDone: (res) => {
        setResumes((prev) => [
          {
            id: res.id!,
            label: snapshot.label,
            aimedAt: snapshot.aimedAt || null,
            fileName: snapshot.fileName,
            uploadedAt: new Date().toISOString(),
            // The download link is signed on the server. This one hasn't been
            // through a page load yet, so there's nothing to link to until it
            // has — the card says so rather than handing over a dead link.
            url: null,
          },
          ...prev,
        ]);
        setLabel("");
        setAimedAt("");
        if (fileRef.current) fileRef.current.value = "";
        setAdding(false);
      },
    });
  }

  function remove(id: string) {
    const before = resumes;
    setResumes((prev) => prev.filter((r) => r.id !== id));
    run(() => deleteResume(id), { onFail: () => setResumes(before) });
  }

  return (
    <div>
      <h2 className="mb-2 text-[15px] font-medium">My resumes</h2>

      {resumes.length === 0 ? (
        <Card>
          <p className="text-[14px] leading-snug text-muted">
            No resumes saved yet. Keep one per kind of job — a version written
            for the work always beats one general copy.
          </p>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {resumes.map((r) => (
            <Card key={r.id}>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 text-muted">
                  <FileText size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-medium">{r.label}</div>
                  {r.aimedAt && (
                    <div className="text-[13px] text-muted">For: {r.aimedAt}</div>
                  )}
                  <div className="truncate text-[12px] text-faint">{r.fileName}</div>
                  {r.url ? (
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1.5 inline-flex items-center gap-1 text-[13px] text-good"
                    >
                      Open it <ExternalLink size={13} />
                    </a>
                  ) : (
                    <div className="mt-1.5 text-[12px] text-faint">
                      Saved — reload the page to open it.
                    </div>
                  )}
                </div>
                <button
                  onClick={() => remove(r.id)}
                  aria-label={`Delete ${r.label}`}
                  className="p-1 text-muted"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <div className="mt-2.5">
        {adding ? (
          <Card className="space-y-2">
            <Field
              label="Name this version"
              placeholder="e.g. Massage roles — 2026"
              value={label}
              onChange={setLabel}
              autoFocus
            />
            <Field
              label="What kind of job is it written for? (optional)"
              placeholder="e.g. Spa and clinic work"
              value={aimedAt}
              onChange={setAimedAt}
            />
            <div>
              <div className="mb-1.5 text-[13px] text-muted">
                The file — PDF or Word, up to 5 MB
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="w-full rounded-xl border border-border bg-bg px-3 py-2.5 text-[14px] file:mr-3 file:rounded-lg file:border-0 file:bg-tint file:px-3 file:py-1.5 file:text-[13px]"
              />
            </div>
            <SaveCancel onSave={upload} onCancel={() => setAdding(false)} saveLabel="Save it" />
          </Card>
        ) : (
          <AddButton
            label="Add a resume"
            icon={<Upload size={15} />}
            onClick={() => setAdding(true)}
          />
        )}
      </div>
    </div>
  );
}

// ── 3. People and places ─────────────────────────────────────────────────────

function PeopleTab({
  sources,
  setSources,
  run,
}: {
  sources: NetworkSource[];
  setSources: React.Dispatch<React.SetStateAction<NetworkSource[]>>;
  run: Run;
}) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({
    name: "",
    kind: "Person" as SourceKind,
    company: "",
    howToReach: "",
    link: "",
    lastContact: "",
    nextStep: "",
    notes: "",
  });

  // Anyone he hasn't spoken to in a month gets called out at the top. A list of
  // contacts nobody follows up with isn't networking, it's a phone book.
  const stale = sources.filter((s) => {
    const d = daysSince(s.lastContact);
    return d === null || d >= 30;
  });

  function add() {
    const name = form.name.trim();
    if (!name) return;
    const draft = { ...form, name };
    run(
      () =>
        addNetworkSource({
          name,
          kind: draft.kind,
          company: draft.company,
          howToReach: draft.howToReach,
          link: draft.link,
          lastContact: draft.lastContact || null,
          nextStep: draft.nextStep,
          notes: draft.notes,
        }),
      {
        onDone: (res) => {
          setSources((prev) => [
            {
              id: res.id!,
              name,
              kind: draft.kind,
              company: draft.company.trim() || null,
              howToReach: draft.howToReach.trim() || null,
              link: draft.link.trim() || null,
              lastContact: draft.lastContact || null,
              nextStep: draft.nextStep.trim() || null,
              notes: draft.notes.trim() || null,
            },
            ...prev,
          ]);
          setForm({
            name: "",
            kind: "Person",
            company: "",
            howToReach: "",
            link: "",
            lastContact: "",
            nextStep: "",
            notes: "",
          });
          setAdding(false);
        },
      }
    );
  }

  function patch(id: string, changes: Partial<NetworkSource>) {
    const before = sources;
    setSources((prev) => prev.map((s) => (s.id === id ? { ...s, ...changes } : s)));
    run(() => updateNetworkSource({ id, ...changes }), {
      onFail: () => setSources(before),
    });
  }

  function remove(id: string) {
    const before = sources;
    setSources((prev) => prev.filter((s) => s.id !== id));
    run(() => deleteNetworkSource(id), { onFail: () => setSources(before) });
  }

  return (
    <div className="space-y-4">
      <p className="text-[14px] leading-snug text-muted">
        Most jobs come from someone you already know. Keep the names here, and
        keep the conversations warm.
      </p>

      {sources.length > 0 && stale.length > 0 && (
        <Card>
          <div className="text-[13px]" style={{ color: "var(--warn)" }}>
            {stale.length === 1
              ? "1 person you haven't spoken to in a while."
              : `${stale.length} people you haven't spoken to in a while.`}{" "}
            A short message is enough.
          </div>
        </Card>
      )}

      {sources.length === 0 ? (
        <Card>
          <p className="text-[14px] leading-snug text-muted">
            Nobody on the list yet. Start with the easy ones — old bosses,
            clients, the friend who always knows somebody.
          </p>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {sources.map((s) => {
            const d = daysSince(s.lastContact);
            return (
              <Card key={s.id}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-[16px] font-medium">{s.name}</div>
                    <div className="text-[13px] text-muted">
                      {s.kind}
                      {s.company ? ` · ${s.company}` : ""}
                    </div>
                  </div>
                  <button
                    onClick={() => remove(s.id)}
                    aria-label={`Remove ${s.name}`}
                    className="p-1 text-muted"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>

                <div className="mt-2 space-y-1 text-[13px]">
                  {s.howToReach && <div className="text-muted">{s.howToReach}</div>}
                  {s.nextStep && (
                    <div>
                      <span className="text-muted">Next: </span>
                      {s.nextStep}
                    </div>
                  )}
                  {s.notes && (
                    <p className="whitespace-pre-wrap text-muted">{s.notes}</p>
                  )}
                </div>

                <div className="mt-2.5 flex items-center justify-between gap-2">
                  <span
                    className="text-[12px]"
                    style={{ color: d === null || d >= 30 ? "var(--warn)" : "var(--muted)" }}
                  >
                    {d === null
                      ? "Not spoken to yet"
                      : d === 0
                        ? "Spoke to them today"
                        : d === 1
                          ? "Spoke to them yesterday"
                          : `${d} days since you spoke`}
                  </span>
                  <button
                    onClick={() => patch(s.id, { lastContact: today() })}
                    className="rounded-full border border-border px-3 py-1.5 text-[12px]"
                  >
                    Spoke today
                  </button>
                </div>

                {s.link && (
                  <a
                    href={s.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-[13px] text-good"
                  >
                    Open <ExternalLink size={13} />
                  </a>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {adding ? (
        <Card className="space-y-2">
          <Field
            label="Name"
            placeholder="Who or what is it"
            value={form.name}
            onChange={(v) => setForm({ ...form, name: v })}
            autoFocus
          />
          <Picker
            label="What kind?"
            value={form.kind}
            onChange={(v) => setForm({ ...form, kind: (v || "Person") as SourceKind })}
            options={SOURCE_KINDS.map((k) => ({ value: k, label: k }))}
          />
          <Field
            label="Where they work (optional)"
            value={form.company}
            onChange={(v) => setForm({ ...form, company: v })}
          />
          <Field
            label="How to reach them (optional)"
            placeholder="Phone, email, or where you message them"
            value={form.howToReach}
            onChange={(v) => setForm({ ...form, howToReach: v })}
          />
          <Field
            label="Link (optional)"
            placeholder="https://…"
            value={form.link}
            onChange={(v) => setForm({ ...form, link: v })}
          />
          <Field
            label="Last time you spoke (optional)"
            value={form.lastContact}
            onChange={(v) => setForm({ ...form, lastContact: v })}
            type="date"
          />
          <Field
            label="What's the next step? (optional)"
            placeholder="Ring them back, send the resume…"
            value={form.nextStep}
            onChange={(v) => setForm({ ...form, nextStep: v })}
          />
          <Field
            label="Notes (optional)"
            value={form.notes}
            onChange={(v) => setForm({ ...form, notes: v })}
            multiline
          />
          <SaveCancel onSave={add} onCancel={() => setAdding(false)} saveLabel="Add them" />
        </Card>
      ) : (
        <AddButton label="Add someone worth knowing" onClick={() => setAdding(true)} />
      )}
    </div>
  );
}

// ── Small shared pieces ──────────────────────────────────────────────────────

function Field({
  label,
  value,
  onChange,
  placeholder,
  multiline,
  numeric,
  type = "text",
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  numeric?: boolean;
  type?: string;
  autoFocus?: boolean;
}) {
  const shared =
    "w-full rounded-xl border border-border bg-bg px-3 py-2.5 text-[16px]";
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] text-muted">{label}</span>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={2}
          autoFocus={autoFocus}
          className={shared}
        />
      ) : (
        <input
          type={numeric ? "number" : type}
          inputMode={numeric ? "decimal" : undefined}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className={shared}
        />
      )}
    </label>
  );
}

function Picker({
  label,
  value,
  onChange,
  options,
  empty,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  empty?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] text-muted">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-border bg-bg px-3 py-2.5 text-[16px]"
      >
        {empty !== undefined && <option value="">{empty}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function AddButton({
  label,
  onClick,
  icon,
}: {
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-border py-3 text-[14px] text-muted"
    >
      {icon ?? <Plus size={15} />} {label}
    </button>
  );
}

function SaveCancel({
  onSave,
  onCancel,
  saveLabel,
}: {
  onSave: () => void;
  onCancel: () => void;
  saveLabel: string;
}) {
  return (
    <div className="flex gap-2 pt-1">
      <button
        onClick={onSave}
        className="flex-1 rounded-xl py-2.5 text-[15px] font-medium text-white"
        style={{ background: "var(--good)" }}
      >
        {saveLabel}
      </button>
      <button
        onClick={onCancel}
        className="flex items-center justify-center rounded-xl border border-border px-4 py-2.5 text-[15px] text-muted"
        aria-label="Cancel"
      >
        <X size={16} />
      </button>
    </div>
  );
}
