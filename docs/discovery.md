# TMDB current discovery — 24 September 2026

This update implements the user's choice to improve TMDB discovery after comparing iFynex with JustWatch. It prioritizes current interest over the previous large local-origin bonus. Code is updated locally; deployment is a separate step. Production contains no hardcoded title names, fabricated provider data or invented iFynex activity.

## Why older and overly local results appeared

The original movie activity query was `/discover/movie` with `watch_region`, `with_origin_country`, monetization types, `primary_release_date.lte` and `sort_by=popularity.desc`, without a lower release-date bound. Old popular catalog titles therefore entered the pool. Original home/browse local bonuses differed (44/60) and older exceptions could replace recent slots. There were partial trend/airing safeguards, so not every older title was admitted purely on popularity.

The first current-only revision closed that unbounded movie query, but its local bonus was still 32 points — as large as the entire weekly trend contribution. A very recent local release needed normalized popularity only 0.4 (roughly 5.3 raw popularity), even with no votes. That promoted obscure recent local titles as though they were trends. The latest update fixes this ranking problem and separates latest releases from trends.

## Endpoints and request budget

- Global rows still use `/trending/movie/week` and `/trending/tv/week`, preserving their original returned order.
- Country ranking additionally uses `/trending/movie/day` and `/trending/tv/day`.
- Each type uses four bounded, first-page Discover pools: local and all-origin releases in the last 180 days; local and all-origin movie releases in the last 60 days (newest first), or TV airing in the last 28 days. No arbitrary catalog pagination.
- Discover always pairs `watch_region` with `with_watch_monetization_types=flatrate|free|ads|rent|buy`. Local pools also use `with_origin_country`. All release dates end at today. A small candidate floor (5 votes, rating 6) avoids unrated stubs crowding the limited pool. Trending feeds do not use that Discover floor.
- Up to four unseen daily/weekly titles per type receive actual `/{type}/{id}/watch/providers` checks. Empty regional offers mean exclusion. Provider names and links still come only from TMDB.
- Maximum cold request budget: eight Discover calls, four shared feeds, eight bounded provider probes = 20. Homepage adds two genre calls. Latest releases reuse the same fetched candidates. Filters and pagination reuse cached URLs; no per-card detail requests.
- Requests stay server-side with the existing 30-minute Next fetch cache/revalidation; genres retain 24-hour caching. The API key is never sent to the browser. Refresh happens on subsequent requests after cache expiry, not through an invented background job.

## Eligibility before scoring

Require a valid media ID, a valid nonfuture release/premiere date, and reported legal offers in the selected country. Reject rating below 5.5 when at least 10 votes exist. Country origin never relaxes these rules.

At least one current-interest signal must exist:

1. Actual daily or weekly TMDB feed membership.
2. Release in the last 90 days, at least 20 votes, rating at least 6, popularity at least 20.
3. Emerging release in the last 45 days, at least 5 votes, rating at least 6, popularity at least 20. Lower vote counts reflect sparse TMDB coverage; this is explicitly labeled audience interest, not an actual TMDB trend.
4. TV with episode-airing evidence in the last 28 days, at least 100 votes, rating at least 6.5 and popularity at least 30. A series' premiere year is not treated as the date of its latest season.
5. A future verified country-matched iFynex signal of at least 0.5, with at least 20 votes and rating 6. This signal is absent in production.

Older titles (before July 1 of the previous year) additionally require at least 20 votes and rating 6. Mere lifetime popularity, vote accumulation, availability or origin cannot qualify a stale title.

## Exact score

```text
S = 50 × max(D, 0.85 × W) + 10 × B
  + 18 × R + 6 × E + 12 × P + 4 × Q + 8 × L + 20 × I

D, W = 0 if absent; otherwise 0.25 + 0.75 × (N - index) / N
       in the respective type-specific daily / weekly feed (zero-based index).
B = 1 only when present in both feeds; otherwise 0.
P = clamp(ln(1 + max(0, popularity)) / ln(101), 0, 1).
Q = clamp(rating / 10, 0, 1) × votes / (votes + 50).
R = max(2^(-releaseAgeDays / 90), 0.8 if qualified recent TV airing else 0).
E = 1 if qualified recent TV airing; otherwise 2^(-age / 30)
    for releases within 90 days, or 0 for earlier releases.
L = 1 for selected-country origin, otherwise 0.
I = validated trailing-seven-day iFynex score, currently always 0.
```

Daily/weekly evidence contributes up to 60 points. Country origin now contributes 8 rather than 32. Popularity is bounded at 12 and quality at 4. A date alone never grants trending eligibility. No measured growth or rank-change claim is made: daily/weekly agreement is confirmation, not a historical momentum series.

## Country relevance and selection

The existing CountrySelector, CountryProvider, cookie/localStorage and profile-country architecture are unchanged. Region comes from that architecture, never a hardcoded India default in the ranker. Locality comes from actual origin/production metadata or a `with_origin_country` query. Co-productions can be local in multiple countries. Reported regional offers are mandatory for both local and international results.

