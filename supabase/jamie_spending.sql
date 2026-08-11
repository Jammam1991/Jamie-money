-- ── Money spent on Jamie that isn't a loan ───────────────────────────────────
-- Paste the whole thing into Supabase (SQL Editor → New query → Run).
-- Safe to run again and again — it only creates and adds, nothing is dropped.
--
-- Some of what Chris spends on Jamie was never treated as a loan: gifts, and
-- anything else filed under his name in Money App. It isn't debt and must never
-- be added to a debt total, so it gets its own table rather than sharing
-- `debt_transactions` and being filtered out everywhere it would otherwise
-- creep into a sum.
--
-- This file stands on its own — nothing else has to have been run first.
create table if not exists public.jamie_spending (
  id uuid primary key default gen_random_uuid(),
  -- Which Money App transaction this came from. A re-sync updates the same row
  -- instead of adding a second copy of every gift.
  moneyapp_tx_id text,
  tx_date text not null, -- YYYY-MM-DD
  description text not null,
  amount numeric(12,2) not null,
  source text, -- which of Chris's accounts it came out of
  created_at timestamptz not null default now()
);

alter table public.jamie_spending enable row level security;

-- Plain, not partial. Postgres won't match a partial index to an "update it if
-- it's already there" write, which is what the sync does.
create unique index if not exists jamie_spending_moneyapp_tx_id_key
  on public.jamie_spending (moneyapp_tx_id);

create index if not exists jamie_spending_date_idx
  on public.jamie_spending (tx_date desc);
