# Figma homepage and country interest

Source frame: https://www.figma.com/design/1lGB1T2RgZl7mCQoDlncmy/Untitled?node-id=7-7

The existing Next.js/TMDB/Supabase architecture is retained. The homepage uses the frame's hero, curved violet transition, ranked movie/show shelves, two wide TV features, new-TV shelf, popular banner, country OTT strip, closing CTA and sparse black footer. Existing branding is retained; the prototype's placeholder movie names, posters and promotional copy are not production data. Hero, cards and banner now use real TMDB content. Other pages retain the existing footer.

## Activate persistent interest

1. Open `supabase/migrations/004_title_interest.sql` and **copy the SQL file contents**, not its filename/path, into your existing Supabase project's SQL Editor. Run the complete script, including `begin;` and `commit;`. It is one migration, to be applied once.
2. Add `SUPABASE_SERVICE_ROLE_KEY` to `.env.local` and to the deployed app's server environment. Use the service-role key for the same project as `NEXT_PUBLIC_SUPABASE_URL`. Never prefix it with `NEXT_PUBLIC_`, commit it, or paste it into chat. The existing public anon key remains unchanged.
3. Optionally set `TITLE_INTEREST_SECRET` to an independent random signing secret. If omitted, the server-only service-role key signs anonymous cookies and daily hashes.
4. Restart the local server or redeploy after updating the server environment. No production deployment was performed during this task.

Until both migration and server key are configured, the homepage continues using existing country discovery. The tracking endpoint responds `503 unavailable`; title details, search, providers and wishlists remain usable.

## Recording and privacy

- `TitleViewTracker` runs only on a successfully rendered movie/TV detail page. A page must be visible for 1.5 seconds. Link prefetch, server rendering, metadata generation and hidden tabs do not count as views.
- The POST endpoint validates same-origin requests, bounds request bodies, verifies the title through the existing TMDB metadata adapter, and verifies signed-in access tokens with Supabase.
- Signed-in activity uses the existing saved profile country, falling back to signup metadata. Guest activity uses the existing country preference cookie. Failed authentication never silently records as a guest.
- Anonymous clients receive a signed, HttpOnly, SameSite=Strict first-party cookie. The database stores only a daily HMAC-derived visitor hash, country, media type, title ID and timestamps/counts. No raw account IDs, IP addresses, emails or fingerprints are stored in analytics. Daily identity rotation can allow a fresh count across UTC midnight.
- Database deduplication counts a title at most once per visitor/country per 30 minutes. A visitor cannot add more than 60 distinct titles within an hour. An advisory transaction lock covers simultaneous tabs; atomic upserts prevent lost counts.
- Do Not Track and Global Privacy Control are honored. An auth token refresh alone does not create a fresh page-view event.
- Receipts older than one day and aggregates older than eight days are pruned at most hourly on accepted activity. If exact wall-clock retention during inactivity is required, schedule `select public.prune_title_interest();` using the project's database scheduler. No external tracking service is added.
- Tables and functions are inaccessible to `anon` and `authenticated`; only server-role RPCs can record/read rankings.

## Ranking, caching and fallback

`get_country_title_interest` uses the latest 168 hourly buckets. Each bucket contributes `views × 0.5^(age_in_days / 3)`, giving a three-day half-life. Future buckets and older activity are excluded. Ties resolve by recent count and then title ID.

A title needs at least three accepted checks; a country needs at least ten total recent checks before community ranking is used. Ranked titles lead the appropriate movie/TV Top 10. Remaining places are filled from the existing country/TMDB discovery, without duplicate media identities. If metadata disappears or services are unavailable, valid fallback titles remain. The original India editorial/discovery fallback is preserved; it does not override eligible community ranks.

One country-keyed server fetch reads the compact ranking, cached by Next.js for five minutes. It does not scan raw events on each homepage load. Hydration uses the existing cached TMDB metadata helper, bounded to 15 candidates per media type. Cache revalidation may serve one stale response while refreshing. Reloading immediately after a view does not guarantee a changed chart.

The SQL has no country-specific branches. Countries enabled in the existing shared country/profile configuration use the same recording, ranking and fallback code. This change does not alter which countries onboarding currently exposes.

## Verification

- `node --test tests/*.test.mjs`: 89 passing tests, including existing discovery, release, provider and OTT coverage plus new endpoint, country resolution, signed cookie, fallback, cache and security tests.
- `node tests/title-interest-sql.mjs <PGlite module URL>`: actual PostgreSQL migration/functions tested in an isolated in-memory database. Verified recording, duplicates, IN/US/GB isolation, new-country NZ behavior, minimum activity, seven-day expiration, recent weighting, changing leaders, movie/TV identity, rate limiting, private grants and cleanup. No synthetic events were inserted into production Supabase.
- TypeScript: passed. Production build: passed. Lint: zero errors; one pre-existing `no-img-element` warning in `components/wishlist-page.tsx`.
- Live browser: India, USA and UK returned distinct movie/TV lists and provider catalogues, with ten movies and ten shows each. Dynamic banner controls changed title/artwork/destination. Existing mobile search input was restored by reusing `SearchForm`; the tablet header retains search access.
- Responsive widths: 1440 desktop, 768 tablet, 390 mobile; no horizontal page overflow.
- Desktop heading Y positions: movies 840, shows 1325, wide TV features 1983, new TV 2566, popular 3109, OTT 3652. These follow the source frame's positions (OTT differs by three pixels). Footer begins near 4307 versus 4300 in Figma; content and text naturally vary.
- All reused static Figma assets (hero arc, heart, account, arrow and arrow disc) were hash-checked against fresh exports. Banner dots use the exact local 75×15 SVG export. All media imagery and provider logos remain dynamic.

This machine has a previously documented TMDB DNS problem. Live verification used a test-process-only resolver with the original HTTPS hostname and certificate checks intact. Production code and OS network settings were not changed.

Persistent production recording still needs the activation steps above to be completed and verified; isolated SQL tests do not claim production activation.

Implementation references: [Supabase function security](https://supabase.com/docs/guides/database/functions), [server-only service credentials](https://supabase.com/docs/guides/database/secure-data), and the installed Next.js 16.3.1 route-handler, fetch, cookie and caching documentation.
