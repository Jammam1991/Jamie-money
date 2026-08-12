"use client";

import { useEffect, useRef, useState } from "react";

// ── Money App's story page, framed ───────────────────────────────────────────
// The Debt Story is one document, and it used to be drawn twice — once by Money
// App and once here, from its exported data. The two drifted every time that
// page changed. So this shows Money App's own page instead of rebuilding it.
//
// The frame grows to its content rather than scrolling inside itself: a scroll
// box inside a scrolling page is horrible on a phone, and this page is read on
// a phone.
//
// `onFail` lets the parent fall back to the locally-drawn version, so a quiet
// Money App leaves Jamie with the old page rather than a blank rectangle.
export default function StoryFrame({ onFail }: { onFail: () => void }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(1200);

  useEffect(() => {
    const frame = ref.current;
    if (!frame) return;

    // Same origin, so the document is readable and its height is knowable.
    function measure() {
      try {
        const doc = frame?.contentDocument;
        if (!doc?.body) return;
        const h = Math.max(doc.body.scrollHeight, doc.documentElement.scrollHeight);
        if (h > 0) setHeight(h);
      } catch {
        // A cross-origin document can't be measured. Nothing to do but leave
        // the fallback height in place.
      }
    }

    // The page keeps growing as sections open, so watch rather than measure
    // once. ResizeObserver on the inner body catches every change.
    let observer: ResizeObserver | null = null;
    function attach() {
      measure();
      try {
        const body = frame?.contentDocument?.body;
        if (body && "ResizeObserver" in window) {
          observer = new ResizeObserver(measure);
          observer.observe(body);
        }
      } catch {
        // Same as above.
      }
    }

    frame.addEventListener("load", attach);
    return () => {
      frame.removeEventListener("load", attach);
      observer?.disconnect();
    };
  }, []);

  return (
    <iframe
      ref={ref}
      src="/story-frame"
      title="The Debt Story"
      className="w-full"
      style={{ height, border: 0 }}
      // A same-origin frame that failed to load leaves an empty box, and an
      // empty box on this page is worse than the older drawing of it.
      onError={onFail}
      onLoad={() => {
        // A 401/502 from the route arrives as a plain-text body, not the story.
        try {
          const text = ref.current?.contentDocument?.body?.innerText ?? "";
          if (/^(Please log in|Money App|Couldn't reach)/.test(text.trim())) {
            onFail();
          }
        } catch {
          // Unreadable means cross-origin, which means it loaded something —
          // leave it alone.
        }
      }}
    />
  );
}
