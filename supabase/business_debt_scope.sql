-- Which scope a debt came back from in Money App: 'business' for the gym's
-- accounts, left null for Jamie's own. The Debt page splits its two sections on
-- this rather than guessing from the account name — "Business Platinum Card"
-- and "US Bank Card (JM)" are the gym's, and no rule written against names got
-- that consistently right.
--
-- Safe to run more than once.

alter table public.debts add column if not exists scope text;
