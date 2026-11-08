// ── Jamie's to-do list: the little things, on the home screen ───────────────
// Not a project — "call the bank", "drop off the form". One line each, a tick
// box, and an optional day it's due. The whole list is one JSON row in
// `settings` (key "todos"), same as Projects, so there's no table to create.
// Shared by the server and the browser: the shape and the one cleaner every
// save and every read goes through.

export type Todo = {
  id: string;
  text: string;
  done: boolean;
  /** ISO date it needs doing by, or null. */
  due: string | null;
  /** When it was ticked, so finished ones can tidy themselves away. */
  doneAt: string | null;
};

export const MAX_TODOS = 100;
export const MAX_TODO_LENGTH = 200;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function parseTodos(raw: unknown): Todo[] {
  if (!Array.isArray(raw)) return [];
  const out: Todo[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const t = item as Record<string, unknown>;
    const id = typeof t.id === "string" && t.id ? t.id : "";
    const text = typeof t.text === "string" ? t.text.trim().slice(0, MAX_TODO_LENGTH) : "";
    if (!id || !text || seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      text,
      done: Boolean(t.done),
      due: typeof t.due === "string" && ISO_DATE.test(t.due) ? t.due : null,
      doneAt: typeof t.doneAt === "string" ? t.doneAt : null,
    });
    if (out.length >= MAX_TODOS) break;
  }
  return out;
}

// Open ones first — the soonest due on top, undated after — then what's done,
// newest tick first.
export function sortTodos(list: Todo[]): Todo[] {
  return [...list].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    if (a.done) return (b.doneAt ?? "").localeCompare(a.doneAt ?? "");
    if (a.due && b.due) return a.due.localeCompare(b.due);
    if (a.due) return -1;
    if (b.due) return 1;
    return 0;
  });
}