Current/carryover releases are ranked by score, date, media type and ID. Qualified older series with recent episodes can compete by score, but take at most 20% of any leading selection: at least four current releases precede the first returning series. This is a ceiling, not a quota. After three of one media type, the other type can move up only if within 10 points and the same freshness group.

Other genuine older resurfacing titles are appended only after the current selection, at most `min(floor(selectedCount/9), floor(limit/10), remainingSpace)`. No slots are reserved for them. The finite chart is capped at 120. Newest sorting reorders that same eligible set; it never broadens discovery.

There is deliberately no guaranteed local majority. With sparse current TMDB evidence, forcing one would recreate the weak local filler the user rejected. Local content is fetched explicitly and receives an origin preference; strong international trends can lead. A **From [Country]** origin filter and homepage link expose qualifying local titles without weakening eligibility. The five-country counts below make this tradeoff explicit.

## Freshness and the Latest releases surface

Dates roll with the server's UTC date. On this audit: 180-day retrieval starts March 28, the 60-day latest window starts July 26, and recent TV airing starts August 27, 2026. Late-2025 titles can remain when daily/weekly or qualifying episode activity supports them. Older popular movies with no current signal are excluded.

Latest releases are separate from Trending: release/premiere within 60 days, at least 5 votes, rating 6 and popularity 10, plus reported country offers. They sort by date first, then bounded popularity and a 5-point origin tiebreaker. This is a curated recent-release selection, not a complete release calendar. It does **not** claim a streaming-service addition timestamp, an exact regional premiere date, or new-season dates.

## Homepage, Movies + TV, and See All

Homepage: compact search header → Trending in selected country (up to 24) → Latest releases (up to 24) → original global movie/TV weekly rows → separate genre discovery. Evidence badges distinguish TMDB today, TMDB this week, recent episodes and recent release/audience-interest signals.

Both media types have independent trend feeds and candidate pools, combined on the same score scale. Identity is `mediaType:id`, so matching numeric IDs do not collide.

`/country/trending` and home use the same eligible pool/ranking, paginated by 24. All/Movies/TV, origin, release-year and current/newest controls narrow or reorder that finite pool. `/country/releases` has its own See All and the stricter 60-day release window. Country changes hide stale results while the existing server refresh completes. Authentication, wishlist, profiles, detail pages and Where to Watch were not changed.

## Remaining TMDB limitation and future activity

TMDB has global short-window trending, not JustWatch-style country activity charts or actual provider playback numbers. Origin + regional availability + recent metadata are proxies. This remains an explicitly labeled estimate, not proof of what Indian/Japanese/etc. users watched. Provider coverage and TMDB vote coverage can lag.

The pure scorer accepts an optional typed CountryActivitySignal map. It validates region, age (0–7 days), and a bounded recentScore. A later server adapter can aggregate real searches, title views, wishlists and provider clicks by country and time. Production supplies none now. Durable historical popularity snapshots would need a real storage adapter; they are not simulated with process memory or invented events.

Primary references: [TMDB movie trends](https://developer.themoviedb.org/reference/trending-movies), [TMDB TV trends](https://developer.themoviedb.org/reference/trending-tv), [Movie Discover](https://developer.themoviedb.org/reference/discover-movie), [TV Discover](https://developer.themoviedb.org/reference/discover-tv), [Popularity versus trending](https://developer.themoviedb.org/docs/popularity-and-trending).

## Verification

Live TMDB audit, September 24, 2026 (data changes over time):

| Country | Home count | 2026 releases | Older returning series | Local on home | Movies / TV | Daily or weekly evidence | Full trending count |
|---|---:|---:|---:|---:|---:|---:|---:|
| India | 24 | 20 | 4 | 5 | 11 / 13 | 14 | 43 |
| USA | 24 | 20 | 4 | 20 | 12 / 12 | 22 | 58 |
| UK | 24 | 20 | 4 | 7 | 10 / 14 | 17 | 46 |
| Japan | 24 | 20 | 4 | 1 | 9 / 15 | 13 | 42 |
| South Korea | 24 | 19 (+1 late-2025) | 4 | 4 | 8 / 16 | 11 | 41 |

No stale old movie appeared in these home selections. Country fingerprints differ. Both media types, live provider samples, latest-release date boundaries, media/year/origin filters and pagination are checked. The audit verifies home equals See All page one for both surfaces and that pagination introduces no additional catalog queries. Sanitized evidence: `docs/country-discovery-live-audit.json`.

- Regression tests: 35 passing (ranking, feed precedence, weak local rejection, date rollover, late-2025, returning-series ceiling, origin filter, real availability, caching contracts, unchanged global ordering and finite pagination).
- `npm run lint`: passes, zero errors; one pre-existing `next/no-img-element` warning in `components/wishlist-page.tsx`.
- `npm run build`: passes; includes the new `/country/releases` route.
- Browser checks: five-country selection produced five distinct 24-card lists. Verified origin filter, Movies/TV filters, page two, Latest See All, title navigation and reported Where to Watch providers. Desktop and 390px mobile layout inspected; no horizontal overflow or browser-console errors observed. Temporary preview server/tab stopped after verification. Google sign-in and wishlist mutations were not exercised; their implementations were unchanged. Final build passed after removing a verified generated .next cache subfolder blocked by OneDrive.
