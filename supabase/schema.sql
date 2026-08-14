-- Run this in the Supabase SQL Editor before connecting the app.
create table if not exists public.budget_workspaces (
  user_id uuid primary key references auth.users(id) on delete cascade,
  budgets jsonb not null default '{}'::jsonb,
  yearly_budgets jsonb not null default '{}'::jsonb,
  expenses jsonb not null default '[]'::jsonb,
  stripe_customer_id text unique,
  subscription_status text not null default 'free',
  subscription_price_id text,
  subscription_current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Customer profile details are populated from required sign-up metadata.
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  phone text not null,
  country text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (user_id, phone, country)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'phone', ''),
    coalesce(new.raw_user_meta_data ->> 'country', '')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

alter table public.budget_workspaces enable row level security;
alter table public.profiles enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update on public.budget_workspaces to authenticated;
grant select, update on public.profiles to authenticated;

create policy "Users can view their own workspace"
  on public.budget_workspaces for select
  using (auth.uid() = user_id);

create policy "Users can create their own workspace"
  on public.budget_workspaces for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own workspace"
  on public.budget_workspaces for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = user_id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- The subscription fields are maintained only by the trusted Stripe webhook.
revoke update (stripe_customer_id, subscription_status, subscription_price_id, subscription_current_period_end)
  on public.budget_workspaces from anon, authenticated;
