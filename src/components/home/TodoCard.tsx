"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Check, ChevronDown, ListTodo, Plus, X } from "lucide-react";
import { saveTodos } from "@/lib/actions";
import { MAX_TODO_LENGTH, sortTodos, type Todo } from "@/lib/todos";
import type { GymDay } from "@/lib/gymDay";
import BusinessSwitch from "./BusinessSwitch";
import { useShowBusiness } from "./businessToggle";

const BIZ = "#9a6212";
const BIZ_SHOWN = 5;

type ProjectStepRow = {
  id: string;
  text: string;
  due: string;
  project: string;
  emoji: string;
  href: string;
};

// "Today", "Tomorrow", "Overdue", or a short date.
function dueLabel(due: string, today: string): { text: string; late: boolean } {
  if (due < today) return { text: "Overdue", late: true };
  if (due === today) return { text: "Today", late: false };
  const [y, m, d] = due.split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  const days = Math.round((Date.UTC(y, m - 1, d) - Date.UTC(ty, tm - 1, td)) / 86_400_000);
  if (days === 1) return { text: "Tomorrow", late: false };
  const date = new Date(Date.UTC(y, m - 1, d));
  return {
    text: date.toLocaleDateString("en-US", days < 7 ? { weekday: "short", timeZone: "UTC" } : { month: "short", day: "numeric", timeZone: "UTC" }),
    late: false,
  };
}

