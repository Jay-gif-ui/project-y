create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text check (char_length(name) <= 80),
  country_code text not null default 'IN' check (country_code in ('IN','US','GB','CA','AU','DE','FR','ES','IT','NL','SE','NO','DK','FI','PL','BR','MX','JP','KR','SG','AE','SA','NZ')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
grant select, insert, update on public.profiles to authenticated;
create policy "Users can read their own profile" on public.profiles for select using (auth.uid() = user_id);
create policy "Users can create their own profile" on public.profiles for insert with check (auth.uid() = user_id);
create policy "Users can update their own profile" on public.profiles for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create or replace function public.set_profile_updated_at() returns trigger language plpgsql security invoker set search_path = public as $$ begin new.updated_at = now(); return new; end; $$;
drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_profile_updated_at();
