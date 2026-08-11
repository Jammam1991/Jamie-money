-- ── Private loans from Money App ─────────────────────────────────────────────
-- Paste the whole thing into Supabase (SQL Editor → New query → Run).
-- Safe to run again and again — it only creates and adds, never drops.
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

create unique index if not exists debt_transactions_moneyapp_tx_id_key
  on public.debt_transactions (moneyapp_tx_id)
  where moneyapp_tx_id is not null;
