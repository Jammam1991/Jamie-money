// ── What comes back off the pile ─────────────────────────────────────────────
// The gym's security deposit, due back from the landlord.
//
// It lives here rather than in the Debt page because it reduces what went INTO
// the gym, and what went in is what Chris and Jamie split — so the split maths
// in monthlyExtras.ts needs it too. One copy, or the two would drift and the
// same debt would read differently in Settings and on the Debt page.
export const SECURITY_DEPOSIT = 30000;
