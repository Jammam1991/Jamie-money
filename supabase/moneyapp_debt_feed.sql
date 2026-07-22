-- Jamie's Money — Money App debt feed.
-- Paste this into Jamie's Supabase project (SQL Editor → New query → Run).
-- Safe to run more than once. No sensitive data here — just table shape.

-- ── Tie a debt row to a Money App account ─────────────────────────────────────
-- Lets a re-sync update the same debt in place instead of adding copies.
-- The `source` column already exists (added by plaid_bank_feed.sql) and is
-- reused here with the value 'moneyapp'.
alter table public.debts add column if not exists moneyapp_debt_id text;

create unique index if not exists debts_moneyapp_debt_id_key
  on public.debts (moneyapp_debt_id)
  where moneyapp_debt_id is not null;
