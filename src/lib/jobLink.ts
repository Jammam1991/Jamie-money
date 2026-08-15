import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { LinkPreview } from "./jobSearch";

// ── Reading a job link Jamie pasted ──────────────────────────────────────────
// He copies the link from wherever he found the job, and this opens the page
// server-side and lifts out the company, title, pay and location.
//
// Most job pages carry a schema.org "JobPosting" block in their HTML — it's how
// Google for Jobs reads them — so this looks for that first and falls back to
// the page's social-share tags and its <title>.
//
// Indeed is the known miss: it answers outside requests with "forbidden", so
// an Indeed link fills in nothing and he types it by hand. Nothing can be done
// about that from this end.

const MAX_BYTES = 1_500_000;
const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 12_000;

// A browser-ish user agent. Plenty of job boards hand a bare fetch a 403.
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/125.0 Safari/537.36";

// ── Where this is NOT allowed to go ──────────────────────────────────────────
// The URL comes from whoever is typing, so without this the app would happily
// fetch "http://169.254.169.254/" (the cloud metadata service) or something on
// the private network and hand the answer back on screen.

function isBlockedIPv4(ip: string): boolean {
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return true;
  }
  const [a, b] = p;
  if (a === 0) return true; // this network
  if (a === 10) return true; // private
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local + cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 192 && b === 168) return true; // private
  if (a === 192 && b === 0) return true; // protocol assignments
  if (a === 100 && b >= 64 && b <= 127) return true; // carrier NAT
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
  if (a >= 224) return true; // multicast + reserved
  return false;
}

function isBlockedIP(ip: string): boolean {
  const kind = isIP(ip);
  if (kind === 4) return isBlockedIPv4(ip);
  if (kind !== 6) return true;

  const low = ip.toLowerCase();
  // An IPv4 address wearing an IPv6 coat (::ffff:169.254.169.254).
  const mapped = low.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isBlockedIPv4(mapped[1]);
  if (low === "::" || low === "::1") return true; // unspecified + loopback
  if (/^f[cd]/.test(low)) return true; // unique local
  if (/^fe[89ab]/.test(low)) return true; // link-local
  if (/^ff/.test(low)) return true; // multicast
  return false;
}

// Every hop is checked: a public URL that redirects to 127.0.0.1 is exactly
// the trick this is here to stop.
//
// The address is resolved and judged, then fetched by hostname — so in theory a
// name could resolve to something else between the two. Closing that would mean
// dialling the checked IP directly, which fetch() won't do. Behind a login on a
// two-person app, the check is the part that matters.
async function assertReachable(u: URL): Promise<string | null> {
  if (u.protocol !== "https:" && u.protocol !== "http:") {
    return "That link isn't a web address.";
  }
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host)) {
    return isBlockedIP(host) ? "That link points somewhere private." : null;
  }
  if (!host.includes(".") || /\.(local|internal|localhost)$/i.test(host)) {
    return "That link points somewhere private.";
  }
  try {
    const addresses = await lookup(host, { all: true });
    if (!addresses.length) return "Couldn't find that website.";
    if (addresses.some((a) => isBlockedIP(a.address))) {
      return "That link points somewhere private.";
    }
  } catch {
    return "Couldn't find that website.";
  }
  return null;
}

async function readCapped(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    chunks.push(value);
    if (total >= MAX_BYTES) {
      await reader.cancel().catch(() => {});
      break;
    }
  }
  const joined = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    joined.set(c, at);
    at += c.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(joined);
}

