-- Jamie's Money — the password book.
-- Paste this into Jamie's Supabase project (SQL Editor → New query → Run).
-- Safe to run more than once.
--
-- Nothing readable is stored here. The username, the password and the notes
-- are locked before they ever leave the app (AES-256-GCM), and the key that
-- opens them lives in Vercel as PASSWORDS_KEY — never in this database. So a
-- copy of this table on its own is a page of scrambled text.
--
-- Only the label, the website and the folder stay in plain words, because the
-- list has to be readable to be useful.
create table if not exists public.password_entries (
  id uuid primary key default gen_random_uuid(),
  label text not null,               -- e.g. "Chase Bank"
  url text,                          -- the sign-in page
  category text,                     -- optional folder, e.g. "Banking"
  username_enc text,                 -- locked
  password_enc text not null,        -- locked
  notes_enc text,                    -- locked
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists password_entries_sort_idx on public.password_entries (sort);

-- Row-level security on with no policies at all: the public keys can't read a
-- single row. Only the app's server key touches this table.
alter table public.password_entries enable row level security;
