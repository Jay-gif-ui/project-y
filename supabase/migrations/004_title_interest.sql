-- Anonymous detail-page interest. Only the app server can access these tables/RPCs.
-- Counts are hourly; no IP addresses, account IDs, or browser fingerprints are stored.
begin;

create table public.title_view_receipts (
  viewer_hash text not null check (viewer_hash ~ '^[a-f0-9]{64}$'),
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  media_type text not null check (media_type in ('movie', 'tv')),
  title_id bigint not null check (title_id > 0),
  viewed_at timestamptz not null default now(),
  primary key (viewer_hash, country_code, media_type, title_id)
);
create index title_view_receipts_expiry on public.title_view_receipts (viewed_at);
create table public.title_view_hourly (
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  media_type text not null check (media_type in ('movie', 'tv')),
  title_id bigint not null check (title_id > 0),
  bucket_start timestamptz not null,
  view_count bigint not null check (view_count > 0),
  primary key (country_code, bucket_start, media_type, title_id)
);
create index title_view_hourly_expiry on public.title_view_hourly (bucket_start);
create table public.title_interest_maintenance (
  id boolean primary key default true check (id),
  cleaned_at timestamptz not null default now()
);
insert into public.title_interest_maintenance default values;

alter table public.title_view_receipts enable row level security;
alter table public.title_view_hourly enable row level security;
alter table public.title_interest_maintenance enable row level security;
revoke all on public.title_view_receipts, public.title_view_hourly, public.title_interest_maintenance from public, anon, authenticated;

create function public.prune_title_interest() returns void
language plpgsql security definer set search_path = '' as $$
begin
  -- The conditional update obtains a lock only once per hour across all instances.
  update public.title_interest_maintenance set cleaned_at = now()
  where id = true and cleaned_at < now() - interval '1 hour';
  if found then
    delete from public.title_view_receipts where viewed_at < now() - interval '1 day';
    delete from public.title_view_hourly where bucket_start < now() - interval '8 days';
  end if;
end;
$$;

create function public.record_title_view(p_country text, p_media_type text, p_title_id bigint, p_viewer_hash text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  last_seen timestamptz;
begin
  if p_country is null or p_country !~ '^[A-Z]{2}$'
     or p_media_type is null or p_media_type not in ('movie','tv')
     or p_title_id is null or p_title_id < 1
     or p_viewer_hash is null or p_viewer_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid title view' using errcode = '22023';
  end if;
  -- Serialize one visitor, including simultaneous tabs, before dedup/rate checks.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_viewer_hash, 0));
  select viewed_at into last_seen from public.title_view_receipts
    where viewer_hash = p_viewer_hash and country_code = p_country
      and media_type = p_media_type and title_id = p_title_id;
  if last_seen > now() - interval '30 minutes' then return 'duplicate'; end if;
  if (select count(*) from public.title_view_receipts where viewer_hash = p_viewer_hash
      and viewed_at > now() - interval '1 hour') >= 60 then return 'rate-limited'; end if;

  insert into public.title_view_receipts (viewer_hash, country_code, media_type, title_id)
    values (p_viewer_hash, p_country, p_media_type, p_title_id)
    on conflict (viewer_hash, country_code, media_type, title_id) do update set viewed_at = now();
  insert into public.title_view_hourly (country_code, media_type, title_id, bucket_start, view_count)
    values (p_country, p_media_type, p_title_id, date_trunc('hour', now()), 1)
    on conflict (country_code, bucket_start, media_type, title_id)
    do update set view_count = public.title_view_hourly.view_count + 1;
  perform public.prune_title_interest();
  return 'recorded';
end;
$$;

create function public.get_country_title_interest(p_country text)
returns table (country_code text, media_type text, title_id bigint, recent_views bigint, score double precision)
language sql stable security definer set search_path = '' as $$
  with recent as (
    select h.media_type, h.title_id, sum(h.view_count)::bigint as recent_views,
      sum(h.view_count * power(0.5::double precision,
        extract(epoch from (now() - h.bucket_start))::double precision / 259200)) as score
    from public.title_view_hourly h
    where h.country_code = p_country
      -- 168 hourly buckets, excluding future and lifetime activity.
      and h.bucket_start >= date_trunc('hour', now()) - interval '167 hours'
      and h.bucket_start <= now()
    group by h.media_type, h.title_id
  ), eligible as (
    select *, row_number() over (partition by media_type order by score desc, recent_views desc, title_id asc) as position
    from recent where recent_views >= 3 and (select coalesce(sum(recent_views), 0) from recent) >= 10
  )
  select p_country, media_type, title_id, recent_views, score
  from eligible where position <= 15 order by media_type, position;
$$;

revoke all on function public.record_title_view(text,text,bigint,text), public.get_country_title_interest(text), public.prune_title_interest() from public, anon, authenticated;
grant execute on function public.record_title_view(text,text,bigint,text), public.get_country_title_interest(text), public.prune_title_interest() to service_role;
comment on function public.get_country_title_interest(text) is 'Country-only, rolling 168 hourly buckets, 3-day half-life. Minimum 3 views/title and 10/country; application fills with existing country discovery.';
commit;
