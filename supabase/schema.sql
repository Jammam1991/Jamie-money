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

-- Interest rate and minimum payment (added later — safe to run on an existing db).
alter table public.debts add column if not exists apr numeric(6,2) not null default 0;
alter table public.debts add column if not exists min_payment numeric(12,2) not null default 0;

alter table public.debts enable row level security;

-- ── Bills (monthly recurring costs) ───────────────────────────────────────────
create table if not exists public.bills (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  amount numeric(12,2) not null default 0,
  due_day integer not null default 0,
  sort integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.bills enable row level security;

-- ── Settings (simple key/value, e.g. weekly income) ───────────────────────────
create table if not exists public.settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table public.settings enable row level security;

-- ── Divorce details (a single row) ────────────────────────────────────────────
create table if not exists public.divorce_details (
  id uuid primary key default gen_random_uuid(),
  support_amount numeric(12,2) not null default 0,
  support_next_date text,
  support_paid_this_month boolean not null default false,
  lawyer_costs numeric(12,2) not null default 0,
  documents_count integer not null default 0,
  split jsonb not null default '[]'::jsonb,
  key_dates jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

-- Benefits of staying married list (added later — safe to run on an existing db).
alter table public.divorce_details add column if not exists benefits jsonb not null default '[]'::jsonb;

alter table public.divorce_details enable row level security;

-- ── Starter content (matches the approved mockup) ─────────────────────────────
-- Each block only fills a table if it's still empty, so this whole file is safe
-- to paste and run again anytime without creating duplicates.
insert into public.debts (name, balance, monthly, paid_pct, apr, min_payment, sort)
select * from (values
  ('Credit card', 5800, 150, 38, 22.9, 150, 1),
  ('Car loan', 6500, 320, 55, 7.5, 320, 2),
  ('Loan from friend', 2000, 100, 20, 0, 100, 3)
) as v(name, balance, monthly, paid_pct, apr, min_payment, sort)
where not exists (select 1 from public.debts);

-- Preloaded bills Jamie can edit, delete, or add to.
insert into public.bills (name, amount, due_day, sort)
select * from (values
  ('Rent', 1200, 1, 1),
  ('Car payment', 320, 5, 2),
  ('Car insurance', 140, 10, 3),
  ('Phone', 70, 12, 4),
  ('Internet', 60, 15, 5),
  ('Utilities', 180, 18, 6),
  ('Groceries', 400, 0, 7),
  ('Subscriptions', 45, 20, 8)
) as v(name, amount, due_day, sort)
where not exists (select 1 from public.bills);

insert into public.settings (key, value) values ('weekly_income', '900')
  on conflict (key) do nothing;

insert into public.divorce_details
  (support_amount, support_next_date, support_paid_this_month, lawyer_costs, documents_count, split, benefits, key_dates)
select * from (values (
  900, 'Aug 1', true, 3200, 4,
  '[{"item":"House","note":"50 / 50"},{"item":"Savings","note":"50 / 50"},{"item":"Car","note":"Yours"}]'::jsonb,
  '["Tax Discount (Joint Savings)","Health Insurance Cheaper","Life Insurance (200-300K)"]'::jsonb,
  '[{"label":"Court date","date":"Sep 12"},{"label":"Papers due","date":"Aug 20"}]'::jsonb
)) as v(support_amount, support_next_date, support_paid_this_month, lawyer_costs, documents_count, split, benefits, key_dates)
where not exists (select 1 from public.divorce_details);
