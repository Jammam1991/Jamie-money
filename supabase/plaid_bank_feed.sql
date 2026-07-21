-- Jamie's Money — bank "debts" feed (Plaid).
-- Paste this into Jamie's Supabase project (SQL Editor → New query → Run).
-- Safe to run more than once. No sensitive data here — just table shape.

-- ── Remember each connected bank ──────────────────────────────────────────────
-- One row per bank Jamie links. access_token is the long-lived key Plaid gives
-- us to read that bank; it stays server-side only.
create table if not exists public.plaid_items (
  id uuid primary key default gen_random_uuid(),
  item_id text not null unique,
  access_token text not null,
  institution_name text,
  last_synced_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.plaid_items enable row level security;

-- ── Tie a debt row to a bank account ──────────────────────────────────────────
-- These let a refresh update the same debt in place instead of adding copies.
-- `source` marks where the row came from ('manual' by hand, 'plaid' from a bank).
alter table public.debts add column if not exists plaid_account_id text;
alter table public.debts add column if not exists source text not null default 'manual';

-- One debt row per bank account.
create unique index if not exists debts_plaid_account_id_key
  on public.debts (plaid_account_id)
  where plaid_account_id is not null;
