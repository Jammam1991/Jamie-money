-- Overall Debt & Assets management tables for divorce scenario analysis

-- ── Overall Debts (communal property debts) ────────────────────────────────────
create table if not exists public.overall_debts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  balance numeric(12,2) not null default 0,
  secured_by text not null default 'Joint', -- 'Chris', 'Jamie', or 'Joint'
  monthly_payment text not null default 'TBD',
  monthly_interest text not null default 'TBD',
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.overall_debts enable row level security;

-- ── Overall Assets (household assets) ──────────────────────────────────────────
create table if not exists public.overall_assets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  value numeric(12,2) not null default 0,
  owner text not null default 'Joint', -- 'Chris', 'Jamie', or 'Joint'
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.overall_assets enable row level security;

-- ── Overall Context (salaries, dates, notes) ──────────────────────────────────
create table if not exists public.overall_context (
  id uuid primary key default gen_random_uuid(),
  jamie_salary numeric(12,2) not null default 147000,
  jamie_salary_note text not null default 'cash deposits',
  chris_salary numeric(12,2) not null default 135000,
  chris_salary_note text not null default 'rental deposits & W-2 income',
  marriage_start_date text not null default 'July 2020',
  marriage_end_date text not null default 'present',
  separated_date text not null default '2023',
  condo_note text not null default 'Separate property — purchased before marriage',
  legal_plan_note text not null default 'Metlife Legal plan covers uncontested divorce',
  updated_at timestamptz not null default now()
);

alter table public.overall_context enable row level security;

-- ── Seed Overall Debts ────────────────────────────────────────────────────────
insert into public.overall_debts (name, balance, secured_by, sort)
select * from (values
  ('Home Equity Loan', 210000, 'Chris', 1),
  ('Auto Loan', 86000, 'Joint', 2),
  ('Jamie Personal Credit Cards', 35000, 'Jamie', 3),
  ('Personal Loan (Dad)', 55000, 'Chris', 4),
  ('Chris Credit Card Debt', 25000, 'Chris', 5),
  ('Personal Line of Credit', 20000, 'Chris', 6),
  ('Line of Credit', 30000, 'Chris', 7),
  ('Business Loan', 45000, 'Jamie', 8),
  ('Business Credit Card', 6000, 'Jamie', 9),
  ('Business Loan (small)', 2500, 'Jamie', 10)
) as v(name, balance, secured_by, sort)
where not exists (select 1 from public.overall_debts);

-- ── Seed Overall Assets ───────────────────────────────────────────────────────
insert into public.overall_assets (name, value, owner, sort)
select * from (values
  ('Rolex watch', 25000, 'Joint', 1),
  ('Rolex watch', 15000, 'Joint', 2),
  ('401(k)', 35000, 'Chris', 3),
  ('Pension', 26000, 'Chris', 4),
  ('Jewelry', 10000, 'Jamie', 5),
  ('Miscellaneous items', 10000, 'Jamie', 6)
) as v(name, value, owner, sort)
where not exists (select 1 from public.overall_assets);

-- ── Seed Overall Context ──────────────────────────────────────────────────────
insert into public.overall_context (
  jamie_salary, jamie_salary_note, chris_salary, chris_salary_note,
  marriage_start_date, marriage_end_date, separated_date, condo_note, legal_plan_note
)
select * from (values (
  147000, 'cash deposits',
  135000, 'rental deposits & W-2 income',
  'July 2020', 'present', '2023',
  'Separate property — purchased before marriage',
  'Metlife Legal plan covers uncontested divorce'
))
where not exists (select 1 from public.overall_context);
