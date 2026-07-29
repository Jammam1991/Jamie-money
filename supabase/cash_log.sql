-- Jamie's Money — the cash log for the new simple home screen.
-- Paste this into Jamie's Supabase project (SQL Editor → New query → Run).
-- Safe to run more than once. No sensitive data here — just table shape.

-- One row every time cash moves:
--   'massage'  = Jamie got paid for a massage (cash goes UP)
--   'to_chris' = Jamie handed cash to Chris (cash goes DOWN)
--   'deposit'  = Jamie put cash in the business bank account (cash goes DOWN)
--   'spent'    = Jamie spent some cash (cash goes DOWN)
-- The running balance is simply massages minus everything else.
create table if not exists public.cash_log (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('massage', 'to_chris', 'deposit', 'spent')),
  amount numeric(12,2) not null default 0,
  happened_on date not null default current_date,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists cash_log_created_at_idx on public.cash_log (created_at desc);
alter table public.cash_log enable row level security;
