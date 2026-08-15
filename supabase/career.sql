-- Jamie's Money — Career: the paths worth weighing up, the jobs applied for,
-- and the people worth knowing.
-- Paste this into Jamie's Supabase project (SQL Editor → New query → Run).
-- Safe to run more than once.

-- ── The paths he's weighing up ───────────────────────────────────────────────
-- Three 1-to-5 scores per path — do I want it, does it pay enough, how hard is
-- it to start. The app turns those into one "fit" percentage and sorts by it,
-- which is the whole point: the list narrows itself down.
create table if not exists public.career_paths (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  what_it_is text,
  what_it_takes text,
  pay_low numeric(12,2),
  pay_high numeric(12,2),
  want_it smallint not null default 3 check (want_it between 1 and 5),
  pays_enough smallint not null default 3 check (pays_enough between 1 and 5),
  easy_to_start smallint not null default 3 check (easy_to_start between 1 and 5),
  status text not null default 'Exploring'
    check (status in ('Exploring', 'Shortlist', 'Ruled out')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.career_paths enable row level security;

-- ── Resumes ──────────────────────────────────────────────────────────────────
-- A pointer to the actual file in Storage. Kept exactly as uploaded — nothing
-- is parsed out of it. `aimed_at` is the plain-words note about which kind of
-- job this version was written for, so the right one goes out with the right
-- application.
create table if not exists public.resumes (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  aimed_at text,
  file_name text not null,
  storage_path text not null,
  uploaded_at timestamptz not null default now()
);

alter table public.resumes enable row level security;

-- Private bucket (public = false) — a resume carries a home address and a phone
-- number. Reads happen server-side with the service-role key, which hands the
-- browser a link that expires in an hour.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'resumes',
  'resumes',
  false,
  10485760,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do nothing;

-- ── Applications ─────────────────────────────────────────────────────────────
-- Deliberately the SAME table the Job vs Business page already uses. Two lists
-- of the same jobs would drift apart the first week; one list can't.
-- Created here too in case that page's setup SQL was never run.
create table if not exists public.job_postings (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  role_title text not null,
  salary text,
  link text,
  status text not null default 'Interested'
    check (status in ('Interested', 'Applied', 'Interview', 'Offer', 'Rejected')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.job_postings enable row level security;

-- What the Career page adds on top: the date it went out, which resume was
-- sent, and which path it belongs to. Deleting a resume or a path leaves the
-- application standing — losing the history would be worse than losing the link.
alter table public.job_postings
  add column if not exists applied_on date;
alter table public.job_postings
  add column if not exists resume_id uuid references public.resumes(id) on delete set null;
alter table public.job_postings
  add column if not exists path_id uuid references public.career_paths(id) on delete set null;

-- ── People and places worth knowing ──────────────────────────────────────────
create table if not exists public.networking_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null default 'Person'
    check (kind in ('Person', 'Recruiter', 'Company', 'Website', 'Group')),
  company text,
  how_to_reach text,
  link text,
  last_contact date,
  next_step text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.networking_sources enable row level security;
