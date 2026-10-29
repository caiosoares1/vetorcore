-- Estrutura inicial, reservada para integração futura. Não conectar clientes antes de revisar as políticas.
create extension if not exists pgcrypto;
create table if not exists public.suppliers (id uuid primary key default gen_random_uuid(), name text not null, doc text, phone text, email text, category text);
create table if not exists public.customers (id uuid primary key default gen_random_uuid(), name text not null, doc text, phone text, email text);
create table if not exists public.products (id uuid primary key default gen_random_uuid(), sku text not null unique, name text not null, category text not null default 'Outros', cost_cents bigint not null default 0 check (cost_cents>=0), price_cents bigint not null default 0 check (price_cents>=0), qty integer not null default 0 check(qty>=0), min_qty integer not null default 0 check(min_qty>=0), supplier_id uuid references public.suppliers(id));
create table if not exists public.stock_movements (id uuid primary key default gen_random_uuid(), product_id uuid not null references public.products(id), delta integer not null, kind text not null check(kind in ('Entrada','Saída','Ajuste')), note text default '', actor uuid references auth.users(id), created_at timestamptz default now());
create table if not exists public.quotes (id uuid primary key default gen_random_uuid(), quote_number bigint generated always as identity unique, customer_id uuid not null references public.customers(id), status text not null default 'Rascunho', discount_cents bigint not null default 0 check(discount_cents>=0), notes text default '', created_at timestamptz default now());
create table if not exists public.quote_items (id uuid primary key default gen_random_uuid(), quote_id uuid not null references public.quotes(id) on delete cascade, product_id uuid references public.products(id), product_name text not null, quantity integer not null check(quantity>0), unit_price_cents bigint not null check(unit_price_cents>=0));
create table if not exists public.orders (id uuid primary key default gen_random_uuid(), quote_id uuid not null references public.quotes(id), customer_id uuid not null references public.customers(id), total_cents bigint not null check(total_cents>=0), status text not null default 'Em separação');
alter table public.suppliers enable row level security;
alter table public.customers enable row level security;
alter table public.products enable row level security;
alter table public.stock_movements enable row level security;
alter table public.quotes enable row level security;
alter table public.quote_items enable row level security;
alter table public.orders enable row level security;
-- Intencionalmente sem policies: negar acesso até adicionar autenticação e regras transacionais.
