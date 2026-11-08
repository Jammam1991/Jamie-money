"use client";

import { Briefcase } from "lucide-react";
import { setShowBusiness, useShowBusiness } from "./businessToggle";

// The little "Business" pill on the Calendar and To do cards. On: gym classes,
// PT, NSIs and gym tasks show alongside his own. Off: just his own life.
export default function BusinessSwitch() {
  const on = useShowBusiness();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => setShowBusiness(!on)}
      className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-medium transition-colors"
      style={{
        borderColor: on ? "#9a6212" : "var(--border)",
        background: on ? "var(--warn-bg)" : "transparent",
        color: on ? "var(--warn)" : "var(--muted)",
      }}
      title={on ? "Hide business" : "Show business"}
    >
      <Briefcase size={12} />
      Business
      <span
        className="relative ml-0.5 inline-block h-3.5 w-6 rounded-full transition-colors"
        style={{ background: on ? "#9a6212" : "var(--border)" }}
        aria-hidden="true"
      >
        <span
          className="absolute top-0.5 h-2.5 w-2.5 rounded-full bg-white transition-all"
          style={{ left: on ? "0.75rem" : "0.125rem" }}
        />
      </span>
    </button>
  );
}