async function fetchPage(
  startUrl: URL
): Promise<{ html: string; finalUrl: URL } | { error: string }> {
  let url = startUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const blocked = await assertReachable(url);
    if (blocked) return { error: blocked };

    let res: Response;
    try {
      res = await fetch(url.toString(), {
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: "no-store",
        headers: {
          "User-Agent": UA,
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "en-US,en;q=0.9",
        },
      });
    } catch {
      return { error: "That page didn't answer. Check the link and try again." };
    }

    if (res.status >= 300 && res.status < 400) {
      const next = res.headers.get("location");
      if (!next) return { error: "That link goes nowhere." };
      try {
        url = new URL(next, url);
      } catch {
        return { error: "That link goes nowhere." };
      }
      continue;
    }

    if (res.status === 403 || res.status === 401 || res.status === 429) {
      return {
        error:
          "That site won't let the app read the page (Indeed does this). Type the details in by hand — the link is still saved.",
      };
    }
    if (!res.ok) {
      return { error: `That page came back empty (error ${res.status}).` };
    }

    const type = res.headers.get("content-type") ?? "";
    if (type && !/text\/html|application\/xhtml|text\/plain/i.test(type)) {
      return { error: "That link isn't a job page." };
    }

    return { html: await readCapped(res), finalUrl: url };
  }
  return { error: "That link bounced around too many times." };
}

// ── Lifting the details back out of the page ─────────────────────────────────

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  "#39": "'",
  apos: "'",
  nbsp: " ",
};

