"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronRight,
  ExternalLink,
  Info,
  ListChecks,
  Mail,
  NotebookPen,
  Pencil,
  Phone,
  Plus,
  Trash2,
  Users,
  Wallet,
} from "lucide-react";
import { Bar, Card, Tint } from "./ui";
import { EmojiPicker } from "./ProjectsClient";
import { STATUS_STYLE, dueWord, money, shortDate } from "./projectBits";
import {
  PROJECT_STATUSES,
  cleanUrl,
  moneyTotals,
  newId,
  stepProgress,
  type MoneyKind,
  type Project,
  type ProjectPerson,
} from "@/lib/projects";
import { deleteProject, saveProject } from "@/lib/actions";

// ── One project ──────────────────────────────────────────────────────────────
// The top card is always there: where it stands, the goal, the next step, the
// deadline. Underneath, one tab for each kind of thing worth writing down:
//   Steps   — the to-do list, ticked off as he goes
//   Updates — a dated diary of what happened and who said what
//   People  — the lawyer, the landlord, the caseworker, with a tap-to-call
//   Money   — what it's cost and what's coming back
//   Info    — case numbers and the like, links, and free notes
//
// Every change saves on its own, straight away — there's no Save button to
// forget. The screen changes first; if the server says no, the change stays on
// screen with a "Try again" so nothing typed is lost.

type TabKey = "steps" | "updates" | "people" | "money" | "info";

const TABS: { key: TabKey; label: string; Icon: typeof ListChecks }[] = [
  { key: "steps", label: "Steps", Icon: ListChecks },
  { key: "updates", label: "Updates", Icon: NotebookPen },
  { key: "people", label: "People", Icon: Users },
  { key: "money", label: "Money", Icon: Wallet },
  { key: "info", label: "Info", Icon: Info },
];

const INPUT = "w-full rounded-xl border border-border bg-bg px-3 py-2.5 text-[16px]";
const GREEN_BUTTON =
  "rounded-xl px-4 py-2.5 text-[15px] font-medium text-white disabled:opacity-50";
const PLAIN_BUTTON = "rounded-xl border border-border px-4 py-2.5 text-[15px]";

type Change = (patch: Partial<Project>) => void;

