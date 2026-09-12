create table if not exists public.wishlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tmdb_id integer not null check (tmdb_id > 0),
  media_type text not null check (media_type in ('movie', 'tv')),
  title text not null,
  poster_path text,
  release_date date,
  rating numeric,
  created_at timestamptz not null default now(),
  unique (user_id, tmdb_id, media_type)
);

alter table public.wishlists enable row level security;

create policy "Users can read their own wishlist" on public.wishlists for select using (auth.uid() = user_id);
create policy "Users can add their own wishlist titles" on public.wishlists for insert with check (auth.uid() = user_id);
create policy "Users can remove their own wishlist titles" on public.wishlists for delete using (auth.uid() = user_id);
