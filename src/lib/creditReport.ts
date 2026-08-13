// ── The shape of a credit report, as Money App parses it ─────────────────────
// Money App reads the PDF and does all the parsing; this app only displays what
// it found. These types are a copy of Money App's lib/credit-score-factors.ts,
// kept in step by hand — the sync would break loudly (empty sections) if they
// ever drifted, since everything arrives as JSON straight from its API.

export type ScoreFactor = {
  title: string;
  bullets: string[];
};

export type ScoreReasons = {
  helping: ScoreFactor[];
  hurting: ScoreFactor[];
};

export type NegativeKind =
  | "collection"
  | "charge_off"
  | "past_due"
  | "late_payment"
  | "potentially_negative";

export type NegativeItem = {
  name: string;
  kind: NegativeKind;
  status: string | null;
  balance: number | null;
  pastDue: number | null;
  accountType: string | null;
  opened: string | null;
  responsibility: string | null;
  closed: boolean;
};

export const NEGATIVE_KIND_LABEL: Record<NegativeKind, string> = {
  collection: "Collection",
  charge_off: "Charged off",
  past_due: "Past due",
  late_payment: "Late payment",
  potentially_negative: "Potentially negative",
};

export type CreditSummary = {
  openAccounts: number | null;
  closedAccounts: number | null;
  accountsEverLate: number | null;
  collections: number | null;
  averageAccountAge: string | null;
  oldestAccount: string | null;
  creditUsed: number | null;
  creditLimit: number | null;
  usagePct: number | null;
  revolvingDebt: number | null;
  loanDebt: number | null;
  collectionsDebt: number | null;
  totalDebt: number | null;
};

export type CreditInquiry = {
  name: string;
  date: string | null;
  expires: string | null;
  businessType: string | null;
};

export type ReportAccountGroup = "credit_card" | "loan" | "business" | "other";

export type ReportAccount = {
  name: string;
  accountType: string | null;
  group: ReportAccountGroup;
  open: boolean;
  balance: number | null;
  creditLimit: number | null;
  monthlyPayment: number | null;
  responsibility: string | null;
  opened: string | null;
  neverLate: boolean;
  /** What Money App read off the Responsibility line when it parsed the report. */
  authorizedUser?: boolean;
  /** Hand-set in Money App. Wins over what the bureau said. */
  authorizedUserOverride?: boolean | null;
};

// ── Cards that are on the report but aren't his ──────────────────────────────
// An authorized user can spend on someone else's card, so the whole account —
// balance, limit, payment record — lands on their report too. It moves their
// score, but they don't owe the money and the bill isn't theirs.
//
// The bureau says which is which on the Responsibility line: Experian writes
// "Authorized user", TransUnion writes "Authorized account".
const AUTHORIZED_USER_RE = /authoriz(?:ed)?\s*(?:user|account)/i;

/**
 * Is this someone else's account that Jamie can just spend on?
 *
 * Same order of precedence Money App uses, so both apps agree: a mark set by
 * hand wins, then what the parser found, and failing both the stored
 * Responsibility line is read directly — reports saved before Money App had
 * the flag still answer correctly, with no re-import.
 */
export function isAuthorizedUser(a: {
  authorizedUser?: boolean;
  authorizedUserOverride?: boolean | null;
  responsibility?: string | null;
}): boolean {
  if (a.authorizedUserOverride != null) return a.authorizedUserOverride;
  if (a.authorizedUser != null) return a.authorizedUser;
  return a.responsibility ? AUTHORIZED_USER_RE.test(a.responsibility) : false;
}

export const REPORT_GROUP_LABEL: Record<ReportAccountGroup, string> = {
  credit_card: "Credit cards",
  loan: "Loans",
  business: "Business loans",
  other: "Other",
};

// One whole report: the score on that date plus everything the bureau said.
export type ReportSnapshot = {
  date: string;
  score: number | null;
  reasons: ScoreReasons | null;
  negatives: NegativeItem[];
  summary: CreditSummary | null;
  inquiries: CreditInquiry[];
  reportAccounts: ReportAccount[];
};

// ── FICO scoring weights (fixed, published by FICO) ──────────────────────────
export const FICO_WEIGHTS = [
  { key: "payment_history", label: "Payment history", weight: 35 },
  { key: "amounts_owed", label: "Amounts owed", weight: 30 },
  { key: "length_of_history", label: "Length of credit history", weight: 15 },
  { key: "new_credit", label: "New credit", weight: 10 },
  { key: "credit_mix", label: "Credit mix", weight: 10 },
] as const;

// ── Account types, matching Money App's own labels and colours ───────────────
export type DebtType =
  | "credit_card"
  | "auto_loan"
  | "mortgage"
  | "personal_loan"
  | "student_loan"
  | "line_of_credit"
  | "other";

export const DEBT_TYPE_LABEL: Record<DebtType, string> = {
  credit_card: "Credit Card",
  auto_loan: "Auto Loan",
  mortgage: "Mortgage",
  personal_loan: "Personal Loan",
  student_loan: "Student Loan",
  line_of_credit: "Line of Credit",
  other: "Other",
};

export const DEBT_TYPE_COLOR: Record<DebtType, string> = {
  credit_card: "bg-rose-500",
  auto_loan: "bg-amber-500",
  mortgage: "bg-indigo-500",
  personal_loan: "bg-violet-500",
  student_loan: "bg-sky-500",
  line_of_credit: "bg-emerald-500",
  other: "bg-slate-400",
};

export function isDebtType(v: string | null | undefined): v is DebtType {
  return v != null && v in DEBT_TYPE_LABEL;
}

// ── Score bands ──────────────────────────────────────────────────────────────
export function ficoLabel(score: number): string {
  if (score >= 800) return "Exceptional";
  if (score >= 740) return "Very Good";
  if (score >= 670) return "Good";
  if (score >= 580) return "Fair";
  return "Poor";
}

export function ficoColor(score: number): string {
  if (score >= 800) return "text-emerald-600";
  if (score >= 740) return "text-green-600";
  if (score >= 670) return "text-yellow-600";
  if (score >= 580) return "text-orange-500";
  return "text-rose-600";
}

// ── Formatting, matching Money App's ─────────────────────────────────────────
export function fmtMoney(n: number, opts?: { decimals?: number }): string {
  const decimals = opts?.decimals ?? 2;
  return `$${Math.abs(n).toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

// Dates are plain "YYYY-MM-DD" strings, split by hand so a time zone can never
// slide the day backwards.
export function fmtLocalDate(
  iso: string,
  opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" },
): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m) return iso;
  return new Date(y, m - 1, d ?? 1).toLocaleDateString("en-US", opts);
}

export function todayLocalISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}
