"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  Menu,
  X,
  Scale,
  CreditCard,
  FileText,
  BookOpen,
  Building2,
  Landmark,
  Dumbbell,
  Compass,
  Briefcase,
  HeartHandshake,
  Home,
  GripVertical,
  Check,
  RotateCcw,
} from "lucide-react";
import { setMenuOrder } from "@/lib/actions";

// The slide-out menu. Every row always shows — a page parked as "Coming Soon"
// on the Settings screen keeps its link and says so when Jamie opens it.
//
// This list is the menu. Chris can drag the rows into whatever order he likes
// and that order is saved, but it's only an order: a page can never appear in
// the menu without being here, and one taken out of here disappears from the
// menu no matter what was saved.
const links = [
  // First, because it's the one that frames everything under it.
  { href: "/big-picture", label: "The Big Picture", Icon: Compass },
  { href: "/job-vs-business", label: "Job vs Business", Icon: Scale },
  // Sits right under it — that page asks "job or gym?", this one is what to do
  // about it once the answer is a job.
  { href: "/career", label: "Career", Icon: Briefcase },
  { href: "/debt", label: "Debt", Icon: CreditCard },
  { href: "/credit-report", label: "Credit Report", Icon: FileText },
  // Sits right under those two — it's the same card and car payments read
  // forwards, into the house they still allow room for.
  { href: "/home-buying", label: "Home Buying", Icon: Home },
  { href: "/business-finances", label: "Business Finances", Icon: Building2 },
  { href: "/tax-center", label: "Tax Center", Icon: Landmark },
  { href: "/divorce", label: "Divorce", Icon: Scale },
  // Sits right under it — that page is the mechanics of splitting up, this one
  // is what the splitting up would actually cost.
  { href: "/married-vs-divorce", label: "Married vs Divorce", Icon: HeartHandshake },
  {
    href: "/story",
    label: "The Debt Story",
    Icon: BookOpen,
  },
  { href: "/gym-story", label: "Gym Story", Icon: Dumbbell },
];

type MenuLink = (typeof links)[number];

// The menu in Chris's saved order. Anything he hasn't placed keeps its position
// from the list above and follows on the end, so adding a page to the code
// never needs the saved order touched — and a stale saved order can't hide a
// screen from Jamie.
function inSavedOrder(saved: string[]): MenuLink[] {
  const byHref = new Map(links.map((l) => [l.href, l]));
  const placed = saved
    .map((href) => byHref.get(href))
    .filter((l): l is MenuLink => l !== undefined);
  const seen = new Set(placed.map((l) => l.href));
  return [...placed, ...links.filter((l) => !seen.has(l.href))];
}

