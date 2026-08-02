// Real bill statements, typed out line for line from the paper/PDF bill so the
// numbers can be read right inside the app instead of hunting for the email.
// These are fixed records of a month that already happened — they're kept here
// rather than in the database because nobody edits them after the fact.

export type StatementLine = {
  label: string;
  period?: string; // the dates the charge covers, e.g. "08/01/2026 - 08/31/2026"
  amount: number;
};

export type StatementSection = {
  title: string;
  lines: StatementLine[];
  totalLabel: string;
  total: number;
};

export type BillStatement = {
  month: string; // "2026-08" — which month's bill this is
  monthLabel: string; // "August 2026"
  sections: StatementSection[];
  totalCurrentLabel: string;
  totalCurrent: number;
  priorBalanceLabel: string;
  priorBalance: number;
  grandTotal: number;
  plainEnglish: string; // one-line "what this actually means" for Jamie
};

// Keyed by the kind of bill, not by a database id, so it still lines up if the
// bill row is ever re-created.
const STATEMENTS: Record<"rent", BillStatement[]> = {
  rent: [
    {
      month: "2026-08",
      monthLabel: "August 2026",
      sections: [
        {
          title: "Rent and lease charges",
          lines: [
            {
              label: "Concession",
              period: "08/01/2026 - 08/31/2026",
              amount: -3181,
            },
            {
              label: "Rent",
              period: "08/01/2026 - 08/31/2026",
              amount: 3181,
            },
          ],
          totalLabel: "Rent and leasing charges due 08/01/2026",
          total: 0,
        },
        {
          title: "Utility charges",
          lines: [
            {
              label: "Trash",
              period: "06/25/2026 - 06/30/2026",
              amount: 6.29,
            },
          ],
          totalLabel: "Utility charges due 08/01/2026",
          total: 6.29,
        },
      ],
      totalCurrentLabel: "Total current charges",
      totalCurrent: 6.29,
      priorBalanceLabel: "Prior balance as of 07/17/2026",
      priorBalance: 0,
      grandTotal: 6.29,
      plainEnglish:
        "The $3,181 rent was completely covered by a credit from the apartment, so the only thing owed for August is $6.29 of trash pickup.",
    },
  ],
};

// Match a bill to its statements by name, the same loose way the bill emoji is
// picked, so "Rent", "Apartment rent", etc. all find them.
export function statementsForBill(billName: string): BillStatement[] {
  if (/rent|apartment/i.test(billName)) return STATEMENTS.rent;
  return [];
}