export default function TodoCard({
  initial,
  today,
  projectSteps,
  business = null,
}: {
  // Null when the list couldn't be read — said, rather than shown as empty.
  initial: Todo[] | null;
  today: string;
  projectSteps: ProjectStepRow[];
  // His gym tasks due by tonight. Null when the gym dashboard isn't reachable.
  business?: Pick<GymDay, "tasks" | "taskCount" | "overdueCount" | "tasksUrl"> | null;
}) {
  const showBusiness = useShowBusiness();
  const biz = showBusiness ? business : null;
  const [items, setItems] = useState<Todo[]>(initial ?? []);
  const [text, setText] = useState("");
  const [due, setDue] = useState("");
  const [showDone, setShowDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  // Every change goes on screen straight away and is saved behind it. If the
  // save fails the list goes back to what was saved, so it never lies.
  function commit(next: Todo[]) {
    const before = items;
    setItems(next);
    setError(null);
    startTransition(async () => {
      const res = await saveTodos(next);
      if (!res.ok) {
        setItems(before);
        setError(res.error ?? "Not saved. Try again.");
      }
    });
  }

  function add(e: React.FormEvent) {
    e.preventDefault();
    const clean = text.trim().slice(0, MAX_TODO_LENGTH);
    if (!clean) return;
    const todo: Todo = {
      id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now()),
      text: clean,
      done: false,
      due: due || null,
      doneAt: null,
    };
    commit([todo, ...items]);
    setText("");
    setDue("");
    inputRef.current?.focus();
  }

  function toggle(id: string) {
    commit(
      items.map((t) =>
        t.id === id ? { ...t, done: !t.done, doneAt: t.done ? null : new Date().toISOString() } : t
      )
    );
  }

  function remove(id: string) {
    commit(items.filter((t) => t.id !== id));
  }

  const sorted = sortTodos(items);
  const open = sorted.filter((t) => !t.done);
  const done = sorted.filter((t) => t.done);

  return (
    <section className="h-full rounded-3xl border border-border bg-card p-5">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: "#6d28d918", color: "#6d28d9" }}>
          <ListTodo size={18} />
        </span>
        <span className="flex-1 text-[16px] font-semibold">To do</span>
        {open.length > 0 && <span className="text-[13px] text-muted">{open.length} left</span>}
        {business !== null && <BusinessSwitch />}
      </div>

      {initial === null && (
        <p className="mt-3 text-[13px] text-warn">Your list couldn&apos;t be loaded just now. Refresh in a moment.</p>
      )}

      <form onSubmit={add} className="mt-4 flex items-center gap-2 rounded-2xl border border-border bg-bg px-3 py-1.5 focus-within:border-[var(--muted)]">
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add something…"
          maxLength={MAX_TODO_LENGTH}
          className="min-w-0 flex-1 bg-transparent py-1.5 text-[15px] outline-none"
          aria-label="New to-do"
        />
        <input
          type="date"
          value={due}
          onChange={(e) => setDue(e.target.value)}
          className="w-[7.5rem] shrink-0 bg-transparent text-[13px] text-muted outline-none"
          aria-label="Due date (optional)"
        />
        <button
          type="submit"
          disabled={!text.trim()}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white transition-opacity disabled:opacity-30"
          style={{ background: "var(--good)" }}
          aria-label="Add"
        >
          <Plus size={18} />
        </button>
      </form>

      {error && <p className="mt-2 text-[13px] text-warn">{error}</p>}

      <ul className="mt-2">
        {open.map((t) => (
          <Row key={t.id} todo={t} today={today} onToggle={toggle} onRemove={remove} />
        ))}
      </ul>

      {open.length === 0 && projectSteps.length === 0 && !biz?.taskCount && initial !== null && (
        <p className="mt-3 text-center text-[14px] text-muted">Nothing on your list. Nice. ✨</p>
      )}

      {projectSteps.length > 0 && (
        <div className="mt-3">
          <div className="text-[12px] font-medium uppercase tracking-wider text-muted">From your projects</div>
          <ul className="mt-1">
            {projectSteps.map((s) => {
              const when = dueLabel(s.due, today);
              return (
                <li key={s.id}>
                  <Link href={s.href} className="flex items-center gap-3 rounded-xl py-2 hover:bg-tint">
                    <span className="w-6 text-center text-[16px]">{s.emoji}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px]">{s.text}</span>
                      <span className="block truncate text-[12px] text-muted">{s.project}</span>
                    </span>
                    <span className={`shrink-0 text-[12px] ${when.late ? "font-medium text-neg" : "text-muted"}`}>{when.text}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {biz && biz.taskCount > 0 && (
        <div className="mt-3">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-medium uppercase tracking-wider" style={{ color: BIZ }}>
              At the gym
            </span>
            {biz.overdueCount > 0 && (
              <span className="text-[12px] font-medium text-neg">{biz.overdueCount} overdue</span>
            )}
          </div>
          <ul className="mt-1">
            {biz.tasks.slice(0, BIZ_SHOWN).map((t) => (
              <li key={t.id} className="flex items-center gap-3 py-2">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: t.overdue ? "var(--neg)" : BIZ }} />
                <span className="min-w-0 flex-1 truncate text-[14px]">{t.title}</span>
                <span className={`shrink-0 text-[12px] ${t.overdue ? "font-medium text-neg" : "text-muted"}`}>
                  {t.overdue ? "Overdue" : "Today"}
                </span>
              </li>
            ))}
          </ul>
          <a
            href={biz.tasksUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-block text-[13px] font-medium"
            style={{ color: BIZ }}
          >
            {biz.taskCount > BIZ_SHOWN ? `See all ${biz.taskCount} in the gym dashboard →` : "Open in the gym dashboard →"}
          </a>
        </div>
      )}

      {done.length > 0 && (
        <div className="mt-3 border-t border-border pt-2">
          <button
            type="button"
            onClick={() => setShowDone((v) => !v)}
            className="flex items-center gap-1 text-[13px] text-muted"
          >
            <ChevronDown size={14} className={`transition-transform ${showDone ? "rotate-180" : ""}`} />
            Done ({done.length})
          </button>
          {showDone && (
            <ul className="mt-1">
              {done.map((t) => (
                <Row key={t.id} todo={t} today={today} onToggle={toggle} onRemove={remove} />
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

function Row({
  todo,
  today,
  onToggle,
  onRemove,
}: {
  todo: Todo;
  today: string;
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const when = todo.due && !todo.done ? dueLabel(todo.due, today) : null;
  return (
    <li className="group flex items-center gap-3 py-2">
      <button
        type="button"
        onClick={() => onToggle(todo.id)}
        aria-label={todo.done ? "Mark not done" : "Mark done"}
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors"
        style={{
          borderColor: todo.done ? "var(--good)" : "var(--border)",
          background: todo.done ? "var(--good)" : "transparent",
        }}
      >
        {todo.done && <Check size={14} className="text-white" strokeWidth={3} />}
      </button>
      <span className={`min-w-0 flex-1 text-[15px] ${todo.done ? "text-muted line-through" : ""}`}>{todo.text}</span>
      {when && <span className={`shrink-0 text-[12px] ${when.late ? "font-medium text-neg" : "text-muted"}`}>{when.text}</span>}
      <button
        type="button"
        onClick={() => onRemove(todo.id)}
        aria-label="Delete"
        className="shrink-0 rounded-full p-1 text-muted opacity-40 transition-opacity hover:bg-tint hover:opacity-100 group-hover:opacity-100"
      >
        <X size={14} />
      </button>
    </li>
  );
}
