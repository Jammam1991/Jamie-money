"use client";

import { useState } from "react";
import StoryFrame from "@/components/StoryFrame";
import StoryClient from "@/components/StoryClient";
import type { Story } from "@/lib/story";

// ── The Debt Story ───────────────────────────────────────────────────────────
// Money App's page, framed — one renderer for one document. Drawing it twice is
// what caused every mismatch: preview lines in a different order, a chapter
// understated by $2,500, captions missing, whole sections absent because they
// live as markup over there rather than as data.
//
// `story` is still fetched, and StoryClient still exists, purely as the safety
// net: if Money App can't be reached the page shows the older drawing of it
// rather than an empty rectangle. It will be a little out of date, and it says
// so — but it is never blank and never wrong about the total.
export default function StoryPage({ story }: { story: Story | null }) {
  const [framed, setFramed] = useState(true);

  if (framed) return <StoryFrame onFail={() => setFramed(false)} />;

  return (
    <>
      <p className="mb-3 text-xs text-muted">
        Showing this app&apos;s own copy — Money App couldn&apos;t be reached, so
        some of the newest detail may be missing.
      </p>
      <StoryClient story={story} />
    </>
  );
}
