-- Jamie's Money — editable Home page numbers.
-- Paste this into Jamie's Supabase project (SQL Editor → New query → Run).
-- Safe to run more than once. Holds the Home page's headline numbers so Chris
-- can hand-type them now; later these get filled from Jamie's bank (Plaid).
-- One row only. When the table is empty the app shows the starter sample.

create table if not exists public.home_summary (
  id uuid primary key default gen_random_uuid(),
  status_label text not null default '',
  status_note text not null default '',
  net_worth numeric(14,2) not null default 0,
  net_worth_change numeric(14,2) not null default 0,
  money_in numeric(14,2) not null default 0,
  money_out numeric(14,2) not null default 0,
  recent jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.home_summary enable row level security;
