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
    if (name.length < 2 && i > 0) name = cleanName(lines[i - 1]);
    if (name.length < 2) name = "Account";
    name = name.slice(0, 40);

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
