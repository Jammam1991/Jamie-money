import Link from "next/link";
import { Newspaper, TrendingDown, TrendingUp } from "lucide-react";
import { getMarkets, getNews, getWeather, type Quote } from "@/lib/topStrip";

// The pieces across the top of Home. Each one fetches its own feed and is
// wrapped in its own <Suspense> on the page, so a slow feed never holds up the
// rest — and a dead one just isn't drawn.

// ── Stock ticker ─────────────────────────────────────────────────────────────

function price(q: Quote): string {
  if (q.kind === "rate") return `${q.price.toFixed(2)}%`;
  const digits = q.price >= 1000 ? 0 : 2;
  const n = q.price.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  return q.kind === "money" ? `$${n}` : n;
}

function QuoteItem({ q }: { q: Quote }) {
  const up = q.changePct >= 0;
  const color = Math.abs(q.changePct) < 0.005 ? "var(--muted)" : up ? "var(--good)" : "var(--neg)";
  return (
    <span className="flex shrink-0 items-center gap-1.5 px-4 text-[13px]">
      <span className="font-semibold">{q.label}</span>
      <span className="tabular-nums text-muted">{price(q)}</span>
      <span className="flex items-center gap-0.5 font-medium tabular-nums" style={{ color }}>
        {up ? "▲" : "▼"}
        {Math.abs(q.changePct).toFixed(2)}%
      </span>
    </span>
  );
}

export async function Ticker() {
  const quotes = await getMarkets();
  if (!quotes) return null;
  // The row is drawn twice back to back and slid left by exactly one copy, so
  // it loops with no jump. Holding a finger on it (or hovering) pauses it.
  return (
    <div className="ticker overflow-hidden rounded-2xl border border-border bg-card py-2" aria-label="Markets">
      <div className="ticker-track flex w-max">
        {[0, 1].map((copy) => (
          <div key={copy} className="flex" aria-hidden={copy === 1}>
            {quotes.map((q) => (
              <QuoteItem key={q.symbol} q={q} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function TickerSkeleton() {
  return <div className="h-[38px] animate-pulse rounded-2xl border border-border bg-card" />;
}

// ── Weather, inside the hello card ───────────────────────────────────────────

export async function WeatherChip() {
  const w = await getWeather();
  if (!w) return null;
  return (
    <div className="text-right">
      <div className="flex items-center justify-end gap-1.5">
        <span className="text-[26px] leading-none" aria-hidden="true">
          {w.emoji}
        </span>
        <span className="text-[26px] font-semibold leading-none tabular-nums">{w.temp}°</span>
      </div>
      <div className="mt-1 text-[12px] text-white/80">
        {w.label ? `${w.label} · ` : ""}H {w.high}° L {w.low}°
      </div>
      <div className="text-[11px] text-white/60">
        {w.place}
        {w.rainChance !== null && w.rainChance >= 20 ? ` · ${w.rainChance}% rain` : ""}
      </div>
    </div>
  );
}

// ── FICO, a small chip in the hello card ─────────────────────────────────────

export function FicoChip({ score, change, href }: { score: number; change: number | null; href?: string }) {
  const arrow = change === null || change === 0 ? null : change > 0 ? "up" : "down";
  const body = (
    <>
      <span className="text-white/70">FICO</span>
      <span className="font-semibold tabular-nums">{score}</span>
      {arrow && (
        <span
          className="flex items-center gap-0.5 rounded-full px-1.5 text-[12px] font-semibold tabular-nums"
          style={{ background: arrow === "up" ? "#c9f2df" : "#ffd9d5", color: arrow === "up" ? "#0f5c44" : "#8f1d16" }}
        >
          {arrow === "up" ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {Math.abs(change as number)}
        </span>
      )}
    </>
  );
  const cls = "flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 font-medium";
  return href ? (
    <Link href={href} className={`${cls} transition-colors hover:bg-white/25`} title="Your credit score, and how it moved since the last one">
      {body}
    </Link>
  ) : (
    <span className={cls}>{body}</span>
  );
}

// ── Top news ─────────────────────────────────────────────────────────────────

function ago(iso: string | null): string {
  if (!iso) return "";
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export async function TopNews() {
  const news = await getNews(8);
  if (!news) return null;
  const top = news.slice(0, 4);
  const more = news.slice(4);
  const row = (h: (typeof news)[number]) => (
    <li key={h.url}>
      <a href={h.url} target="_blank" rel="noreferrer" className="block py-2 hover:opacity-75">
        <span className="line-clamp-2 text-[14px] font-medium leading-snug">{h.title}</span>
        <span className="text-[12px] text-muted">
          {[h.source, ago(h.publishedAt)].filter(Boolean).join(" · ")}
        </span>
      </a>
    </li>
  );
  return (
    <section className="rounded-3xl border border-border bg-card px-5 py-4">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: "#37415118", color: "#374151" }}>
          <Newspaper size={18} />
        </span>
        <span className="flex-1 text-[16px] font-semibold">Top news</span>
      </div>
      <ul className="mt-2 divide-y divide-border">{top.map(row)}</ul>
      {more.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer list-none pt-1 text-[13px] font-medium text-muted group-open:hidden">
            {more.length} more headlines
          </summary>
          <ul className="divide-y divide-border border-t border-border">{more.map(row)}</ul>
        </details>
      )}
    </section>
  );
}

export function TopNewsSkeleton() {
  return <div className="h-[120px] animate-pulse rounded-3xl border border-border bg-card" />;
}