function decode(text: string): string {
  return text
    .replace(/&(amp|lt|gt|quot|#39|apos|nbsp);/g, (_, k) => ENTITIES[k] ?? " ")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/\s+/g, " ")
    .trim();
}

const text = (v: unknown): string | null => {
  if (typeof v === "string") {
    const t = decode(v.replace(/<[^>]*>/g, " "));
    return t || null;
  }
  if (typeof v === "number") return String(v);
  return null;
};

function typesOf(node: Record<string, unknown>): string[] {
  const raw = node["@type"];
  if (typeof raw === "string") return [raw];
  if (Array.isArray(raw)) return raw.filter((t): t is string => typeof t === "string");
  return [];
}

// JSON-LD arrives in every shape going: a bare object, an array, or tucked
// inside an "@graph". Walking the whole tree is simpler than guessing.
function findJobPosting(node: unknown, depth = 0): Record<string, unknown> | null {
  if (depth > 6 || !node || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findJobPosting(child, depth + 1);
      if (found) return found;
    }
    return null;
  }
  const obj = node as Record<string, unknown>;
  if (typesOf(obj).includes("JobPosting")) return obj;
  for (const value of Object.values(obj)) {
    if (value && typeof value === "object") {
      const found = findJobPosting(value, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

const UNIT_WORDS: Record<string, string> = {
  HOUR: "an hour",
  DAY: "a day",
  WEEK: "a week",
  MONTH: "a month",
  YEAR: "a year",
};

function readSalary(posting: Record<string, unknown>): string | null {
  const base = posting.baseSalary as Record<string, unknown> | undefined;
  if (!base) return null;
  const value = base.value as Record<string, unknown> | number | undefined;
  const money = (n: unknown): string | null => {
    const v = Number(n);
    return Number.isFinite(v) && v > 0
      ? "$" + Math.round(v).toLocaleString("en-US")
      : null;
  };

  if (typeof value === "number") return money(value);
  if (!value || typeof value !== "object") return null;

  const min = money(value.minValue);
  const max = money(value.maxValue);
  const flat = money(value.value);
  const unit = typeof value.unitText === "string" ? value.unitText.toUpperCase() : "";
  const per = UNIT_WORDS[unit] ? ` ${UNIT_WORDS[unit]}` : "";

  if (min && max && min !== max) return `${min} – ${max}${per}`;
  const single = min || max || flat;
  return single ? `${single}${per}` : null;
}

function readLocation(posting: Record<string, unknown>): string | null {
  const raw = posting.jobLocation;
  const first = Array.isArray(raw) ? raw[0] : raw;
  if (!first || typeof first !== "object") {
    // Fully remote roles use a different property entirely.
    const remote = posting.jobLocationType;
    return typeof remote === "string" && /telecommute/i.test(remote)
      ? "Remote"
      : null;
  }
  const address = (first as Record<string, unknown>).address as
    | Record<string, unknown>
    | undefined;
  if (!address) return null;
  const parts = [
    text(address.addressLocality),
    text(address.addressRegion),
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : text(address.addressCountry);
}

function meta(html: string, property: string): string | null {
  const pattern = new RegExp(
    `<meta[^>]+(?:property|name)=["']${property}["'][^>]*content=["']([^"']*)["']`,
    "i"
  );
  const alt = new RegExp(
    `<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${property}["']`,
    "i"
  );
  const hit = html.match(pattern) ?? html.match(alt);
  return hit ? decode(hit[1]) || null : null;
}

export function extractPreview(html: string, url: string): LinkPreview {
  const preview: LinkPreview = {
    companyName: null,
    roleTitle: null,
    salary: null,
    location: null,
    siteName: meta(html, "og:site_name"),
    url,
  };

  for (const block of html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  )) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(block[1].trim());
    } catch {
      continue; // one malformed block shouldn't sink the rest
    }
    const posting = findJobPosting(parsed);
    if (!posting) continue;

    const org = posting.hiringOrganization as Record<string, unknown> | undefined;
    preview.roleTitle = text(posting.title);
    preview.companyName = text(org?.name);
    preview.salary = readSalary(posting);
    preview.location = readLocation(posting);
    break;
  }

  // Whatever the listing data didn't carry, try to read off the page heading.
  // Filled in field by field rather than all-or-nothing: Greenhouse, for one,
  // publishes a title with no company, and its <title> has the company right
  // there in "… at Acme Spa".
  if (!preview.roleTitle || !preview.companyName) {
    // Both headings get a go, because they often carry different halves:
    // Greenhouse's og:title is the bare role while its <title> is
    // "Job Application for <role> at <company>".
    const headings = [
      meta(html, "og:title"),
      html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? null,
    ].filter((h): h is string => Boolean(h));

    for (const heading of headings) {
      if (preview.roleTitle && preview.companyName) break;
      const { role, company } = splitHeading(decode(heading));
      preview.roleTitle ||= role;
      preview.companyName ||= company;
    }
  }

  return preview;
}

// Job page headings are near-universally "Role at Company" or, on LinkedIn,
// "Company hiring Role in Place".
function splitHeading(clean: string): {
  role: string | null;
  company: string | null;
} {
  const hiring = clean.match(/^(.+?)\s+hiring\s+(.+?)(?:\s+[|\-–]\s+.*)?$/i);
  const at = clean.match(/^(.+?)\s+(?:at|@)\s+(.+?)(?:\s+[|\-–]\s+.*)?$/i);

  let role: string | null;
  let company: string | null = null;
  if (hiring) {
    company = hiring[1].trim();
    role = hiring[2].trim();
  } else if (at) {
    role = at[1].trim();
    company = at[2].trim();
  } else {
    role = clean.split(/\s+[|]\s+/)[0].trim() || clean;
  }

  // Application forms lead with boilerplate; the job title is what follows.
  role = role?.replace(/^job application for\s+/i, "").trim() || null;
  // Trailing punctuation off the end of a company name.
  company = company?.replace(/[,;·|]+$/, "").trim() || null;

  return { role, company };
}

export async function readJobLink(
  rawUrl: string
): Promise<{ ok: true; preview: LinkPreview } | { ok: false; error: string }> {
  const trimmed = rawUrl.trim();
  if (!trimmed) return { ok: false, error: "Paste a link first." };

  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    return { ok: false, error: "That doesn't look like a link." };
  }

  const page = await fetchPage(url);
  if ("error" in page) return { ok: false, error: page.error };

  const preview = extractPreview(page.html, page.finalUrl.toString());
  if (!preview.roleTitle && !preview.companyName) {
    return {
      ok: false,
      error:
        "Couldn't read anything off that page. Type the details in — the link is still saved.",
    };
  }
  return { ok: true, preview };
}
