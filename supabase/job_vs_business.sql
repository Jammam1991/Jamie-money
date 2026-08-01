-- Job vs Business comparison tables

-- ── Job vs Business Comparison ──────────────────────────────────────────────────
create table if not exists public.job_vs_business (
  id uuid primary key default gen_random_uuid(),
  business_monthly_income numeric(12,2) not null default 0,
  job_salary_annual numeric(12,2) not null default 0,
  benefits_value numeric(12,2) not null default 0,
  business_hours_per_week numeric(6,2) not null default 0,
  job_hours_per_week numeric(6,2) not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.job_vs_business enable row level security;

-- ── Business Pros & Cons ────────────────────────────────────────────────────────
create table if not exists public.business_pros_cons (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('business_pro', 'business_con', 'job_pro', 'job_con')),
  text text not null,
  sort integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.business_pros_cons enable row level security;

-- ── Job Postings Tracker ───────────────────────────────────────────────────────
create table if not exists public.job_postings (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  role_title text not null,
  salary text,
  link text,
  status text not null default 'Interested' check (status in ('Interested', 'Applied', 'Interview', 'Offer', 'Rejected')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.job_postings enable row level security;

-- ── Decision Journal ────────────────────────────────────────────────────────────
create table if not exists public.decision_journal (
  id uuid primary key default gen_random_uuid(),
  entry_date date not null,
  notes text not null,
  created_at timestamptz not null default now()
);

alter table public.decision_journal enable row level security;

-- ── Starter content ────────────────────────────────────────────────────────────
insert into public.job_vs_business (business_monthly_income, job_salary_annual, benefits_value, business_hours_per_week, job_hours_per_week)
select * from (values (
  4000, 60000, 10000, 40, 40
))
where not exists (select 1 from public.job_vs_business);
