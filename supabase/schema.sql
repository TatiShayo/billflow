-- BillFlow Schema
create extension if not exists "uuid-ossp";

create table profiles (
  id uuid references auth.users primary key,
  full_name text,
  company_name text,
  company_email text,
  logo_url text,
  address text,
  phone text,
  tax_number text,
  default_currency text default 'USD',
  subscription_tier text default 'free',
  stripe_customer_id text,
  invoice_prefix text default 'INV',
  next_invoice_number int default 1,
  payment_terms text default 'Net 30',
  default_notes text,
  notify_on_payment boolean default true,
  notify_overdue boolean default true,
  created_at timestamptz default now()
);

create table subscriptions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references profiles(id) on delete cascade,
  stripe_subscription_id text unique,
  plan text,
  status text,
  current_period_end timestamptz,
  created_at timestamptz default now()
);

-- Webhook idempotency ledger. Every Stripe event id is inserted exactly once;
-- the unique constraint makes replayed/duplicate deliveries a no-op instead of
-- re-applying a subscription-tier change. See api/stripe/webhook/route.ts.
create table if not exists stripe_events (
  event_id text primary key,
  type text,
  processed_at timestamptz default now()
);
alter table stripe_events enable row level security;
-- No policy: only the service_role (webhook) may touch this table.

create table clients (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references profiles(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  company text,
  address text,
  currency text default 'USD',
  notes text,
  created_at timestamptz default now()
);

create table invoices (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references profiles(id) on delete cascade,
  client_id uuid references clients(id),
  invoice_number text,
  payment_token text unique default uuid_generate_v4(),
  status text default 'draft',
  issue_date date,
  due_date date,
  subtotal numeric default 0,
  tax_rate numeric default 0,
  tax_amount numeric default 0,
  discount_amount numeric default 0,
  total numeric default 0,
  currency text default 'USD',
  notes text,
  paid_at timestamptz,
  created_at timestamptz default now(),
  constraint unique_invoice_number_per_user unique (user_id, invoice_number),
  -- Money can never be negative even if a crafted client write bypasses the UI.
  constraint invoices_non_negative check (
    subtotal >= 0 and tax_rate >= 0 and tax_amount >= 0
    and discount_amount >= 0 and total >= 0
  )
);

create table invoice_items (
  id uuid default uuid_generate_v4() primary key,
  invoice_id uuid references invoices(id) on delete cascade,
  description text not null,
  quantity numeric default 1,
  unit_price numeric default 0,
  amount numeric default 0,
  sort_order int default 0,
  constraint invoice_items_non_negative check (quantity >= 0 and unit_price >= 0 and amount >= 0)
);

create table share_tokens (
  id uuid default uuid_generate_v4() primary key,
  invoice_id uuid references invoices(id) on delete cascade,
  token text unique not null,
  expires_at timestamptz,
  created_at timestamptz default now()
);

create table expenses (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references profiles(id) on delete cascade,
  description text not null,
  amount numeric,
  currency text default 'USD',
  category text,
  expense_date date,
  receipt_url text,
  notes text,
  created_at timestamptz default now()
);

alter table profiles enable row level security;
alter table clients enable row level security;
alter table invoices enable row level security;
alter table invoice_items enable row level security;
alter table share_tokens enable row level security;
alter table expenses enable row level security;

-- RLS policies — hardened Round 1 + Round 2
-- SELECT: user can only see their own profile
create policy "Users can view own profile" on profiles for select using (auth.uid() = id);

-- INSERT: only via server-side signup (service_role), not client-controlled
-- This prevents users from setting subscription_tier at signup time via upsert
create policy "Only service role can create profiles" on profiles for insert
  with check (auth.role() = 'service_role');

-- UPDATE: only own row, and cannot change subscription_tier or stripe_customer_id
create policy "Users can update own non-sensitive profile fields" on profiles
  for update using (auth.uid() = id)
  with check (
    subscription_tier = (select subscription_tier from profiles where id = auth.uid())
    and stripe_customer_id is not distinct from (select stripe_customer_id from profiles where id = auth.uid())
  );

-- No DELETE policy — profiles are not user-deletable
-- Use a database trigger to auto-create profiles on auth.users insert:
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, subscription_tier, default_currency)
  values (new.id, 'free', 'USD');
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
create policy "Users own their data" on clients for all using (auth.uid() = user_id);
create policy "Users own their data" on invoices for all using (auth.uid() = user_id);
create policy "Users own their data" on invoice_items for all using (
  auth.uid() = (select user_id from invoices where id = invoice_id)
);
create policy "Users own their data" on share_tokens for all using (
  auth.uid() = (select user_id from invoices where id = invoice_id)
);
create policy "Users own their data" on expenses for all using (auth.uid() = user_id);


-- Performance indexes for the hot query paths (dashboard lists, joins, token lookups)
create index if not exists idx_invoices_user_status on invoices(user_id, status);
create index if not exists idx_invoices_user_created on invoices(user_id, created_at desc);
create index if not exists idx_invoices_client on invoices(client_id);
create index if not exists idx_invoices_payment_token on invoices(payment_token);
create index if not exists idx_invoice_items_invoice on invoice_items(invoice_id);
create index if not exists idx_clients_user on clients(user_id);
create index if not exists idx_expenses_user_date on expenses(user_id, expense_date desc);
create index if not exists idx_share_tokens_token on share_tokens(token);
create index if not exists idx_subscriptions_stripe_id on subscriptions(stripe_subscription_id);


