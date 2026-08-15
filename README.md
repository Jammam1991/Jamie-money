# Jamie's Money

A simple, friendly money app — three pages, mobile-first:

- **Home** — overall "how you're doing" status, net worth, money in/out, recent activity
- **Divorce** — support payments, lawyer costs, what's being split, key dates, documents
- **Debt** — what's owed, paid-off progress, debt-free target

Built with Next.js. Currently shows sample data (`src/lib/data.ts`); the bank feed
(Plaid) and saved details (Supabase) get wired in next.

Runs on its own accounts (Supabase, Vercel, Plaid) — fully separate from any other app.

## Setting up the Career page

1. **Database** — run `supabase/career.sql` in Supabase (SQL Editor → New query → Run).
   Safe to run more than once. Until this is done the page opens fine but every
   save says so in plain words.

2. **Job search** (optional) — add these in Vercel → Settings → Environment
   Variables, then redeploy. Whatever is set gets used; with none set the page
   says searching isn't switched on and everything else still works.

   | Variable | Where to get it |
   | --- | --- |
   | `ADZUNA_APP_ID` + `ADZUNA_APP_KEY` | [developer.adzuna.com](https://developer.adzuna.com/) — instant, free, ~1,000 searches a month |
   | `ADZUNA_COUNTRY` | Two-letter country code. Defaults to `us` if unset |
   | `JOOBLE_API_KEY` | [jooble.org/api/about](https://jooble.org/api/about) — free, sent by email after a short form |

**Why not Indeed or LinkedIn directly?** Indeed closed its public job API to new
builders in 2024 and blocks server requests outright; LinkedIn's jobs API has
been partner-only since 2015 and isn't accepting new partners. The aggregators
above carry listings syndicated from many of the same boards, and pasting a job
link works on most sites either way.
