-- Phase 2 schema: savings goals + recurring transaction rules.
-- Same conventions as 0001: bigint whole rupiah, user_id = auth.uid(), RLS.
--
-- This file is written to be RE-RUNNABLE. The original version was not, and the
-- gap cost a day: it was believed applied on 2026-07-10, but on 2026-08-29 the
-- tables did not exist (PostgREST returned PGRST205) and re-running the file
-- errored on the objects that HAD been created. It was then applied by hand as
-- an idempotent variant, which left the repo describing a schema the database
-- did not have. Every statement below is now safe to run against a database
-- that is empty, partially migrated, or fully up to date.

-- ---------------------------------------------------------------------------
-- SAVINGS GOALS  ("buying target saving" — save toward a purchase)
-- ---------------------------------------------------------------------------
create table if not exists public.savings_goals (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name          text not null,
  target_amount bigint not null check (target_amount > 0),
  saved_amount  bigint not null default 0 check (saved_amount >= 0),
  target_date   date,
  color         text not null default '#2a78d6',
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- RECURRING RULES  (auto-repeat transactions, e.g. rent, salary)
-- ---------------------------------------------------------------------------
create table if not exists public.recurring_rules (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind        text not null check (kind in ('income', 'expense')),
  amount      bigint not null check (amount > 0),
  category_id uuid references public.categories(id) on delete set null,
  note        text,
  frequency   text not null check (frequency in ('weekly', 'monthly')),
  next_run_on date not null,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create index if not exists savings_goals_user_idx  on public.savings_goals (user_id);
create index if not exists recurring_user_next_idx on public.recurring_rules (user_id, next_run_on);

-- ---------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ---------------------------------------------------------------------------
-- `enable row level security` is already a no-op when RLS is on, but policies
-- have no CREATE ... IF NOT EXISTS, so each one is dropped first.
alter table public.savings_goals   enable row level security;
alter table public.recurring_rules enable row level security;

drop policy if exists "own savings_goals" on public.savings_goals;
create policy "own savings_goals" on public.savings_goals
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own recurring_rules" on public.recurring_rules;
create policy "own recurring_rules" on public.recurring_rules
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