export default function ProjectClient({
  initial,
  pages,
  today,
}: {
  initial: Project;
  /** The app pages Jamie can open, for the "goes with" link. */
  pages: { href: string; label: string }[];
  today: string;
}) {
  const [project, setProject] = useState(initial);
  const [tab, setTab] = useState<TabKey>("steps");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  // One save in flight at a time. Anything changed while it's out goes in the
  // next one, which always carries the whole latest project — so a quick run of
  // ticks can't land out of order and undo each other.
  const latest = useRef(project);
  const inFlight = useRef(false);
  const dirty = useRef(false);

  async function flush() {
    if (inFlight.current) {
      dirty.current = true;
      return;
    }
    inFlight.current = true;
    setSaveState("saving");
    setError(null);
    let res;
    do {
      dirty.current = false;
      res = await saveProject(latest.current);
    } while (res.ok && dirty.current);
    inFlight.current = false;
    if (res.ok) {
      setSaveState("saved");
    } else {
      setSaveState("error");
      setError(res.error ?? "That didn't save.");
    }
  }

  const change: Change = (patch) => {
    const next = { ...latest.current, ...patch };
    latest.current = next;
    setProject(next);
    void flush();
  };

  const counts: Record<TabKey, string> = {
    steps: project.steps.length
      ? `${stepProgress(project).done}/${project.steps.length}`
      : "",
    updates: project.updates.length ? String(project.updates.length) : "",
    people: project.people.length ? String(project.people.length) : "",
    money: project.money.length ? String(project.money.length) : "",
    info: String(project.details.length + project.links.length || ""),
  };

  return (
    <div className="space-y-4 pb-8">
      <Summary project={project} pages={pages} today={today} change={change} />

      {saveState === "error" ? (
        <div
          className="flex items-center justify-between gap-3 rounded-2xl px-4 py-3 text-[14px] leading-snug"
          style={{ background: "var(--warn-bg)", color: "var(--warn)" }}
        >
          <span>{error}</span>
          <button onClick={() => void flush()} className="shrink-0 font-medium underline">
            Try again
          </button>
        </div>
      ) : (
        <div className="h-4 text-right text-[12px] text-faint">
          {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved ✓" : ""}
        </div>
      )}

      <div className="grid grid-cols-5 gap-1.5">
        {TABS.map(({ key, label, Icon }) => {
          const on = tab === key;
          return (
            <button
              key={key}
              onClick={() => setTab(key)}
              className="flex flex-col items-center gap-0.5 rounded-2xl border px-1 py-2 transition-colors"
              style={{
                borderColor: on ? "transparent" : "var(--border)",
                background: on ? "var(--text)" : "var(--card)",
                color: on ? "var(--card)" : "var(--muted)",
              }}
            >
              <Icon size={17} />
              <span className="text-[12px] font-medium">{label}</span>
              <span className="h-3.5 text-[11px] leading-none opacity-70">{counts[key]}</span>
            </button>
          );
        })}
      </div>

      {tab === "steps" && <StepsTab project={project} today={today} change={change} />}
      {tab === "updates" && <UpdatesTab project={project} today={today} change={change} />}
      {tab === "people" && <PeopleTab project={project} change={change} />}
      {tab === "money" && <MoneyTab project={project} today={today} change={change} />}
      {tab === "info" && <InfoTab project={project} change={change} />}
    </div>
  );
}

// ── The top card ─────────────────────────────────────────────────────────────

function Summary({
  project: p,
  pages,
  today,
  change,
}: {
  project: Project;
  pages: { href: string; label: string }[];
  today: string;
  change: Change;
}) {
  const [editing, setEditing] = useState(false);
  const page = p.pageHref ? pages.find((x) => x.href === p.pageHref) : undefined;
  const due = p.deadline ? dueWord(p.deadline, today) : null;

  if (editing) {
    return <EditSummary project={p} pages={pages} change={change} onClose={() => setEditing(false)} />;
  }

  return (
    <Card>
      <div className="flex items-start gap-3">
        <div className="text-[34px] leading-none">{p.emoji}</div>
        <h1 className="min-w-0 flex-1 text-xl font-medium leading-snug">{p.name}</h1>
        <button
          onClick={() => setEditing(true)}
          className="flex shrink-0 items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-[13px] text-muted"
        >
          <Pencil size={13} />
          Edit
        </button>
      </div>

      {/* Where it stands — one tap, no Edit needed. */}
      <div className="mt-4 grid grid-cols-2 gap-1.5">
        {PROJECT_STATUSES.map((s) => {
          const on = p.status === s;
          return (
            <button
              key={s}
              onClick={() => change({ status: s })}
              className="rounded-xl border px-2 py-2 text-[13px] font-medium"
              style={{
                borderColor: on ? STATUS_STYLE[s].fg : "var(--border)",
                background: on ? STATUS_STYLE[s].bg : "var(--card)",
                color: on ? STATUS_STYLE[s].fg : "var(--muted)",
              }}
            >
              {on && "✓ "}
              {s}
            </button>
          );
        })}
      </div>

      <Tint className="mt-4">
        <div className="text-[12px] font-medium text-muted">👉 NEXT STEP</div>
        <div className="mt-0.5 text-[15px] leading-snug">
          {p.nextStep || (
            <button onClick={() => setEditing(true)} className="text-faint underline">
              Write down the next thing to do
            </button>
          )}
        </div>
      </Tint>

      {(p.goal || p.deadline) && (
        <div className="mt-3 space-y-1.5 text-[14px] leading-snug">
          {p.goal && (
            <div>
              <span className="text-muted">The goal: </span>
              {p.goal}
            </div>
          )}
          {p.deadline && due && (
            <div>
              <span className="text-muted">Deadline: </span>
              {shortDate(p.deadline, today)}{" "}
              <span
                style={{
                  color: due.late ? "var(--neg)" : due.soon ? "var(--warn)" : "var(--muted)",
                }}
              >
                ({due.text})
              </span>
            </div>
          )}
        </div>
      )}

      {page && (
        <Link
          href={page.href}
          className="mt-3 flex items-center justify-between rounded-xl border border-border px-3 py-2.5 text-[14px]"
        >
          <span>Open the {page.label} page</span>
          <ChevronRight size={16} className="text-muted" />
        </Link>
      )}
    </Card>
  );
}

function EditSummary({
  project: p,
  pages,
  change,
  onClose,
}: {
  project: Project;
  pages: { href: string; label: string }[];
  change: Change;
  onClose: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(p.name);
  const [emoji, setEmoji] = useState(p.emoji);
  const [goal, setGoal] = useState(p.goal);
  const [nextStep, setNextStep] = useState(p.nextStep);
  const [deadline, setDeadline] = useState(p.deadline ?? "");
  const [pageHref, setPageHref] = useState(p.pageHref ?? "");
  const [problem, setProblem] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const save = () => {
    if (!name.trim()) {
      setProblem("Give it a name first.");
      return;
    }
    change({
      name: name.trim(),
      emoji,
      goal: goal.trim(),
      nextStep: nextStep.trim(),
      deadline: deadline || null,
      pageHref: pageHref || null,
    });
    onClose();
  };

  const remove = async () => {
    if (!confirm(`Delete "${p.name}" and everything in it? This can't be undone.`)) return;
    setDeleting(true);
    const res = await deleteProject(p.id);
    if (!res.ok) {
      setDeleting(false);
      setProblem(res.error ?? "That didn't delete.");
      return;
    }
    router.push(p.area === "legal" ? "/legal" : "/projects");
  };

  return (
    <Card>
      <div className="space-y-3">
        <Field label="Project name">
          <input value={name} onChange={(e) => setName(e.target.value)} className={INPUT} />
        </Field>
        <div>
          <div className="text-[14px]">Picture</div>
          <EmojiPicker value={emoji} onChange={setEmoji} />
        </div>
        <Field label="The goal — what does finished look like?">
          <textarea
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            rows={2}
            placeholder="e.g. No more roaches, and the landlord pays for it"
            className={INPUT}
          />
        </Field>
        <Field label="Next step">
          <input
            value={nextStep}
            onChange={(e) => setNextStep(e.target.value)}
            placeholder="e.g. Call the leasing office on Monday"
            className={INPUT}
          />
        </Field>
        <Field label="Deadline (if there is one)">
          <input
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className={INPUT}
          />
        </Field>
        <Field label="Goes with a page in this app">
          <select value={pageHref} onChange={(e) => setPageHref(e.target.value)} className={INPUT}>
            <option value="">None</option>
            {pages.map((x) => (
              <option key={x.href} value={x.href}>
                {x.label}
              </option>
            ))}
          </select>
        </Field>
        {problem && (
          <div className="text-[13px]" style={{ color: "var(--neg)" }}>
            {problem}
          </div>
        )}
        <div className="flex flex-wrap gap-2 pt-1">
          <button onClick={save} className={GREEN_BUTTON} style={{ background: "var(--good)" }}>
            Done
          </button>
          <button onClick={onClose} className={PLAIN_BUTTON}>
            Cancel
          </button>
          <button
            onClick={() => void remove()}
            disabled={deleting}
            className="ml-auto flex items-center gap-1 rounded-xl px-3 py-2.5 text-[14px] disabled:opacity-50"
            style={{ color: "var(--neg)" }}
          >
            <Trash2 size={15} />
            {deleting ? "Deleting…" : "Delete project"}
          </button>
        </div>
      </div>
    </Card>
  );
}

// ── Steps ────────────────────────────────────────────────────────────────────

function StepsTab({ project: p, today, change }: { project: Project; today: string; change: Change }) {
  const [text, setText] = useState("");
  const [due, setDue] = useState("");
  const { done, total } = stepProgress(p);
  // Still-to-do first, in the order they were added; ticked ones sink.
  const ordered = [...p.steps.filter((s) => !s.done), ...p.steps.filter((s) => s.done)];

  const add = () => {
    if (!text.trim()) return;
    change({ steps: [...p.steps, { id: newId(), text: text.trim(), done: false, due: due || null }] });
    setText("");
    setDue("");
  };

  return (
    <section className="space-y-3">
      {total > 0 && (
        <div>
          <Bar pct={(done / total) * 100} />
          <div className="mt-1 text-[13px] text-muted">
            {done === total ? "Every step done 🎉" : `${done} of ${total} steps done`}
          </div>
        </div>
      )}

      {total === 0 && (
        <Empty>Break it into small steps — each one you tick off fills the bar.</Empty>
      )}

      <div className="space-y-2">
        {ordered.map((s) => {
          const d = s.due && !s.done ? dueWord(s.due, today) : null;
          return (
            <Card key={s.id} className="!p-3">
              <div className="flex items-start gap-3">
                <button
                  onClick={() =>
                    change({ steps: p.steps.map((x) => (x.id === s.id ? { ...x, done: !x.done } : x)) })
                  }
                  aria-label={s.done ? "Mark not done" : "Mark done"}
                  className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2"
                  style={{
                    borderColor: s.done ? "var(--good)" : "var(--border)",
                    background: s.done ? "var(--good)" : "transparent",
                    color: "white",
                  }}
                >
                  {s.done && <Check size={14} strokeWidth={3} />}
                </button>
                <div className="min-w-0 flex-1">
                  <div
                    className="text-[15px] leading-snug"
                    style={s.done ? { textDecoration: "line-through", color: "var(--faint)" } : undefined}
                  >
                    {s.text}
                  </div>
                  {s.due && (
                    <div
                      className="mt-0.5 text-[12px]"
                      style={{
                        color: d?.late ? "var(--neg)" : d?.soon ? "var(--warn)" : "var(--muted)",
                      }}
                    >
                      By {shortDate(s.due, today)}
                      {d && ` (${d.text})`}
                    </div>
                  )}
                </div>
                <RemoveButton
                  what="step"
                  onRemove={() => change({ steps: p.steps.filter((x) => x.id !== s.id) })}
                />
              </div>
            </Card>
          );
        })}
      </div>

      <Card>
        <div className="space-y-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="Add a step, e.g. Get a copy of my birth certificate"
            className={INPUT}
          />
          <div className="flex items-end gap-2">
            <Field label="Needs doing by (optional)" className="flex-1">
              <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className={INPUT} />
            </Field>
            <AddButton onClick={add} disabled={!text.trim()} />
          </div>
        </div>
      </Card>
    </section>
  );
}

// ── Updates (the diary) ──────────────────────────────────────────────────────

function UpdatesTab({ project: p, today, change }: { project: Project; today: string; change: Change }) {
  const [date, setDate] = useState(today);
  const [text, setText] = useState("");
  const newestFirst = p.updates
    .map((u, i) => ({ u, i }))
    .sort((a, b) => b.u.date.localeCompare(a.u.date) || b.i - a.i)
    .map(({ u }) => u);

  const add = () => {
    if (!text.trim() || !date) return;
    change({ updates: [...p.updates, { id: newId(), date, text: text.trim() }] });
    setText("");
    setDate(today);
  };

  return (
    <section className="space-y-3">
      <Card>
        <div className="space-y-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            placeholder="What happened? Who did you talk to, and what did they say?"
            className={INPUT}
          />
          <div className="flex items-end gap-2">
            <Field label="When" className="flex-1">
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={INPUT} />
            </Field>
            <AddButton onClick={add} disabled={!text.trim() || !date} />
          </div>
        </div>
      </Card>

      {newestFirst.length === 0 && (
        <Empty>
          Write down every call, email and visit as it happens. If anyone ever asks
          &ldquo;when did you tell them?&rdquo;, the answer&apos;s here.
        </Empty>
      )}

      <div className="space-y-2">
        {newestFirst.map((u) => (
          <Card key={u.id} className="!p-3">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-[12px] font-medium text-muted">{shortDate(u.date, today)}</div>
                <div className="mt-0.5 whitespace-pre-wrap break-words text-[15px] leading-snug">
                  {u.text}
                </div>
              </div>
              <RemoveButton
                what="update"
                onRemove={() => change({ updates: p.updates.filter((x) => x.id !== u.id) })}
              />
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}

// ── People ───────────────────────────────────────────────────────────────────

const NO_PERSON: Omit<ProjectPerson, "id"> = { name: "", role: "", phone: "", email: "", notes: "" };

function PeopleTab({ project: p, change }: { project: Project; change: Change }) {
  // null = nothing open; "new" = the add form; otherwise the id being edited.
  const [open, setOpen] = useState<string | null>(null);

  const save = (person: ProjectPerson) => {
    const exists = p.people.some((x) => x.id === person.id);
    change({
      people: exists
        ? p.people.map((x) => (x.id === person.id ? person : x))
        : [...p.people, person],
    });
    setOpen(null);
  };

  return (
    <section className="space-y-3">
      {p.people.length === 0 && open !== "new" && (
        <Empty>
          The lawyer, the landlord, the caseworker — anyone you deal with on this,
          with their number one tap away.
        </Empty>
      )}

      <div className="space-y-2">
        {p.people.map((person) =>
          open === person.id ? (
            <PersonForm key={person.id} initial={person} onSave={save} onCancel={() => setOpen(null)} />
          ) : (
            <Card key={person.id} className="!p-3">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-medium">{person.name}</div>
                  {person.role && <div className="text-[13px] text-muted">{person.role}</div>}
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    {person.phone && (
                      <a
                        href={`tel:${person.phone.replace(/[^\d+]/g, "")}`}
                        className="flex items-center gap-1 rounded-lg bg-tint px-2.5 py-1 text-[13px]"
                      >
                        <Phone size={13} />
                        {person.phone}
                      </a>
                    )}
                    {person.email && (
                      <a
                        href={`mailto:${person.email}`}
                        className="flex min-w-0 items-center gap-1 rounded-lg bg-tint px-2.5 py-1 text-[13px]"
                      >
                        <Mail size={13} className="shrink-0" />
                        <span className="truncate">{person.email}</span>
                      </a>
                    )}
                  </div>
                  {person.notes && (
                    <div className="mt-1.5 whitespace-pre-wrap break-words text-[13px] text-muted">
                      {person.notes}
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    onClick={() => setOpen(person.id)}
                    aria-label="Edit"
                    className="rounded-lg p-1.5 text-muted"
                  >
                    <Pencil size={15} />
                  </button>
                  <RemoveButton
                    what={person.name}
                    onRemove={() => change({ people: p.people.filter((x) => x.id !== person.id) })}
                  />
                </div>
              </div>
            </Card>
          )
        )}
      </div>

      {open === "new" ? (
        <PersonForm
          initial={{ id: newId(), ...NO_PERSON }}
          onSave={save}
          onCancel={() => setOpen(null)}
        />
      ) : (
        <AddRowButton onClick={() => setOpen("new")}>Add a person</AddRowButton>
      )}
    </section>
  );
}

function PersonForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: ProjectPerson;
  onSave: (p: ProjectPerson) => void;
  onCancel: () => void;
}) {
  const [d, setD] = useState(initial);
  const set = (key: keyof ProjectPerson) => (v: string) => setD((x) => ({ ...x, [key]: v }));

  return (
    <Card>
      <div className="space-y-2.5">
        <Field label="Name">
          <input value={d.name} onChange={(e) => set("name")(e.target.value)} className={INPUT} />
        </Field>
        <Field label="Who they are">
          <input
            value={d.role}
            onChange={(e) => set("role")(e.target.value)}
            placeholder="e.g. Lawyer, Landlord, Caseworker"
            className={INPUT}
          />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Phone">
            <input
              type="tel"
              value={d.phone}
              onChange={(e) => set("phone")(e.target.value)}
              className={INPUT}
            />
          </Field>
          <Field label="Email">
            <input
              type="email"
              value={d.email}
              onChange={(e) => set("email")(e.target.value)}
              className={INPUT}
            />
          </Field>
        </div>
        <Field label="Notes">
          <textarea
            value={d.notes}
            onChange={(e) => set("notes")(e.target.value)}
            rows={2}
            placeholder="e.g. Best to call before noon"
            className={INPUT}
          />
        </Field>
        <div className="flex gap-2 pt-1">
          <button
            onClick={() => d.name.trim() && onSave({ ...d, name: d.name.trim() })}
            disabled={!d.name.trim()}
            className={GREEN_BUTTON}
            style={{ background: "var(--good)" }}
          >
            Save
          </button>
          <button onClick={onCancel} className={PLAIN_BUTTON}>
            Cancel
          </button>
        </div>
      </div>
    </Card>
  );
}

// ── Money ────────────────────────────────────────────────────────────────────

function MoneyTab({ project: p, today, change }: { project: Project; today: string; change: Change }) {
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [kind, setKind] = useState<MoneyKind>("cost");
  const [date, setDate] = useState("");
  const [settled, setSettled] = useState(false);
  const t = moneyTotals(p);
  const amountNum = Number(amount.replace(/[$,\s]/g, ""));
  const canAdd = label.trim() !== "" && Number.isFinite(amountNum) && amountNum > 0;

  const add = () => {
    if (!canAdd) return;
    change({
      money: [
        ...p.money,
        { id: newId(), label: label.trim(), amount: amountNum, kind, settled, date: date || null },
      ],
    });
    setLabel("");
    setAmount("");
    setDate("");
    setSettled(false);
  };

  return (
    <section className="space-y-3">
      {p.money.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          <Tint>
            <div className="text-[12px] text-muted">It&apos;s cost</div>
            <div className="text-[18px] font-semibold">{money(t.costs)}</div>
            {t.stillToPay > 0 && (
              <div className="text-[12px]" style={{ color: "var(--warn)" }}>
                {money(t.stillToPay)} still to pay
              </div>
            )}
          </Tint>
          <Tint>
            <div className="text-[12px] text-muted">Coming in</div>
            <div className="text-[18px] font-semibold" style={{ color: "var(--good)" }}>
              {money(t.comingIn)}
            </div>
            {t.stillToCome > 0 && (
              <div className="text-[12px] text-muted">{money(t.stillToCome)} not here yet</div>
            )}
          </Tint>
        </div>
      )}

      {p.money.length === 0 && (
        <Empty>
          Fees, deposits, what the lawyer charges — and money coming back, like the
          rent help itself.
        </Empty>
      )}

      <div className="space-y-2">
        {p.money.map((m) => (
          <Card key={m.id} className="!p-3">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-[15px] leading-snug">{m.label}</div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px]">
                  <button
                    onClick={() =>
                      change({
                        money: p.money.map((x) => (x.id === m.id ? { ...x, settled: !x.settled } : x)),
                      })
                    }
                    className="rounded-full px-2.5 py-0.5 font-medium"
                    style={
                      m.settled
                        ? { background: "var(--good-bg)", color: "var(--good)" }
                        : { background: "var(--warn-bg)", color: "var(--warn)" }
                    }
                  >
                    {m.kind === "cost"
                      ? m.settled
                        ? "✓ Paid"
                        : "Not paid yet"
                      : m.settled
                        ? "✓ Received"
                        : "Not here yet"}
                  </button>
                  {m.date && <span className="text-muted">{shortDate(m.date, today)}</span>}
                </div>
              </div>
              <div
                className="shrink-0 text-[15px] font-semibold tabular-nums"
                style={{ color: m.kind === "in" ? "var(--good)" : "var(--text)" }}
              >
                {m.kind === "in" ? "+" : "−"}
                {money(m.amount)}
              </div>
              <RemoveButton
                what={m.label}
                onRemove={() => change({ money: p.money.filter((x) => x.id !== m.id) })}
              />
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <div className="space-y-2.5">
          <div className="grid grid-cols-2 gap-1.5">
            {(["cost", "in"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setKind(k)}
                className="rounded-xl border px-2 py-2 text-[14px] font-medium"
                style={{
                  borderColor: kind === k ? "var(--text)" : "var(--border)",
                  background: kind === k ? "var(--tint)" : "var(--card)",
                  color: kind === k ? "var(--text)" : "var(--muted)",
                }}
              >
                {k === "cost" ? "Money going out" : "Money coming in"}
              </button>
            ))}
          </div>
          <Field label="What for">
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={kind === "cost" ? "e.g. Court filing fee" : "e.g. Rent help payment"}
              className={INPUT}
            />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="How much">
              <input
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="$0"
                className={INPUT}
              />
            </Field>
            <Field label="Date (optional)">
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={INPUT} />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-[14px]">
            <input
              type="checkbox"
              checked={settled}
              onChange={(e) => setSettled(e.target.checked)}
              className="h-4 w-4"
            />
            {kind === "cost" ? "Already paid" : "Already received"}
          </label>
          <AddButton onClick={add} disabled={!canAdd} wide />
        </div>
      </Card>
    </section>
  );
}

// ── Info: key details, links, notes ──────────────────────────────────────────

function InfoTab({ project: p, change }: { project: Project; change: Change }) {
  return (
    <div className="space-y-6">
      <DetailsSection project={p} change={change} />
      <LinksSection project={p} change={change} />
      <NotesSection project={p} change={change} />
    </div>
  );
}

function DetailsSection({ project: p, change }: { project: Project; change: Change }) {
  const [label, setLabel] = useState("");
  const [value, setValue] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const add = () => {
    if (!label.trim()) return;
    change({ details: [...p.details, { id: newId(), label: label.trim(), value: value.trim() }] });
    setLabel("");
    setValue("");
  };

  return (
    <section>
      <h2 className="mb-1 text-[15px] font-medium">Key details</h2>
      <p className="mb-2 text-[13px] text-muted">
        The numbers and facts you get asked for — case number, application ID,
        unit number, the new name spelled exactly right.
      </p>

      {p.details.length > 0 && (
        <Card className="!p-0">
          {p.details.map((d, i) => (
            <div key={d.id} className={`flex items-start gap-3 px-3 py-2.5 ${i ? "border-t border-border" : ""}`}>
              <div className="min-w-0 flex-1">
                <div className="text-[12px] text-muted">{d.label}</div>
                {editing === d.id ? (
                  <div className="mt-1 flex gap-2">
                    <input
                      autoFocus
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className={INPUT}
                    />
                    <button
                      onClick={() => {
                        change({
                          details: p.details.map((x) =>
                            x.id === d.id ? { ...x, value: editValue.trim() } : x
                          ),
                        });
                        setEditing(null);
                      }}
                      className="shrink-0 rounded-xl px-3 text-[14px] font-medium text-white"
                      style={{ background: "var(--good)" }}
                    >
                      Save
                    </button>
                  </div>
                ) : (
                  <div className="whitespace-pre-wrap break-words text-[15px] font-medium">
                    {d.value || <span className="font-normal text-faint">—</span>}
                  </div>
                )}
              </div>
              {editing !== d.id && (
                <div className="flex shrink-0 gap-1">
                  <button
                    onClick={() => {
                      setEditing(d.id);
                      setEditValue(d.value);
                    }}
                    aria-label="Edit"
                    className="rounded-lg p-1.5 text-muted"
                  >
                    <Pencil size={15} />
                  </button>
                  <RemoveButton
                    what={d.label}
                    onRemove={() => change({ details: p.details.filter((x) => x.id !== d.id) })}
                  />
                </div>
              )}
            </div>
          ))}
        </Card>
      )}

      <Card className="mt-2">
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Case number"
              className={INPUT}
            />
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && add()}
              placeholder="e.g. FC2026-001234"
              className={INPUT}
            />
          </div>
          <AddButton onClick={add} disabled={!label.trim()} wide />
        </div>
      </Card>
    </section>
  );
}

function LinksSection({ project: p, change }: { project: Project; change: Change }) {
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [problem, setProblem] = useState<string | null>(null);

  const add = () => {
    const clean = cleanUrl(url);
    if (!clean) {
      setProblem("That doesn't look like a web address.");
      return;
    }
    setProblem(null);
    change({ links: [...p.links, { id: newId(), label: label.trim() || clean, url: clean }] });
    setLabel("");
    setUrl("");
  };

  return (
    <section>
      <h2 className="mb-1 text-[15px] font-medium">Links &amp; paperwork</h2>
      <p className="mb-2 text-[13px] text-muted">
        The application website, a Google Drive folder, a form to fill in.
      </p>

      {p.links.length > 0 && (
        <Card className="!p-0">
          {p.links.map((l, i) => (
            <div key={l.id} className={`flex items-center gap-3 px-3 py-2.5 ${i ? "border-t border-border" : ""}`}>
              <a
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-w-0 flex-1 items-center gap-2 text-[15px]"
              >
                <ExternalLink size={15} className="shrink-0 text-muted" />
                <span className="truncate underline decoration-border underline-offset-2">{l.label}</span>
              </a>
              <RemoveButton
                what={l.label}
                onRemove={() => change({ links: p.links.filter((x) => x.id !== l.id) })}
              />
            </div>
          ))}
        </Card>
      )}

      <Card className="mt-2">
        <div className="space-y-2">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="What it is, e.g. Rent help application"
            className={INPUT}
          />
          <input
            type="url"
            inputMode="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="Web address, e.g. glendaleaz.com"
            className={INPUT}
          />
          {problem && (
            <div className="text-[13px]" style={{ color: "var(--neg)" }}>
              {problem}
            </div>
          )}
          <AddButton onClick={add} disabled={!url.trim()} wide />
        </div>
      </Card>
    </section>
  );
}

function NotesSection({ project: p, change }: { project: Project; change: Change }) {
  const [notes, setNotes] = useState(p.notes);
  const changed = notes.trim() !== p.notes;

  return (
    <section>
      <h2 className="mb-1 text-[15px] font-medium">Notes</h2>
      <p className="mb-2 text-[13px] text-muted">Anything else worth remembering.</p>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={6}
        className={`${INPUT} bg-card`}
      />
      {changed && (
        <button
          onClick={() => change({ notes: notes.trim() })}
          className={`mt-2 ${GREEN_BUTTON}`}
          style={{ background: "var(--good)" }}
        >
          Save notes
        </button>
      )}
    </section>
  );
}

// ── Small pieces ─────────────────────────────────────────────────────────────

function Field({
  label,
  className = "",
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="text-[14px]">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function AddButton({
  onClick,
  disabled,
  wide,
}: {
  onClick: () => void;
  disabled?: boolean;
  wide?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex shrink-0 items-center justify-center gap-1 ${GREEN_BUTTON} ${wide ? "w-full" : ""}`}
      style={{ background: "var(--good)" }}
    >
      <Plus size={16} />
      Add
    </button>
  );
}

function AddRowButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-border bg-card px-4 py-3 text-[15px] font-medium"
    >
      <Plus size={18} />
      {children}
    </button>
  );
}

function RemoveButton({ what, onRemove }: { what: string; onRemove: () => void }) {
  return (
    <button
      onClick={() => confirm(`Remove ${what === "step" || what === "update" ? `this ${what}` : `"${what}"`}?`) && onRemove()}
      aria-label="Remove"
      className="shrink-0 rounded-lg p-1.5 text-faint hover:text-muted"
    >
      <Trash2 size={15} />
    </button>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-border px-4 py-5 text-center text-[14px] leading-snug text-muted">
      {children}
    </div>
  );
}
