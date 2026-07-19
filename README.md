# Jamie's Money

A simple, friendly money app — three pages, mobile-first:

- **Home** — overall "how you're doing" status, net worth, money in/out, recent activity
- **Divorce** — support payments, lawyer costs, what's being split, key dates, documents
- **Debt** — what's owed, paid-off progress, debt-free target

Built with Next.js. Currently shows sample data (`src/lib/data.ts`); the bank feed
(Plaid) and saved details (Supabase) get wired in next.

Runs on its own accounts (Supabase, Vercel, Plaid) — fully separate from any other app.
