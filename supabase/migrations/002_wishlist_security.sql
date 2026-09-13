-- Apply this migration after 001_wishlists.sql. RLS remains the source of truth.
grant select, insert, update, delete on table public.wishlists to authenticated;

drop policy if exists "Users can update their own wishlist titles" on public.wishlists;
create policy "Users can update their own wishlist titles"
on public.wishlists for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
