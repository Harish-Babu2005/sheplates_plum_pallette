alter table public.orders
  add column if not exists delivery_address text;
