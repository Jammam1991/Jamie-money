// Best-effort reader for credit-report text.
// Credit reports come in every shape imaginable, so this makes educated
// guesses and the app always shows them for Jamie to fix before saving.

export type ParsedDebt = {
  name: string;
  balance: number;
  apr: number;
  minPayment: number;
};

const MONEY = /\$?\s?(\d{1,3}(?:,\d{3})+(?:\.\d{2})?|\d+(?:\.\d{2})?)/;
const PERCENT = /(\d{1,2}(?:\.\d{1,2})?)\s?%/;
// A minimum payment stated near a "min"/"payment" label.
const MIN_PAY =
  /(?:min(?:imum)?|pmt|payment)[^\d$]*\$?\s?(\d[\d,]*(?:\.\d{2})?)/i;

function toNumber(raw: string): number {
  return Number(raw.replace(/,/g, ""));
}

// Headings, totals, score words, and page furniture that carry a dollar amount
// but are NOT a debt. Without this the reader grabs rows like "Total 149,347",
// "Fair 300", "credit usage 75", or "As of today 625".
const NOISE =
  /^(total|subtotal|overall|balance|current balance|total balance|amount owed|as of|as of today|updated|last updated|credit usage|credit used|credit limit|credit line|available credit|utilization|score|fico|vantage|good|fair|poor|excellent|exceptional|very good|open accounts?|closed accounts?|account summary|debt summary|accounts?|revolving|installment|mortgages?|auto loans?|student loans?|personal loans?|collections?|inquiries?|public records?|payment history|on time|monthly payment|minimum payment|link card name|what'?s this|number|type)$/i;

// True when the leftover text really looks like an account/lender name:
// has letters, isn't a known heading, and isn't just one throwaway word.
function looksLikeAccount(name: string): boolean {
  const n = name.trim();
  if (n.length < 3) return false;
  if (!/[a-z]/i.test(n)) return false;
  if (NOISE.test(n)) return false;
  return true;
}

// Strip labels, numbers, percents, and stray punctuation so what's left of the
// line can serve as the account name.
function cleanName(line: string): string {
  return line
    .replace(/\$?\s?\d[\d,]*(?:\.\d+)?/g, " ") // dollar amounts / any number
    .replace(/%/g, " ")
    .replace(
      /\b(balance|bal|apr|interest|rate|minimum|min|payment|pmt|due|current|acct|account|no|number)\b/gi,
      " "
    )
    .replace(/[^a-zA-Z0-9 &/'-]/g, " ") // drop . : - | and other punctuation
    .replace(/\s+/g, " ")
    .trim();
}

export function parseReportText(text: string): ParsedDebt[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  // Experian's website copies each account as a block that starts with the
  // lender name and a "Link card name" row. When we see that shape, parse it
  // directly — it's far more reliable than guessing line-by-line, and it
  // naturally skips the summary rows (Total, Fair, credit usage) that have no
  // "Link card name" above them. Only fall back to the loose scanner for other
  // formats (bank statements, PDFs) that don't use these anchors.
  const experian = parseExperianBlocks(lines);
  if (experian !== null) return experian;

  const out: ParsedDebt[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const moneyMatch = line.match(MONEY);
    if (!moneyMatch) continue;

    const balance = toNumber(moneyMatch[1]);
    // Ignore tiny amounts and obvious non-balances.
    if (!Number.isFinite(balance) || balance < 50) continue;

    // Name: text on this line, or the line above if this line is just a number.
    let name = cleanName(line);
    if (!looksLikeAccount(name) && i > 0) name = cleanName(lines[i - 1]);
    name = name.slice(0, 40);

    // Skip headings, totals, and score words — they carry a number but aren't
    // a real debt. Better to miss a row than to import junk Jamie must delete.
    if (!looksLikeAccount(name)) continue;

    // Interest rate: look on this line and the next for a percentage.
    const pctMatch = line.match(PERCENT) || lines[i + 1]?.match(PERCENT);
    const apr = pctMatch ? Number(pctMatch[1]) : 0;

    // Minimum payment: use the stated amount if we can find one, otherwise a
    // rough 2% of the balance. Never more than the balance itself.
    const minMatch = line.match(MIN_PAY);
    const statedMin = minMatch ? toNumber(minMatch[1]) : NaN;
    const minPayment = Number.isFinite(statedMin)
      ? Math.min(balance, statedMin)
      : Math.min(balance, Math.max(25, Math.round(balance * 0.02)));

    const key = `${name.toLowerCase()}|${balance}`;
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({ name, balance, apr, minPayment });
    if (out.length >= 30) break;
  }

  return out;
}

// Parse the Experian web copy-paste format. Each account block looks like:
//   LENDER NAME
//   Link card name
//   ...
//   Balance
//   $X,XXX          (or "Balance $X,XXX" on one line)
//   Balance updated
//   Month DD, YYYY
// Returns null when the text has no "Link card name" anchors at all, so the
// caller knows to fall back to the generic line scanner.
function parseExperianBlocks(lines: string[]): ParsedDebt[] | null {
  const isAnchor = (l: string) => /^link card name$/i.test(l);
  if (!lines.some(isAnchor)) return null;

  const out: ParsedDebt[] = [];
  const seen = new Set<string>();

  for (let i = 1; i < lines.length; i++) {
    if (!isAnchor(lines[i])) continue;

    const name = cleanName(lines[i - 1]).slice(0, 40);
    if (!looksLikeAccount(name)) continue;

    let balance: number | null = null;
    let apr = 0;
    let minPayment: number | null = null;
    const stop = Math.min(lines.length, i + 30);

    for (let j = i + 1; j < stop; j++) {
      const l = lines[j];
      if (isAnchor(l)) break; // next account block

      // "Balance $1,234" on one line (but not "Balance updated").
      const balSame = l.match(/^balance\s*\$?\s?([\d,]+(?:\.\d{2})?)/i);
      if (balSame && !/updated/i.test(l)) {
        const v = toNumber(balSame[1]);
        if (Number.isFinite(v)) balance = v;
        continue;
      }
      // "Balance" alone, amount on the next line.
      if (/^balance$/i.test(l)) {
        const next = lines[j + 1] ?? "";
        const m = next.match(MONEY);
        if (m && !/updated/i.test(next)) {
          const v = toNumber(m[1]);
          if (Number.isFinite(v)) balance = v;
        }
        continue;
      }
      // Minimum / monthly payment — amount on the same line…
      const minM = l.match(/^(?:min(?:imum)?|monthly)\s*payment\s*\$?\s?([\d,]+(?:\.\d{2})?)/i);
      if (minM) {
        const v = toNumber(minM[1]);
        if (Number.isFinite(v)) minPayment = v;
        continue;
      }
      // …or on the line below the "Minimum payment" label.
      if (/^(?:min(?:imum)?|monthly)\s*payment$/i.test(l)) {
        const m = (lines[j + 1] ?? "").match(MONEY);
        if (m) {
          const v = toNumber(m[1]);
          if (Number.isFinite(v)) minPayment = v;
        }
        continue;
      }
      // Interest rate.
      if (apr === 0) {
        const pct = l.match(PERCENT);
        if (pct) apr = Number(pct[1]);
      }
    }

    if (balance === null || balance < 1) continue;

    const min =
      minPayment !== null
        ? Math.min(balance, minPayment)
        : Math.min(balance, Math.max(25, Math.round(balance * 0.02)));

    const key = `${name.toLowerCase()}|${balance}`;
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({ name, balance, apr, minPayment: min });
    if (out.length >= 30) break;
  }

  return out;
}
