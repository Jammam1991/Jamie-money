-- Jamie's Money — bill payment history + lease/agreement documents.
-- Paste this into Jamie's Supabase project (SQL Editor → New query → Run).
-- Safe to run more than once. No sensitive data here — just table shape.

-- ── Manual payment log per bill ───────────────────────────────────────────────
-- A hand-entered record that a bill was paid. Not pulled from the bank feed —
-- Plaid only syncs debt balances here, not transactions, so there's nothing to
-- auto-match against yet.
create table if not exists public.bill_payments (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid not null references public.bills(id) on delete cascade,
  amount numeric(12,2) not null default 0,
  paid_date date not null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists bill_payments_bill_id_idx on public.bill_payments (bill_id);
alter table public.bill_payments enable row level security;

-- ── Lease / agreement documents per bill ──────────────────────────────────────
-- Stores a pointer to the raw PDF in Storage — the file is kept as uploaded,
-- nothing is parsed or extracted from it.
create table if not exists public.bill_documents (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid not null references public.bills(id) on delete cascade,
  file_name text not null,
  storage_path text not null,
  uploaded_at timestamptz not null default now()
);

create index if not exists bill_documents_bill_id_idx on public.bill_documents (bill_id);
alter table public.bill_documents enable row level security;

-- ── Storage bucket for the actual PDF bytes ───────────────────────────────────
-- Private bucket (public = false) since these are lease/financial documents.
-- Access only ever happens server-side via the service-role key (same as every
-- table above — no policies needed because that key bypasses RLS, and the
-- anon key is never used for writes or reads in this app).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('bill-documents', 'bill-documents', false, 10485760, array['application/pdf'])
on conflict (id) do nothing;
