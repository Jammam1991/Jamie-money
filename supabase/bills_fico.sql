-- Split the Bills page into "FICO bills" (credit cards, which move Jamie's
-- credit score when they're paid) and everything else. Run this once in the
-- Supabase SQL editor.

alter table public.bills
  add column if not exists fico boolean not null default false;

-- Optional starting point: flag the obvious credit-card rows. Safe to skip —
-- Chris can also flip the switch on each bill from the Bills page.
update public.bills
  set fico = true
  where fico = false
    and (name ilike '%credit%' or name ilike '%card%' or name ilike '%visa%'
         or name ilike '%amex%' or name ilike '%mastercard%'
         or name ilike '%discover%');
