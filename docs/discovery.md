# Current discovery implementation — 23 September 2026

The existing Next.js project, country registry, CountrySelector, authentication, wishlist and TMDB provider APIs are retained. The homepage now has three major sections: Global trending, Popular to watch in the selected country, and Explore by genre.

## What caused old catalog dominance

The original country queries sorted four unrestricted Discover pools by popularity, with no release-date or airing window. Normalization discarded popularity, so the final two-general/one-local merge could not apply freshness weights. A 25-vote minimum also disadvantaged new releases. All-time Top Rated Movies and unrestricted Popular TV were separate homepage rows. They are no longer presented as current discovery; existing generic collection helpers remain available.

## Global trending

- Fetch `/trending/movie/week` and `/trending/tv/week`, `language=en-US`, adult content excluded.
- Preserve each feed's returned order and show separate movie and TV rows.
- Do not apply country filters or re-rank by year. An older title, or an unreleased title generating current interest, can legitimately appear here.
- Rank numbers appear only on these actual global trend rows.

## Country selection and queries

Read the existing `ifynex_country` cookie and validate through `lib/countries.ts`. Initialize CountryProvider from the same server value to avoid hydration/country mismatch. Migrate the existing localStorage preference when the cookie is absent. Navbar changes persist the browsing preference and call `router.refresh()` in a transition; pending content is clearly indicated. Profile country is only read and never updated. A pending profile lookup cannot override an explicit navbar choice.

There are three Discover candidate requests per media type, six total. Each requests page 1, `sort_by=popularity.desc`, `watch_region=<selected country>`, and `with_watch_monetization_types=flatrate|free|ads|rent|buy`. The unrestricted pools include every origin/language; only the supplemental local pool has `with_origin_country=<selected country>`.

1. Recent international + local pool: previous January 1 through today, using `primary_release_date.gte/lte` for movies and `first_air_date.gte/lte` for TV. On this audit date the window is 2025-01-01 through 2026-09-23.
2. Recent local pool: same dates plus selected origin country.
3. Activity pool: movies retain the upper release-date bound, without a lower bound; older movies qualify only if also in the current global weekly feed. TV additionally uses `air_date.gte=today-90 days` and `air_date.lte=today`, allowing older series with current episodes. Older TV can also qualify by current weekly trend membership when present in a retrieved, region-available pool.

TV requests exclude null first-air dates. Future/undated releases are excluded from country and genre selections. No per-title provider requests are made on the homepage; region availability is established by Discover's watch filters. Detail pages retain real TMDB watch-provider data.

## Exact editorial score and selection

Score each media type separately after deduplicating candidates by `mediaType:id` and merging local/airing evidence:

```text
score = 45 × 2^(-releaseAgeInDays / 180)
      + yearBoost
      + 25 × ln(1 + popularity) / max(1, maximum ln(1 + popularity) in eligible pool)
      + weeklyTrendBoost
      + recentTVAiringBoost

yearBoost = 20 for current year, 12 for previous year, otherwise 0
weeklyTrendBoost = 10 × (feedLength - zeroBasedFeedPosition) / feedLength
                   when present in that media type's weekly feed, otherwise 0
recentTVAiringBoost = 10 when returned by the last-90-days TV airing query, otherwise 0
```

Release freshness has a 180-day half-life; logarithmic popularity prevents one huge catalog score from overwhelming it. Score ties use descending release date, then ascending TMDB ID. These are documented product weights, not an official TMDB country score or measured viewing rank. Scores are not displayed as factual rankings.

Country selection takes up to nine movies and nine TV shows. Within each type, select two highest-scoring available candidates and then the highest-scoring local candidate, repeating; if no local candidate is available, use the next ranked candidate. Unrestricted slots may also naturally contain local titles. Deduplicate before selection. Alternate the resulting movie/TV lists, up to 18 cards, with the type shown on every card.

Older picks must have the current evidence described above and are limited to `min(floor(limit / 4), floor(recentCandidateCount / 3))`. For nine titles per media type, this allows at most two older titles, so the full country selection has at least 14/18 recent releases. Sparse regions show shorter lists, not unrestricted old/global filler. A region is not guaranteed to have every origin or both types if TMDB reports insufficient availability.

## Genres

