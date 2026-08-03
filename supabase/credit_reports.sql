-- Credit Report page: keep every credit report Chris uploads, the accounts it
-- listed, and the credit-score history over time. Run this once in the
-- Supabase SQL editor.

-- ── One row per uploaded report ───────────────────────────────────────────────
create table if not exists public.credit_reports (
  id uuid primary key default gen_random_uuid(),
  report_date date not null,
  bureau text not null default 'Unknown', -- Experian / Equifax / TransUnion / Unknown
  fico_score integer,                      -- null when the report had no score on it
  total_balance numeric(12,2) not null default 0,
  note text,
  created_at timestamptz not null default now()
);

alter table public.credit_reports enable row level security;

create index if not exists credit_reports_date_idx
  on public.credit_reports (report_date desc);

-- ── The accounts listed inside one report ─────────────────────────────────────
create table if not exists public.credit_report_accounts (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.credit_reports(id) on delete cascade,
  name text not null,
  balance numeric(12,2) not null default 0,
  apr numeric(6,2) not null default 0,
  min_payment numeric(12,2) not null default 0,
  sort integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.credit_report_accounts enable row level security;

create index if not exists credit_report_accounts_report_idx
  on public.credit_report_accounts (report_id);

-- ── Credit-score history ──────────────────────────────────────────────────────
-- Scores read off a report are saved here too (source = 'report'), so the
-- history chart is one simple list no matter where the number came from.
create table if not exists public.fico_scores (
  id uuid primary key default gen_random_uuid(),
  score integer not null,
  scored_on date not null,
  source text not null default 'manual', -- 'report' or 'manual'
  report_id uuid references public.credit_reports(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.fico_scores enable row level security;

create index if not exists fico_scores_date_idx
  on public.fico_scores (scored_on desc);
