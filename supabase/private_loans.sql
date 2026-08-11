-- ── Private loans from Money App ─────────────────────────────────────────────
-- Paste the whole thing into Supabase (SQL Editor → New query → Run).
-- Safe to run again and again. It drops nothing but an index it rebuilds a
-- line later — no table and no row is ever removed.
--
-- The "New debt added this year" panel reads `debt_transactions`. Until now
-- that table was filled in by hand and nobody ever filled it, so the panel sat
-- at $0. The sync now writes Money App's "Private Loans:Jamie" transactions
-- into it.
--
-- This file stands on its own: it creates the table if it was never created,
-- then adds the column the sync needs. Running debt_transactions.sql first is
-- not required (and running it afterwards is harmless).

-- ── 1. The table itself ──────────────────────────────────────────────────────
-- The individual charges and loans that add up to Jamie's debt, so the page can
-- drill down year → month → transaction and show where the debt came from.
create table if not exists public.debt_transactions (
  id uuid primary key default gen_random_uuid(),
  tx_date text not null, -- YYYY-MM-DD
  description text not null,
  amount numeric(12,2) not null,
  source text, -- which card, loan, or "Private loan" it landed on
  created_at timestamptz not null default now()
);

alter table public.debt_transactions enable row level security;

-- ── 2. The link back to Money App ────────────────────────────────────────────
-- This column is what stops a re-sync from adding a second copy of every loan:
-- each row remembers which Money App transaction it came from, so a repeat pull
-- updates the same row instead of piling up.
alter table public.debt_transactions add column if not exists moneyapp_tx_id text;

-- The index has to be a plain one, not `where moneyapp_tx_id is not null`.
-- Postgres won't match a partial index to an "update the row if it's already
-- there" write unless the write repeats the index's own condition, which the
-- sync has no way to do — it fails with "no unique or exclusion constraint
-- matching the ON CONFLICT specification". A plain unique index still allows
-- any number of rows with no Money App id, which is what the partial one was
-- there for, so nothing is lost.
--
-- The drop is only ever removing the partial version left by an earlier run of
-- this file. Dropping an index touches no rows.
drop index if exists public.debt_transactions_moneyapp_tx_id_key;

create unique index if not exists debt_transactions_moneyapp_tx_id_key
  on public.debt_transactions (moneyapp_tx_id);
