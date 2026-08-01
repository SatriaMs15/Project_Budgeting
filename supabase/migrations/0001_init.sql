-- Budgeting app — initial schema (Phase 1: categories, transactions, budgets)
--
-- Money is stored as BIGINT whole rupiah (IDR has no minor unit).
-- Every table is owned by a user (auth.uid()) and protected by Row Level
-- Security so each anonymous user only ever sees their own rows.

-- ---------------------------------------------------------------------------
-- CATEGORIES
-- ---------------------------------------------------------------------------
create table public.categories (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name       text not null,
  kind       text not null check (kind in ('income', 'expense')),
  color      text not null default '#64748b',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- TRANSACTIONS
-- ---------------------------------------------------------------------------
create table public.transactions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  amount      bigint not null check (amount > 0),
  kind        text not null check (kind in ('income', 'expense')),
  category_id uuid references public.categories(id) on delete set null,
  note        text,
  occurred_on date not null default current_date,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- BUDGETS  (one limit per category per month)
-- ---------------------------------------------------------------------------
create table public.budgets (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  category_id  uuid not null references public.categories(id) on delete cascade,
  month        date not null,               -- first day of the month, e.g. 2026-07-01
  limit_amount bigint not null check (limit_amount >= 0),
  created_at   timestamptz not null default now(),
  unique (user_id, category_id, month)
);

-- ---------------------------------------------------------------------------
-- INDEXES
-- ---------------------------------------------------------------------------
create index transactions_user_date_idx on public.transactions (user_id, occurred_on);
create index categories_user_idx        on public.categories (user_id);
create index budgets_user_month_idx     on public.budgets (user_id, month);

-- ---------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ---------------------------------------------------------------------------
alter table public.categories   enable row level security;
alter table public.transactions enable row level security;
alter table public.budgets      enable row level security;

create policy "own categories" on public.categories
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own transactions" on public.transactions
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own budgets" on public.budgets
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
