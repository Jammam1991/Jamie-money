import type { DebtTransaction } from "./store";

// ── What the borrowed money actually went on ─────────────────────────────────
// Money App sends a payee name and nothing else — there's no category column
// anywhere in the chain. So the category is read off the payee, which is a
// guess and is labelled as one on screen.
//
// The guess is only ever used to *group* rows, never to change a number. Every
// transaction keeps its real payee, date and account underneath, so a row filed
// under the wrong heading is a tidying mistake and not a money mistake — and
// anything unrecognised lands in "Everything else" rather than being forced
// into a category that sounds plausible.
//
// Colours are the light end of the palette: these are headings inside a card,
// not warnings, and the page already spends its strong colour on the totals.

export type Category = {
  key: string;
  emoji: string;
  label: string;
  color: string; // the dot and the bar
  tint: string; // the row behind it
};

const CATEGORIES = {
  rent: { key: "rent", emoji: "🔑", label: "Rent Expenses", color: "#5f6bc4", tint: "#ecedfb" },
  home: { key: "home", emoji: "🏠", label: "Home & repairs", color: "#7c5cd6", tint: "#f1ecfd" },
  car: { key: "car", emoji: "🚗", label: "Car & fuel", color: "#3b82b8", tint: "#e9f3fa" },
  food: { key: "food", emoji: "🍔", label: "Food & groceries", color: "#c98a2e", tint: "#fbf1e2" },
  health: { key: "health", emoji: "🏥", label: "Health & medical", color: "#2e9e7e", tint: "#e6f6f0" },
  shopping: { key: "shopping", emoji: "🛍️", label: "Shopping", color: "#c96591", tint: "#fbebf2" },
  kids: { key: "kids", emoji: "🎒", label: "Kids & school", color: "#5b9bd5", tint: "#eaf3fb" },
  pets: { key: "pets", emoji: "🐾", label: "Pets", color: "#a08154", tint: "#f5efe6" },
  travel: { key: "travel", emoji: "✈️", label: "Travel", color: "#4f97a3", tint: "#e9f4f6" },
  bills: { key: "bills", emoji: "📱", label: "Bills & subscriptions", color: "#6b8fa8", tint: "#edf3f7" },
  legal: { key: "legal", emoji: "⚖️", label: "Legal & professional", color: "#8a8fa3", tint: "#f0f1f5" },
  debt: { key: "debt", emoji: "💳", label: "Card & loan payments", color: "#cc6f68", tint: "#fbecea" },
  cash: { key: "cash", emoji: "💵", label: "Cash & transfers", color: "#7fa05a", tint: "#f0f5e8" },
  other: { key: "other", emoji: "📦", label: "Everything else", color: "#9a9891", tint: "#f2f1ed" },
} as const satisfies Record<string, Category>;

