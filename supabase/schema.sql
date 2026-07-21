-- Jamie's Money — database structure.
-- Paste this whole file into Jamie's Supabase project (SQL Editor → New query → Run).
-- It makes two small tables and fills them with the starter content Jamie can edit later.
-- No sensitive data here — just the shape of the app.

-- ── Debts ─────────────────────────────────────────────────────────────────────
create table if not exists public.debts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  balance numeric(12,2) not null default 0,
  monthly numeric(12,2) not null default 0,
  paid_pct integer not null default 0,
  sort integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.debts enable row level security;

-- ── Bills (recurring payments) ───────────────────────────────────────────────
create table if not exists public.bills (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  amount numeric(12,2) not null default 0,
  frequency text not null,
  due_date text,
  sort integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.bills enable row level security;

-- ── Divorce details (a single row) ────────────────────────────────────────────
create table if not exists public.divorce_details (
  id uuid primary key default gen_random_uuid(),
  support_amount numeric(12,2) not null default 0,
  support_next_date text,
  support_paid_this_month boolean not null default false,
  documents_count integer not null default 0,
  split jsonb not null default '[]'::jsonb,
  key_dates jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.divorce_details enable row level security;

-- ── Starter content (matches the approved mockup) ─────────────────────────────
insert into public.debts (name, balance, monthly, paid_pct, sort) values
  ('Credit card', 5800, 150, 38, 1),
  ('Car loan', 6500, 320, 55, 2),
  ('Loan from friend', 2000, 100, 20, 3);

insert into public.bills (name, amount, frequency, due_date, sort) values
  ('Electric', 120, 'monthly', '1st', 1),
  ('Internet', 85, 'monthly', '5th', 2),
  ('Streaming', 18, 'monthly', '15th', 3);

insert into public.divorce_details
  (support_amount, support_next_date, support_paid_this_month, documents_count, split, key_dates)
values (
  900, 'Aug 1', true, 4,
  '[{"item":"House","note":"50 / 50"},{"item":"Savings","note":"50 / 50"},{"item":"Car","note":"Yours"}]'::jsonb,
  '[{"label":"Tentative divorce initiation","date":"Aug 15"},{"label":"Court date (tentative)","date":"Jan 15"}]'::jsonb
);
