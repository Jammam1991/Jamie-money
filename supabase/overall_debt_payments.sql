-- Track Jamie's responsibility payments

create table if not exists public.overall_debt_payments (
  id uuid primary key default gen_random_uuid(),
  payment_date text not null, -- YYYY-MM-DD format
  amount numeric(12,2) not null,
  note text,
  created_at timestamptz not null default now()
);

alter table public.overall_debt_payments enable row level security;
