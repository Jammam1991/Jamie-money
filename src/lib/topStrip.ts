// ── The strip across the top of Home: weather, markets, headlines ───────────
// Chris, 2026-11-08: "show weather at the top. show stock exchange ticker, top
// news, at top". All three come from free public feeds that need no key and no
// sign-up, so there's nothing for Admin to set up:
//
//   weather   Open-Meteo (api.open-meteo.com)
//   markets   Yahoo Finance's quote feed (one call for every symbol)
//   news      Google News "Top stories" RSS
//
// Each is cached for a few minutes, so opening Home over and over doesn't hit
// them every time. Each reader returns null when its feed is down or changes
// shape, and Home simply leaves that piece out — a dead feed never breaks the
// page. Server-side only.

import { HOME_TZ } from "./calendar";

// Where the weather is for: Glendale, where the gym is. One place to change it.
export const WEATHER_PLACE = { name: "Glendale", lat: 34.1425, lng: -118.2551 };

// ── Weather ──────────────────────────────────────────────────────────────────

export type Weather = {
  place: string;
  temp: number;
  high: number;
  low: number;
  rainChance: number | null;
  label: string;
  emoji: string;
};

// Open-Meteo's weather codes (the WMO set), as a word and a picture.
function describe(code: number, isDay: boolean): { label: string; emoji: string } {
  if (code === 0) return { label: "Clear", emoji: isDay ? "☀️" : "🌙" };
  if (code === 1 || code === 2) return { label: "Partly cloudy", emoji: isDay ? "⛅" : "☁️" };
  if (code === 3) return { label: "Cloudy", emoji: "☁️" };
  if (code === 45 || code === 48) return { label: "Foggy", emoji: "🌫️" };
  if (code >= 51 && code <= 57) return { label: "Drizzle", emoji: "🌦️" };
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return { label: "Rain", emoji: "🌧️" };
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { label: "Snow", emoji: "❄️" };
  if (code >= 95) return { label: "Storms", emoji: "⛈️" };
  return { label: "", emoji: "🌡️" };
}

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : {});
const first = (v: unknown): number => (Array.isArray(v) ? Number(v[0]) : NaN);

export async function getWeather(): Promise<Weather | null> {
  try {
    const q = new URLSearchParams({
      latitude: String(WEATHER_PLACE.lat),
      longitude: String(WEATHER_PLACE.lng),
      current: "temperature_2m,weather_code,is_day",
      daily: "temperature_2m_max,temperature_2m_min,precipitation_probability_max",
      temperature_unit: "fahrenheit",
      timezone: HOME_TZ,
      forecast_days: "1",
    });
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${q}`, {
      signal: AbortSignal.timeout(5000),
      next: { revalidate: 900 },
    });
    if (!res.ok) return null;
    const data = obj(await res.json());
    const now = obj(data.current);
    const day = obj(data.daily);
    const temp = Number(now.temperature_2m);
    const high = first(day.temperature_2m_max);
    const low = first(day.temperature_2m_min);
    if (![temp, high, low].every(Number.isFinite)) return null;
    const rain = first(day.precipitation_probability_max);
    return {
      place: WEATHER_PLACE.name,
      temp: Math.round(temp),
      high: Math.round(high),
      low: Math.round(low),
      rainChance: Number.isFinite(rain) ? Math.round(rain) : null,
      ...describe(Number(now.weather_code), now.is_day !== 0),
    };
  } catch {
    return null;
  }
}

// ── Markets ──────────────────────────────────────────────────────────────────

export type Quote = { symbol: string; label: string; price: number; changePct: number; kind: "index" | "money" | "rate" };

// What runs along the ticker, in order. The 10-year rate is there because it's
// what mortgage rates follow.
const SYMBOLS: { symbol: string; label: string; kind: Quote["kind"] }[] = [
  { symbol: "^GSPC", label: "S&P 500", kind: "index" },
  { symbol: "^DJI", label: "Dow", kind: "index" },
  { symbol: "^IXIC", label: "Nasdaq", kind: "index" },
  { symbol: "BTC-USD", label: "Bitcoin", kind: "money" },
  { symbol: "GC=F", label: "Gold", kind: "money" },
  { symbol: "CL=F", label: "Oil", kind: "money" },
  { symbol: "^TNX", label: "10-yr rate", kind: "rate" },
];

export async function getMarkets(): Promise<Quote[] | null> {
  try {
    const q = new URLSearchParams({ symbols: SYMBOLS.map((s) => s.symbol).join(","), range: "1d", interval: "1d" });
    const res = await fetch(`https://query1.finance.yahoo.com/v7/finance/spark?${q}`, {
      // Yahoo turns away requests that don't look like a browser.
      headers: { "User-Agent": "Mozilla/5.0 (compatible; JamiesMoney/1.0)" },
      signal: AbortSignal.timeout(5000),
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    const results = obj(obj(await res.json()).spark).result;
    if (!Array.isArray(results)) return null;
    const bySymbol = new Map<string, Obj>();
    for (const r of results) {
      const meta = obj(obj(Array.isArray(obj(r).response) ? (obj(r).response as unknown[])[0] : null).meta);
      bySymbol.set(String(obj(r).symbol), meta);
    }
    const quotes: Quote[] = [];
    for (const s of SYMBOLS) {
      const m = bySymbol.get(s.symbol);
      const price = Number(m?.regularMarketPrice);
      const prev = Number(m?.chartPreviousClose ?? m?.previousClose);
      if (!Number.isFinite(price) || price <= 0) continue;
      const changePct = Number.isFinite(prev) && prev > 0 ? ((price - prev) / prev) * 100 : 0;
      quotes.push({ ...s, price, changePct });
    }
    return quotes.length ? quotes : null;
  } catch {
    return null;
  }
}

// ── News ─────────────────────────────────────────────────────────────────────

export type Headline = { title: string; source: string; url: string; publishedAt: string | null };

function decode(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .trim();
}

const tag = (item: string, name: string): string => {
  const m = item.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`));
  return m ? decode(m[1]) : "";
};

export async function getNews(limit = 8): Promise<Headline[] | null> {
  try {
    const res = await fetch("https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en", {
      signal: AbortSignal.timeout(5000),
      next: { revalidate: 900 },
    });
    if (!res.ok) return null;
    const xml = await res.text();
    const items = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
    const out: Headline[] = [];
    for (const item of items) {
      const source = tag(item, "source");
      let title = tag(item, "title");
      const url = tag(item, "link");
      if (!title || !url.startsWith("https://")) continue;
      // Google puts the paper's name on the end of every title ("… - Axios");
      // it's shown on its own line, so it comes off here.
      if (source && title.endsWith(` - ${source}`)) title = title.slice(0, -(source.length + 3));
      const date = tag(item, "pubDate");
      const t = date ? new Date(date) : null;
      out.push({ title, source, url, publishedAt: t && !Number.isNaN(t.getTime()) ? t.toISOString() : null });
      if (out.length >= limit) break;
    }
    return out.length ? out : null;
  } catch {
    return null;
  }
}