// First rule that matches wins, so the specific ones come before the loose
// ones — "Vet" has to be tested before "et al", and a card payment has to beat
// the shop the card is named after.
const RULES: { test: RegExp; category: Category }[] = [
  { test: /\b(vet|veterinar|petco|petsmart|chewy|groomer?|kennel)\b/i, category: CATEGORIES.pets },
  // Car rental reads as "rent" but is a car cost, so it's settled before the
  // rent rule gets a chance at it.
  { test: /\b(shell|chevron|exxon|mobil|arco|bp|76|texaco|costco gas|gas(oline)?|fuel|dmv|smog|auto ?zone|o'?reilly|jiffy ?lube|mechanic|tire|car ?wash|parking|toll|uber|lyft|porsche|taycan|enterprise rent|hertz|avis|budget rent|car rental)\b/i, category: CATEGORIES.car },
  // Rent has its own heading rather than sitting inside "Home": it's the
  // biggest fixed thing borrowed for, and burying it next to a trip to the
  // hardware shop hid that.
  //
  // Two landlords are named outright because neither can be reached by a
  // general rule. "Earnest Homes" says nothing about rent at all, and
  // "Lexonorangerent" buries the word inside a longer one, where `\brent\b`
  // can't see it. A loose /rent/ with no boundaries would reach it — and would
  // also swallow "parent", "current" and "Parents Magazine", so it stays out.
  // No word boundaries on this one: "orangerent" sits mid-word inside
  // "Lexonorangerent", where a boundary would never match. These strings are
  // specific enough that matching them anywhere is safe.
  { test: /(earnest\s*homes?|orange\s*rent)/i, category: CATEGORIES.rent },
  { test: /\b(rent|rents|rental|rentals|landlord|leasing|apartments?|apt|hoa|property manage(ment)?|realty|prop(erty)? mgmt)\b/i, category: CATEGORIES.rent },
  { test: /\b(mortgage|lease|storage|home ?depot|lowe'?s|ikea|furniture|plumb|electric(ian)?|roof|hvac|handyman|cleaner|maid|lawn|garden)\b/i, category: CATEGORIES.home },
  { test: /\b(kaiser|cvs|walgreens|rite ?aid|pharmac|dental|dentist|doctor|dr\.|medical|clinic|hospital|urgent ?care|therap|optometr|vision|orthodont|lab ?corp|quest diagnostic)\b/i, category: CATEGORIES.health },
  { test: /\b(safeway|kroger|trader ?joe|whole ?foods|sprouts|aldi|ralphs|vons|albertsons|grocer|market|restaurant|cafe|coffee|starbucks|doordash|grubhub|uber ?eats|postmates|pizza|taco|sushi|diner|bar ?& ?grill|mcdonald|chipotle)\b/i, category: CATEGORIES.food },
  { test: /\b(school|tuition|daycare|childcare|camp|college|university|student|book ?store|sport|soccer|dance|piano|tutor)\b/i, category: CATEGORIES.kids },
  { test: /\b(airline|airfare|flight|delta|united|southwest|american air|hotel|motel|marriott|hilton|hyatt|airbnb|vrbo|resort|cruise|expedia|booking\.com|travel|vacation)\b/i, category: CATEGORIES.travel },
  { test: /\b(payment|autopay|min(imum)? (pay|due)|card ?payment|loan ?payment|interest|finance ?charge|late ?fee|chase|amex|american express|capital ?one|discover|citi|synchrony|us ?bank|wells ?fargo|bank of america|jpmcb|apple ?card)\b/i, category: CATEGORIES.debt },
  { test: /\b(attorney|lawyer|legal|court|filing ?fee|notary|accountant|cpa|tax ?prep|irs|ftb|franchise ?tax|bookkeep)\b/i, category: CATEGORIES.legal },
  { test: /\b(at&?t|verizon|t-?mobile|comcast|xfinity|spectrum|internet|phone|netflix|spotify|hulu|disney|apple\.com|icloud|google|amazon prime|subscription|insurance|geico|state ?farm|progressive|allstate|utility|utilities|water|pg&?e|sce|edison|sewer|trash|waste)\b/i, category: CATEGORIES.bills },
  { test: /\b(atm|cash|withdraw|venmo|zelle|paypal|cash ?app|transfer|wire|check ?#?\d|money ?order)\b/i, category: CATEGORIES.cash },
  { test: /\b(amazon|target|walmart|nordstrom|macy|bloomingdale|nike|lululemon|sephora|ulta|best ?buy|apple ?store|ebay|etsy|shein|tj ?maxx|marshalls|ross|clothing|shoes)\b/i, category: CATEGORIES.shopping },
];

export function categorize(tx: DebtTransaction): Category {
  // The payee is what the charge says it was for; the account it landed on is
  // only where it was put, so it's checked second and only for the rules where
  // the account name is genuinely the answer.
  const text = tx.description ?? "";
  for (const rule of RULES) if (rule.test.test(text)) return rule.category;
  return CATEGORIES.other;
}

export type CategoryGroup = {
  category: Category;
  total: number;
  items: DebtTransaction[];
};

// Every transaction filed under a heading, biggest spend first, with the rows
// inside each heading newest first. "Everything else" is sorted with the rest
// rather than pinned last — if it's the biggest thing here, that's worth
// seeing rather than hiding at the bottom.
export function groupByCategory(txs: DebtTransaction[]): CategoryGroup[] {
  const groups = new Map<string, CategoryGroup>();
  for (const tx of txs) {
    const category = categorize(tx);
    const held = groups.get(category.key);
    if (held) {
      held.total += tx.amount;
      held.items.push(tx);
    } else {
      groups.set(category.key, { category, total: tx.amount, items: [tx] });
    }
  }
  return [...groups.values()]
    .map((g) => ({
      ...g,
      items: [...g.items].sort((a, b) => b.txDate.localeCompare(a.txDate)),
    }))
    .sort((a, b) => b.total - a.total);
}
