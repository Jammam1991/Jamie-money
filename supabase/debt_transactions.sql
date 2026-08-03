-- The individual charges that add up to Jamie's debt, so he can drill down
-- year -> month -> transaction and see where the debt actually came from.

create table if not exists public.debt_transactions (
  id uuid primary key default gen_random_uuid(),
  tx_date text not null, -- YYYY-MM-DD format
  description text not null,
  amount numeric(12,2) not null,
  source text, -- which card or loan it landed on
  created_at timestamptz not null default now()
);

alter table public.debt_transactions enable row level security;
