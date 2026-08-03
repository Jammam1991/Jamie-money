-- Credit Report page: a read-only mirror of the credit data Money App already
-- keeps. Nothing here is typed in by hand — the "Sync from Money App" button
-- refills both tables from Money App's /api/debt/export. Run this once in the
-- Supabase SQL editor.
--
-- Debt balances themselves are NOT mirrored here; the existing Money App sync
-- already writes those into `debts` (keyed by moneyapp_debt_id), and the
-- snapshots below join back to that table for account names.

-- ── Credit-score history ──────────────────────────────────────────────────────
-- One row per score check. The date is the key, so a re-sync updates a score
-- in place instead of adding a duplicate.
create table if not exists public.moneyapp_fico_history (
  scored_on date primary key,
  score integer not null check (score between 300 and 850),
  note text,
  synced_at timestamptz not null default now()
);

alter table public.moneyapp_fico_history enable row level security;

-- ── Balance snapshots ─────────────────────────────────────────────────────────
-- Money App writes one row per account each time a credit report is imported,
-- so grouping these by date gives back the report history.
create table if not exists public.moneyapp_debt_snapshots (
  id uuid primary key default gen_random_uuid(),
  moneyapp_debt_id text not null,
  snapshot_date date not null,
  balance numeric(14,2) not null default 0,
  missed_payment boolean not null default false,
  note text,
  synced_at timestamptz not null default now(),
  unique (moneyapp_debt_id, snapshot_date)
);

alter table public.moneyapp_debt_snapshots enable row level security;

create index if not exists moneyapp_debt_snapshots_date_idx
  on public.moneyapp_debt_snapshots (snapshot_date desc);

-- ── Clean up the first attempt ────────────────────────────────────────────────
-- The Credit Report page originally parsed uploaded PDFs itself into these
-- three tables. Money App does that job better, so the page now mirrors it
-- instead. These are dropped rather than left behind to rot; if they were
-- never created, this does nothing.
drop table if exists public.credit_report_accounts;
drop table if exists public.fico_scores;
drop table if exists public.credit_reports;
