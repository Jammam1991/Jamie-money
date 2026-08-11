// ── Finding the hand-entered debts that Money App has since taken over ───────
//
// The sync only adds and updates, never deletes — deleting rows on the strength
// of another app's export is how a real debt someone typed in by hand quietly
// disappears. So when Money App started sending accounts that were already on
// the page under different names, both copies stayed, and the total counted
// them twice.
//
// This works out which hand-entered rows *look* superseded. It only suggests:
// nothing is deleted without being shown and ticked first, because the names
// rarely line up exactly ("Car loan" vs "US Bank Auto Loan (JM)") and a guess
// that overreaches costs more than one that misses.

export type DebtRow = {
  id: string;
  name: string;
  balance: number;
  minPayment: number;
  fromMoneyApp: boolean;
};

export type CleanupCandidate = {
  id: string;
  name: string;
  balance: number;
  // The synced account it appears to duplicate, if we can tell. Null means
  // "nothing obvious matched" — the row is still listed, just not pre-ticked.
  matches: string | null;
};

// Words that say what kind of account it is rather than which one, so they
// can't tell two accounts apart. Without this, every row containing "card"
// matches every other row containing "card".
const GENERIC = new Set([
  "card",
  "cards",
  "loan",
  "loans",
  "bank",
  "banks",
  "credit",
  "line",
  "account",
  "the",
  "of",
  "and",
  "a",
  "us",
  "usa",
  "na",
  "inc",
  "jm",
  "my",
  "auto",
  "mortgage",
  "personal",
]);

// The words in a name that actually identify the lender: lowercased, stripped
// of punctuation, with the generic ones dropped. "APPLE CARD/GS BANK USA"
// becomes {apple, gs}.
function identifyingWords(name: string): Set<string> {
  return new Set(
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .split(" ")
      .filter((w) => w.length > 1 && !GENERIC.has(w)),
  );
}

// Which hand-entered rows look like duplicates of a synced one, most-owed
// first. Every manual row comes back — the ones we can't match are listed with
// `matches: null` so they can still be ticked by hand.
export function findCleanupCandidates(debts: DebtRow[]): CleanupCandidate[] {
  const synced = debts.filter((d) => d.fromMoneyApp);
  const manual = debts.filter((d) => !d.fromMoneyApp);

  return manual
    .map((row) => {
      const words = identifyingWords(row.name);
      // A shared identifying word is enough — "Capital One Card" and "CAPITAL
      // ONE" share two, "Apple Card" and "APPLE CARD/GS BANK USA" share one.
      const hit = synced.find((s) => {
        const other = identifyingWords(s.name);
        for (const w of words) if (other.has(w)) return true;
        return false;
      });
      return {
        id: row.id,
        name: row.name,
        balance: row.balance,
        matches: hit ? hit.name : null,
      };
    })
    .sort((a, b) => b.balance - a.balance);
}
