-- ── Private loans from Money App ─────────────────────────────────────────────
-- Paste the whole thing into Supabase (SQL Editor → New query → Run).
-- Safe to run again and again — it only adds.
--
-- The "New debt added this year" panel reads `debt_transactions`. Until now
-- that table was filled in by hand and nobody ever filled it, so the panel sat
-- at $0. The sync now writes Money App's "Private Loans:Jamie" transactions
-- into it.
--
-- This column is what stops a re-sync from adding a second copy of every loan:
-- each row remembers which Money App transaction it came from, so a repeat pull
-- updates the same row instead of piling up.
alter table public.debt_transactions add column if not exists moneyapp_tx_id text;

create unique index if not exists debt_transactions_moneyapp_tx_id_key
  on public.debt_transactions (moneyapp_tx_id)
  where moneyapp_tx_id is not null;
