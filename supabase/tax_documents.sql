-- Jamie's Money — Google Drive links to redacted tax returns, by year.
-- Paste this into Jamie's Supabase project (SQL Editor → New query → Run).
-- Safe to run more than once. Managed from Settings; shown on the Tax Center
-- page. The tax numbers themselves (taxes paid, refund) come live from the
-- Money App and are never stored here.
create table if not exists public.tax_documents (
  id uuid primary key default gen_random_uuid(),
  tax_year integer not null,
  drive_url text not null,
  label text,
  created_at timestamptz not null default now()
);

-- Not unique on tax_year — a year can have more than one link (federal +
-- state, or a page split across files).
create index if not exists tax_documents_year_idx on public.tax_documents (tax_year);
alter table public.tax_documents enable row level security;
