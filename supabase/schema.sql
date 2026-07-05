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
  created_at timestamptz default now()
);

create table invoice_items (
  id uuid default uuid_generate_v4() primary key,
  invoice_id uuid references invoices(id) on delete cascade,
  description text not null,
  quantity numeric default 1,
  unit_price numeric default 0,
  amount numeric default 0,
  sort_order int default 0
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

create policy "Users own their data" on profiles for all using (auth.uid() = id);
create policy "Users own their data" on clients for all using (auth.uid() = user_id);
create policy "Users own their data" on invoices for all using (auth.uid() = user_id);
create policy "Users own their data" on invoice_items for all using (
  auth.uid() = (select user_id from invoices where id = invoice_id)
);
create policy "Users own their data" on share_tokens for all using (
  auth.uid() = (select user_id from invoices where id = invoice_id)
);
create policy "Users own their data" on expenses for all using (auth.uid() = user_id);


