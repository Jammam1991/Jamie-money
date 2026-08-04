-- Credit Report page, part two: the full report, mirrored from Money App.
-- Paste this into Jamie's Supabase project (SQL Editor → New query → Run).
-- Safe to run more than once.
--
-- credit_reports.sql already added the score history and the balance snapshots.
-- This adds the rest of what Money App's Credit Report screen shows: the score
-- factors, the negative items, the at-a-glance summary, the hard inquiries and
-- the bureau's own account list. Nothing here is typed in by hand — the
-- "Pull latest from Money App" button refills it.

-- ── One parsed credit report ──────────────────────────────────────────────────
-- The report date is the key, so re-pulling updates a report in place instead
-- of stacking copies. Each blob is stored exactly as Money App parsed it.
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

-- ── Account details the credit-account list shows ─────────────────────────────
-- Money App keeps these alongside each debt; the sync now carries them over so
-- the account rows here read the same as they do there.
alter table public.debts add column if not exists debt_type text;
alter table public.debts add column if not exists opened_date date;
alter table public.debts add column if not exists credit_report_day integer;
alter table public.debts add column if not exists notes text;
