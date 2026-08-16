"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  Menu,
  X,
  GripVertical,
  Check,
  RotateCcw,
  History as HistoryIcon,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";
import { setMenuOrder } from "@/lib/actions";
import { pageByKey, type PageKey } from "@/lib/pages";

type MenuChild = { href: string; label: string; Icon: LucideIcon };
type MenuLink = MenuChild & { isGroup?: boolean; children?: MenuChild[] };

// The slide-out menu. Which rows are on it is decided on the server: Chris
// arranges them on the Settings screen, and anything he's taken off Jamie's
// screen never reaches this list. A page parked as "Coming Soon" keeps its row
// and says so when Jamie opens it.
//
// Chris and Jamie can each drag the rows into whatever order suits them and
// their own order is saved, but it's only an order: a page can never appear in
// the menu without being handed down here, and one moved out of the menu
// disappears from it no matter what order was saved.
//
// "History" is one row in that same order — its href never routes anywhere, it
// just expands in place — so dragging it around works exactly like any other
// row while its children stay fixed underneath it. It only exists at all while
// something is filed under it.
function buildLinks(menu: PageKey[], history: PageKey[]): MenuLink[] {
  const row = (key: PageKey): MenuChild | null => {
    const page = pageByKey(key);
    return page ? { href: page.href, label: page.label, Icon: page.Icon } : null;
  };
  const rows: MenuLink[] = menu.map(row).filter((r): r is MenuChild => r !== null);
  const children = history.map(row).filter((r): r is MenuChild => r !== null);
  if (children.length > 0) {
    rows.push({
      href: "#history",
      label: "History",
      Icon: HistoryIcon,
      isGroup: true,
      children,
    });
  }
  return rows;
}

// The menu in this person's saved order. Anything they haven't placed keeps its
// position from the list above and follows on the end, so a page added to the
// menu never needs a saved order touched — and a stale saved order can't hide a
// screen from anyone.
function inSavedOrder(saved: string[], base: MenuLink[]): MenuLink[] {
  const byHref = new Map(base.map((l) => [l.href, l]));
  const placed = saved
    .map((href) => byHref.get(href))
    .filter((l): l is MenuLink => l !== undefined);
  const seen = new Set(placed.map((l) => l.href));
  return [...placed, ...base.filter((l) => !seen.has(l.href))];
}

// Move one item to a new index, everything else closing up behind it.
function moved<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export default function Header({
  canReorder = false,
  forJamie = false,
  menuOrder = [],
  menu = [],
  history = [],
}: {
  // Anyone logged in can arrange their own menu — it's how they like their own
  // screen, not something one person sets for the other.
  canReorder?: boolean;
  // True when Chris is looking through "View as Jamie", where the rows he drags
  // are Jamie's. Only changes the wording; which order gets written is settled
  // on the server.
  forJamie?: boolean;
  menuOrder?: string[];
  // The rows this person gets, top level and tucked under History.
  menu?: PageKey[];
  history?: PageKey[];
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const baseLinks = useMemo(() => buildLinks(menu, history), [menu, history]);
  const [items, setItems] = useState<MenuLink[]>(() =>
    inSavedOrder(menuOrder, baseLinks)
  );
  const [dragging, setDragging] = useState<number | null>(null);
  const [, startTransition] = useTransition();
  // The row elements, so a drag can ask where the finger actually is rather
  // than assuming every row is the same height.
  const rowRefs = useRef<(HTMLElement | null)[]>([]);

  // A save elsewhere (or on another device) revalidates the layout and sends a
  // new order — or a different set of rows, if Chris just moved a page — down.
  // Take it, unless a drag is in flight: pulling the rows out from under a
  // finger mid-drag is worse than being a moment stale.
  //
  // Adjusted during render rather than in an effect. React supports setting
  // state here to react to a changed prop, and it re-renders before painting,
  // so the menu never flashes the old order on its way to the new one.
  const rowsKey = `${menuOrder.join("|")}~${menu.join(",")}~${history.join(",")}`;
  const [lastRowsKey, setLastRowsKey] = useState(rowsKey);
  if (rowsKey !== lastRowsKey && dragging === null) {
    setLastRowsKey(rowsKey);
    setItems(inSavedOrder(menuOrder, baseLinks));
  }

  function save(next: MenuLink[]) {
    startTransition(async () => {
      const res = await setMenuOrder(next.map((l) => l.href));
      // Put the old order back rather than leave rows sitting somewhere they
      // weren't saved — otherwise the menu lies until the next page load.
      if (!res.ok) setItems(inSavedOrder(menuOrder, baseLinks));
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
    setItems(baseLinks);
    startTransition(async () => {
      await setMenuOrder([]);
    });
  }

  function close() {
    setMenuOpen(false);
    setEditing(false);
    // Collapsed by default every time the menu is reopened.
    setHistoryOpen(false);
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
        // z-[55]: above BottomNav's z-50, so the scrim also covers (and
        // dims) the bottom tab bar instead of leaving it floating on top.
        <div className="fixed inset-0 z-[55] bg-black/20" onClick={close} />
      )}

      {menuOpen && (
        // z-[60]: BottomNav is `fixed bottom-0 z-50` and renders after this
        // panel in the DOM, so at equal z-index it paints over the bottom of
        // the menu — hiding the last History rows and eating their taps.
        // Sitting above it fixes both.
        <div
          className="fixed top-0 right-0 z-[60] h-screen w-72 bg-card border-l border-border overflow-y-auto"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <div className="flex items-center justify-between p-4 border-b border-border">
            <span className="text-lg font-medium">Menu</span>
            <div className="flex items-center gap-1">
              {canReorder && items.length > 1 && (
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
              Drag the handles to put these in any order. Saved as you go.{" "}
              {forJamie
                ? "These are Jamie's rows — you're arranging his menu, not yours."
                : "This is your own menu; the other person arranges theirs."}
            </p>
          )}

          <nav className="p-4 space-y-2">
            {items.length === 0 && (
              <p className="px-1 py-2 text-[13px] text-muted">
                Nothing in the menu right now.
              </p>
            )}
            {items.map(({ href, label, Icon, isGroup, children }, i) => {
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

              // The History row doesn't navigate — it expands in place to
              // show its own rows underneath, indented so they read as
              // nested rather than as more top-level pages.
              if (isGroup && children) {
                return (
                  <div key={href}>
                    <button
                      type="button"
                      onClick={() => setHistoryOpen((v) => !v)}
                      aria-expanded={historyOpen}
                      className="flex w-full items-center justify-between p-3 rounded-xl border border-border hover:bg-tint transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Icon size={20} />
                        <span className="font-medium">{label}</span>
                      </div>
                      <ChevronDown
                        size={18}
                        className="text-muted transition-transform"
                        style={{ transform: historyOpen ? "rotate(180deg)" : "rotate(0deg)" }}
                      />
                    </button>
                    {historyOpen && (
                      <div className="mt-2 ml-4 space-y-2 border-l border-border pl-3">
                        {children.map((c) => (
                          <Link
                            key={c.href}
                            href={c.href}
                            onClick={close}
                            className="flex items-center justify-between p-3 rounded-xl border border-border hover:bg-tint transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <c.Icon size={18} />
                              <span className="font-medium">{c.label}</span>
                            </div>
                            <span className="text-muted">&gt;</span>
                          </Link>
                        ))}
                      </div>
                    )}
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
