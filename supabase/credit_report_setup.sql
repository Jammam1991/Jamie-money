-- ── Credit Report: the one file to run ───────────────────────────────────────
-- Paste the whole thing into Supabase (SQL Editor → New query → Run).
-- Safe to run again and again.
--
-- This replaces credit_reports.sql and credit_reports_full.sql — it does
-- everything both of them did, so if either one errored part-way through, this
-- picks up whatever is missing and leaves what's already there alone.
--
-- It only CREATES and ADDS. Nothing is dropped, which is the whole point: the
-- earlier file ended with `drop table` lines, and a drop that trips over
-- something depending on it fails the entire script — including the tables it
-- had not created yet.

-- ── 1. Columns the Money App sync writes onto `debts` ────────────────────────
alter table public.debts add column if not exists apr numeric(6,2) not null default 0;
alter table public.debts add column if not exists min_payment numeric(12,2) not null default 0;
alter table public.debts add column if not exists source text not null default 'manual';
alter table public.debts add column if not exists moneyapp_debt_id text;
alter table public.debts add column if not exists debt_type text;
alter table public.debts add column if not exists opened_date date;
alter table public.debts add column if not exists credit_report_day integer;
alter table public.debts add column if not exists notes text;

-- Ties a debt row to its Money App account, so a re-pull updates the same row
-- instead of adding a copy.
create unique index if not exists debts_moneyapp_debt_id_key
  on public.debts (moneyapp_debt_id)
  where moneyapp_debt_id is not null;

-- ── 2. Credit-score history ──────────────────────────────────────────────────
-- One row per score check. The date is the key, so a re-pull updates a score in
-- place instead of adding a duplicate.
create table if not exists public.moneyapp_fico_history (
  scored_on date primary key,
  score integer not null check (score between 300 and 850),
  note text,
  synced_at timestamptz not null default now()
);

alter table public.moneyapp_fico_history enable row level security;

-- ── 3. Balance snapshots ─────────────────────────────────────────────────────
-- Money App writes one row per account each time a credit report is imported.
-- These are the payment squares and the "as of an older report" balances.
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

-- ── 4. The parsed credit reports ─────────────────────────────────────────────
-- Score factors, negative items, the at-a-glance summary, hard inquiries and
-- the bureau's own account list — stored exactly as Money App parsed them.
create table if not exists public.moneyapp_credit_reports (
  report_date date primary key,
  score integer,
  reasons jsonb,     -- { helping: [...], hurting: [...] }
  negatives jsonb,   -- [{ name, kind, status, balance, pastDue, ... }]
  summary jsonb,     -- { openAccounts, usagePct, oldestAccount, ... }
  inquiries jsonb,   -- [{ name, date, expires, businessType }]
  accounts jsonb,    -- [{ name, group, balance, creditLimit, monthlyPayment, ... }]
  synced_at timestamptz not null default now()
);

alter table public.moneyapp_credit_reports enable row level security;