// Move one item to a new index, everything else closing up behind it.
function moved<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export default function Header({
  admin = false,
  menuOrder = [],
}: {
  admin?: boolean;
  menuOrder?: string[];
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [items, setItems] = useState<MenuLink[]>(() => inSavedOrder(menuOrder));
  const [dragging, setDragging] = useState<number | null>(null);
  const [, startTransition] = useTransition();
  // The row elements, so a drag can ask where the finger actually is rather
  // than assuming every row is the same height.
  const rowRefs = useRef<(HTMLElement | null)[]>([]);

  // A save elsewhere (or on another device) revalidates the layout and sends a
  // new order down. Take it, unless a drag is in flight — pulling the rows out
  // from under a finger mid-drag is worse than being a moment stale.
  //
  // Adjusted during render rather than in an effect. React supports setting
  // state here to react to a changed prop, and it re-renders before painting,
  // so the menu never flashes the old order on its way to the new one.
  const orderKey = menuOrder.join("|");
  const [lastOrderKey, setLastOrderKey] = useState(orderKey);
  if (orderKey !== lastOrderKey && dragging === null) {
    setLastOrderKey(orderKey);
    setItems(inSavedOrder(menuOrder));
  }

  function save(next: MenuLink[]) {
    startTransition(async () => {
      const res = await setMenuOrder(next.map((l) => l.href));
      // Put the old order back rather than leave rows sitting somewhere they
      // weren't saved — otherwise the menu lies until the next page load.
      if (!res.ok) setItems(inSavedOrder(menuOrder));
    });
  }

  // ── Dragging ───────────────────────────────────────────────────────────────
  // Pointer events rather than HTML5 drag-and-drop, which does nothing on a
  // touchscreen — and a phone is where this menu actually gets used.
  //
  // The row under the finger is found by measuring the rows themselves, so it
  // stays right even though they aren't all the same height.
  function indexAt(clientY: number): number | null {
    for (let i = 0; i < rowRefs.current.length; i++) {
      const el = rowRefs.current[i];
      if (!el) continue;
      const box = el.getBoundingClientRect();
      if (clientY >= box.top && clientY <= box.bottom) return i;
    }
    return null;
  }

  function onHandleDown(e: React.PointerEvent, index: number) {
    e.preventDefault();
    (e.target as Element).setPointerCapture(e.pointerId);
    setDragging(index);
  }

  function onHandleMove(e: React.PointerEvent) {
    if (dragging === null) return;
    e.preventDefault();
    const over = indexAt(e.clientY);
    if (over !== null && over !== dragging) {
      setItems((list) => moved(list, dragging, over));
      setDragging(over);
    }
  }

  function onHandleUp(e: React.PointerEvent) {
    if (dragging === null) return;
    (e.target as Element).releasePointerCapture?.(e.pointerId);
    setDragging(null);
    save(items);
  }

  // Arrow keys do the same job without a pointer, so the menu can still be
  // reordered from a keyboard.
  function onHandleKey(e: React.KeyboardEvent, index: number) {
    const to =
      e.key === "ArrowUp" ? index - 1 : e.key === "ArrowDown" ? index + 1 : null;
    if (to === null || to < 0 || to >= items.length) return;
    e.preventDefault();
    const next = moved(items, index, to);
    setItems(next);
    save(next);
    // Keep the focus on the row that moved, so it can be nudged again.
    requestAnimationFrame(() => rowRefs.current[to]?.querySelector("button")?.focus());
  }

  function reset() {
    setItems(links);
    startTransition(async () => {
      await setMenuOrder([]);
    });
  }

  function close() {
    setMenuOpen(false);
    setEditing(false);
  }

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div className="text-lg font-medium"></div>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="p-2 hover:bg-tint rounded-lg transition-colors"
          aria-label="Menu"
        >
          <Menu size={24} />
        </button>
      </div>

      {menuOpen && (
        <div className="fixed inset-0 z-40 bg-black/20" onClick={close} />
      )}

      {menuOpen && (
        <div className="fixed top-0 right-0 z-50 h-screen w-72 bg-card border-l border-border overflow-y-auto">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <span className="text-lg font-medium">Menu</span>
            <div className="flex items-center gap-1">
              {admin && (
                <button
                  onClick={() => setEditing((v) => !v)}
                  className="rounded-lg px-2 py-1 text-xs text-muted hover:bg-tint transition-colors"
                  aria-pressed={editing}
                >
                  {editing ? (
                    <span className="flex items-center gap-1">
                      <Check size={13} />
                      Done
                    </span>
                  ) : (
                    "Reorder"
                  )}
                </button>
              )}
              <button
                onClick={close}
                className="p-2 hover:bg-tint rounded-lg transition-colors"
                aria-label="Close menu"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {editing && (
            <p className="border-b border-border px-4 py-2 text-xs text-muted">
              Drag the handles to put these in any order. Saved as you go, and
              it&apos;s what Jamie sees too.
            </p>
          )}

          <nav className="p-4 space-y-2">
            {items.map(({ href, label, Icon }, i) => {
              const isDragging = dragging === i;

              // While reordering, the row is a handle rather than a link — a
              // drag that ends as a tap would otherwise navigate away and lose
              // the whole rearrangement.
              if (editing) {
                return (
                  <div
                    key={href}
                    ref={(el) => {
                      rowRefs.current[i] = el;
                    }}
                    className="flex items-center justify-between rounded-xl border p-3 transition-colors"
                    style={{
                      borderColor: isDragging ? "var(--muted)" : "var(--border)",
                      background: isDragging ? "var(--tint)" : undefined,
                      // Lifted slightly, so it's obvious which row is moving.
                      boxShadow: isDragging ? "0 4px 12px rgba(0,0,0,0.12)" : undefined,
                    }}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <Icon size={20} className="shrink-0" />
                      <span className="truncate font-medium">{label}</span>
                    </div>
                    <button
                      type="button"
                      aria-label={`Move ${label}. Use the arrow keys, or drag.`}
                      className="-m-2 cursor-grab p-2 text-muted active:cursor-grabbing"
                      // The browser must not claim the gesture for scrolling,
                      // or a drag on a phone scrolls the menu instead.
                      style={{ touchAction: "none" }}
                      onPointerDown={(e) => onHandleDown(e, i)}
                      onPointerMove={onHandleMove}
                      onPointerUp={onHandleUp}
                      onPointerCancel={onHandleUp}
                      onKeyDown={(e) => onHandleKey(e, i)}
                    >
                      <GripVertical size={18} />
                    </button>
                  </div>
                );
              }

              return (
                <Link
                  key={href}
                  href={href}
                  onClick={close}
                  className="flex items-center justify-between p-3 rounded-xl border border-border hover:bg-tint transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Icon size={20} />
                    <span className="font-medium">{label}</span>
                  </div>
                  <span className="text-muted">&gt;</span>
                </Link>
              );
            })}
          </nav>

          {editing && (
            <div className="px-4 pb-6">
              <button
                onClick={reset}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-border py-2 text-xs text-muted hover:bg-tint transition-colors"
              >
                <RotateCcw size={13} />
                Put back the original order
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
