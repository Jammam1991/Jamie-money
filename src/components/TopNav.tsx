"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { pageByKey, type PageKey } from "@/lib/pages";

// The same tabs as the bottom bar, laid out for a mouse and a wide screen.
//
// It's a separate component rather than the bottom bar restyled, because the
// two want opposite things: the phone bar is fixed to the bottom, full-width,
// and pads itself around the home indicator; this one sits in the page flow at
// the top with the tabs grouped left. Shared markup would be a knot of
// conditionals for no gain — what's actually shared is which tabs there are,
// and that's worked out once on the server and handed to both.
export default function TopNav({ tabs }: { tabs: PageKey[] }) {
  const pathname = usePathname();
  const visible = tabs.map(pageByKey).filter((p) => p !== undefined);
  if (visible.length === 0) return null;

  return (
    <nav className="hidden border-b border-border bg-card md:block">
      <div className="mx-auto flex max-w-3xl items-center gap-1 px-6">
        {visible.map(({ href, label, Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className="flex items-center gap-2 border-b-2 px-3 py-3 text-sm transition-colors"
              style={{
                color: active ? "var(--text)" : "var(--muted)",
                // The underline marks the current tab. Transparent rather than
                // absent on the others, so nothing shifts by 2px on hover.
                borderColor: active ? "var(--warn)" : "transparent",
                fontWeight: active ? 500 : 400,
              }}
            >
              <Icon size={17} strokeWidth={active ? 2.2 : 1.8} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