Fetch official `/genre/movie/list` and `/genre/tv/list`; retain their separate IDs and names (for example TV's Action & Adventure / Sci-Fi & Fantasy). Choosing a genre calls the server-only `/api/discover` route. The route validates type, period and the genre against that media type's official list and reads the existing browsing-country cookie.

Default: recent + activity pools for the chosen type/genre, the same score, up to 18 results, and the same older-title cap. Current-year-only mode requests one recent pool beginning January 1 of this year and excludes all older releases. Both modes use `with_genres`, watch-region availability and `popularity.desc` before freshness ranking. Changing media type clears the genre; changing country, genre or release window aborts the previous client request and removes stale results. Empty/error/partial states are explicit; failed requests can be retried.

## Caching and performance

- Homepage cold budget: two global feeds + six Discover requests + two genre lists = ten requests (excluding transient retries). Global promises are shared with country ranking.
- TMDB data uses Next.js server fetch caching with 30-minute revalidation; genre metadata uses 24 hours. Country/type/genre/dates are part of the URL cache identity.
- Removed homepage `force-dynamic`, which overrode fetch caching. `cookies()` still makes rendering request-specific.
- Genre results load only after selection: two Discover calls normally, one in current-year-only mode, plus reusable cached genre/trending lookups.
- Browser discovery responses are private/no-store and vary by cookie. Credentials remain server-only; production client bundles were checked for credential leakage.
- Removed the old unbounded in-memory successful-collection fallback, which could indefinitely serve a stale current feed. Next.js owns revalidation/stale behavior. Genuine empty results stay empty, and partial upstream failures are surfaced.

## Verification

`npm run lint`: passed, zero errors; one pre-existing `@next/next/no-img-element` warning in `components/wishlist-page.tsx`.

`npm run build`: passed, including TypeScript and production route generation.

`node --test tests/discovery.test.mjs`: 12 tests passed. Covers all 23 country query mappings, both media types, UTC year rollover, future/null dates, old-popularity domination, current-evidence exceptions, caps, local balance, deduplication, global order, empty/failure handling and official TV genre IDs.

Live audit: `node --env-file=.env.local tests/live-discovery.mjs`. The sanitized timestamped result is in `docs/discovery-live-audit.json`; it contains actual IDs, dates, provider samples and query parameters, with credentials omitted.

| Country | Original recent titles / 18 | Updated recent titles / 18 | Updated Movies + TV |
| --- | ---: | ---: | --- |
| India | 7 | 18 | 9 + 9 |
| United States | 9 | 18 | 9 + 9 |
| United Kingdom | 9 | 18 | 9 + 9 |
| Japan | 6 | 18 | 9 + 9 |
| South Korea | 7 | 18 | 9 + 9 |

Drama genre audit: Movies 18/18 recent in India and USA; TV 16/18 in India and 17/18 in USA, retaining current older exceptions. Four provider samples per country (20 total) all returned real providers. These are a snapshot, not permanent title counts or guarantees.

Browser verification: India → USA changed all country context and returned 18 cards while global trending text/order remained identical. Movie Drama results, TV-specific genres, 18 current-year TV results and rapid Japan → India changes worked. No browser console errors were observed. The API rejected an invalid media type with 400 and returned TV results for the cookie-selected USA with the expected private cache headers. Title navigation and Where-to-Watch provider refresh from India to USA also passed using real provider data. No authentication or wishlist mutation was performed.

## Remaining limitations

- TMDB offers global popularity/trending, not country viewing rankings or raw daily activity metrics. Country selection is an honest approximation using regional watch availability; provider reports can lag and do not guarantee a subscription entitlement or a direct playback URL.
- Bounded first-page candidate pools are deliberate. An older global trend absent from these region-available pools will not appear in the country/genre selection. TV freshness uses series premiere plus query-level recent airing evidence, not an invented new-season release date.
- This machine's normal DNS resolved `api.themoviedb.org` to a timing-out address. Live/browser verification used a temporary process-only resolution through 1.1.1.1 to the same official HTTPS host, with certificate checks intact. No system DNS, application endpoint or TLS settings were changed. Normal local runs can still hit this existing DNS issue; the hosting environment must be able to reach TMDB.

## Changed files

- `app/page.tsx`, `app/layout.tsx`, `app/globals.css`, `app/api/discover/route.ts`, `app/[type]/[id]/page.tsx` (correct initial watch-provider region).
- `lib/tmdb.ts`, `lib/media.ts`, new `lib/discovery.ts`.
- `components/country-provider.tsx`, new `components/country-discovery.tsx`, new `components/genre-explorer.tsx`, `components/movie-card.tsx`, `components/movie-grid.tsx`, `components/navbar.tsx`, `components/footer.tsx`.
- `tests/discovery.test.mjs`, `tests/load-typescript.mjs`, `tests/live-discovery.mjs`.
- `docs/discovery.md`, `docs/discovery-live-audit.json`.

Official references: [TMDB popularity and trending](https://developer.themoviedb.org/docs/popularity-and-trending), [movie Discover](https://developer.themoviedb.org/reference/discover-movie), [TV Discover](https://developer.themoviedb.org/reference/discover-tv), [movie genres](https://developer.themoviedb.org/reference/genre-movie-list), [TV genres](https://developer.themoviedb.org/reference/genre-tv-list). Relevant installed Next.js fetch, cookie and route-handler documentation was read before editing.
