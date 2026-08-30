-- Settlr database schema
-- Run this in the Supabase SQL editor for a fresh Settlr project.

create extension if not exists "uuid-ossp";

-- ─────────────────────────────────────────────
-- Reconciliation jobs
-- One row per "upload settlement + sales file, run reconciliation" run.
-- ─────────────────────────────────────────────
create table if not exists reconciliation_jobs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  marketplace text not null default 'meesho',
  status text not null default 'processing', -- processing | completed | failed
  settlement_file_name text not null,
  settlement_file_rows int not null default 0,
  sales_file_name text not null,
  sales_file_rows int not null default 0,
  column_mapping jsonb not null default '{}'::jsonb,

  -- summary, denormalized for fast dashboard reads
  total_records int not null default 0,
  matched_count int not null default 0,
  needs_attention_count int not null default 0,
  amount_requiring_review numeric(14,2) not null default 0,

  financial_summary jsonb not null default '{}'::jsonb,

  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists idx_jobs_user on reconciliation_jobs(user_id, created_at desc);

-- ─────────────────────────────────────────────
-- Reconciliation records
-- One row per matched/unmatched order-level comparison within a job.
-- ─────────────────────────────────────────────
create table if not exists reconciliation_records (
  id uuid primary key default uuid_generate_v4(),
  job_id uuid not null references reconciliation_jobs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,

  order_id text not null,
  status text not null, -- see lib/reconciliation.ts ReconciliationStatus

  seller_record jsonb,        -- normalized seller-side transaction(s)
  marketplace_records jsonb,  -- normalized marketplace-side transaction(s), array

  expected_amount numeric(14,2),
  marketplace_amount numeric(14,2),
  difference numeric(14,2),

  reason text not null,

  created_at timestamptz not null default now()
);

create index if not exists idx_records_job on reconciliation_records(job_id);
create index if not exists idx_records_user on reconciliation_records(user_id);
create index if not exists idx_records_status on reconciliation_records(job_id, status);
create index if not exists idx_records_order on reconciliation_records(job_id, order_id);

-- ─────────────────────────────────────────────
-- Billing — Cashfree-backed subscriptions
-- ─────────────────────────────────────────────
create table if not exists subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan_id text not null default 'free', -- 'free' | 'starter' | 'growth'
  status text not null default 'active', -- active | past_due | cancelled
  cashfree_order_id text,
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists payments (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id text not null,
  cashfree_order_id text not null unique,
  amount numeric(10,2) not null,
  status text not null default 'PENDING', -- PENDING | SUCCESS | FAILED
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_payments_user on payments(user_id, created_at desc);

-- ─────────────────────────────────────────────
-- Rate limiting — fixed-window counters, keyed per user or per IP
-- depending on the route. Not exposed to PostgREST at all (RLS enabled,
-- zero policies) — only ever touched via the service-role client from
-- server code, never from the browser.
-- ─────────────────────────────────────────────
create table if not exists rate_limits (
  key text primary key,
  count int not null default 1,
  window_start timestamptz not null default now()
);

alter table rate_limits enable row level security;
-- Intentionally no policies: RLS with zero policies blocks all access via
-- the anon/authenticated PostgREST roles. Only the service-role key
-- (which bypasses RLS entirely) can read or write this table.

alter table subscriptions enable row level security;
alter table payments enable row level security;

create policy "subscriptions_select_own" on subscriptions
  for select using (auth.uid() = user_id);
-- Inserts/updates to subscriptions and payments happen only from the
-- server using the service-role key (after independently verifying the
-- Cashfree webhook signature or order status), never directly from the
-- client — so no insert/update policy is granted to authenticated users.

create policy "payments_select_own" on payments
  for select using (auth.uid() = user_id);


alter table reconciliation_jobs enable row level security;
alter table reconciliation_records enable row level security;

create policy "jobs_select_own" on reconciliation_jobs
  for select using (auth.uid() = user_id);
create policy "jobs_insert_own" on reconciliation_jobs
  for insert with check (auth.uid() = user_id);
create policy "jobs_update_own" on reconciliation_jobs
  for update using (auth.uid() = user_id);
create policy "jobs_delete_own" on reconciliation_jobs
  for delete using (auth.uid() = user_id);

create policy "records_select_own" on reconciliation_records
  for select using (auth.uid() = user_id);
create policy "records_insert_own" on reconciliation_records
  for insert with check (auth.uid() = user_id);
create policy "records_delete_own" on reconciliation_records
  for delete using (auth.uid() = user_id);
