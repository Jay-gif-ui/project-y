# Current-only country trending — 24 September 2026

Implemented in the existing Project-Y repository. This report describes the shipped code, not a proposed or manually curated list. No title IDs or names are hardcoded in production.

## 1. Why older titles could appear

The inspected implementation already used actual weekly endpoints for Global Trending; that part was correct. The remaining country path was `getCountryDiscovery` → `discoveryParams(..., {local:true, activity:true})` → `rankCountryDiscovery`.

For movies, the activity query was `/discover/movie` with `watch_region=<country>`, `with_origin_country=<country>`, `with_watch_monetization_types=flatrate|free|ads|rent|buy`, `primary_release_date.lte=<today>` and `sort_by=popularity.desc`, **without a lower release-date bound**. Thus old popular catalog movies entered the candidate pool. TV used an unbounded premiere date plus an episode-airing window of 90 days. The existing scorer did require trend/airing evidence for old exceptions, but gave locality 44 points on home and 60 on browse and could reserve/replace recent slots with older exceptions (up to 20%). Local recent-window titles could also qualify on historical quality without a stronger current-interest gate. Home and browse used different weights and pools.

Therefore it would be inaccurate to say every old result was admitted solely on popularity: there were already partial safeguards. The broad activity pool, loose activity window and old-slot reservation were the concrete paths addressed here. A series card still displays its original premiere year, even when recent episodes are the current signal.

## 2. TMDB endpoints and candidate queries

- Global: `/trending/movie/week` and `/trending/tv/week`, with each response's order preserved in separate rows. No Discover substitution, country reranking or injected catalog titles.
- Country: `/discover/movie` and `/discover/tv`, plus those same shared weekly feeds.
- Missing weekly-trend candidates: `/{movie|tv}/{id}/watch/providers` before country inclusion, at most four previously unseen trend candidates per type.
- Genre discovery retains its separate existing queries. Detail/provider pages retain their existing endpoints and links.

For each requested media type the country pipeline fetches:

1. Local releases within the last 180 days, pages 1 and (only when available) 2, with `with_origin_country=<selected country>`.
2. Releases within the last 180 days, page 1, without an origin restriction.
3. Local movie releases in the last 60 days, ordered by `primary_release_date.desc`, or local TV with episode-airing evidence within the last 28 days.

All Discover requests specify `watch_region` **and** `with_watch_monetization_types=flatrate|free|ads|rent|buy`. Release/premiere dates end at today. Other candidate pools use `popularity.desc` only to bound retrieval; their order is never used as the final country chart. The unbounded country movie activity query is gone. Genuine older movie trends enter through the weekly feed with a real provider check.

## 3. Exact eligibility and score

Eligibility happens **before** any origin bonus. Require a valid ID, valid nonfuture release/premiere date and reported selected-country availability. Reject ratings below 5.5 when at least ten votes exist. Established support means at least 20 votes and rating at least 6.

Define `P = clamp(ln(1 + max(0, popularity)) / ln(101), 0, 1)`. This fixed normalization cannot be distorted by an unrelated huge-popularity catalog title or by loading another page.

At least one current signal is mandatory:

- Membership in the actual type-specific weekly trending feed.
- Release within 60 days with `P >= 0.4`, or release within 61–180 days with established support and `P >= 0.35`.
- TV airing within 28 days with established support and `P >= 0.35`. A catalog series from before the previous July additionally needs at least 50 votes, rating at least 6.5 and `P >= 0.6`.
- A future verified iFynex signal of at least 0.5, with established support. This is **not supplied in production today**.

Titles without established support need weekly membership or emerging interest within 60 days (`P >= 0.4`). Older-than-window exceptions always require established support. Nonlocal titles additionally need a weekly trend, a future verified iFynex signal, or established support with `P >= 0.9` and release within 30 days / qualifying current airing. This makes international admission selective without imposing a local/international percentage.

For eligible titles:

```text
score = 40 × 2^(-ageDays / 90)
      + Y
      + 12 × P
      + 8 × (clampedRating / 10) × votes / (votes + 50)
      + 32 × T
      + 12 × A
      + 32 × L
      + 20 × I

Y = 20 for the current year, 8 for previous July–December, otherwise 0
T = (weeklyFeedLength - zeroBasedPosition) / weeklyFeedLength; 0 if absent
A = 1 for qualified recent-airing evidence, otherwise 0
L = 1 for verified selected-country origin, otherwise 0
I = validated recent iFynex score, currently always 0
```

The popularity contribution is capped at 12 points and cannot establish current relevance for a stale catalog title. Quality uses vote confidence, rather than rewarding accumulated vote totals directly. Weekly position is only a country-scoring input; the actual Global Trending rows remain untouched.

## 4. Country relevance and ordering

The selected country still comes from `CountrySelector`, `CountryProvider`, the `ifynex_country` cookie, localStorage, and the existing profile-preference fallback. No India-specific ranking branch, language substitution or new country state exists. Browsing-country changes do not write profile country.

Locality comes from TMDB's `origin_country` / `production_countries` metadata or membership in a real `with_origin_country` response. Co-productions can be local in more than one country. Country availability is an entry gate, not an invented provider-name bonus.

Sort current-window releases before catalog exceptions, then descending score, descending release date, media type and ID. The full curated selection is bounded at 120. Catalog exceptions are appended only up to `min(floor(selectedRecentCount/9), floor(limit/10), remainingSpace)` — at most 10%, with no reserved slots or replacement of recent titles. Sparse markets stay short.

Soft diversity is applied only to default current relevance ordering:

- After three of one media type, the next title of the other type may move up if within 20 points and in the same freshness group.
- After six local titles, a genuine international weekly trend may move up if within 32 points (the origin bonus) and in the same freshness group. Media diversity takes precedence when both rules apply.

These rules only reorder qualified, competitive candidates; they never inject filler, use a fixed 50/50 split, or force an international title when no strong candidate exists. Newest sorting preserves release-date order within freshness groups instead.

## 5. Freshness in 2026 and beyond

All dates use the server's current UTC date, not a hardcoded 2026 cutoff. At this audit, recent retrieval starts on 28 March 2026, fresh retrieval on 26 July, and airing on 27 August. The current/carryover grouping starts on 1 July 2025. Earlier-2026 and late-2025 releases more than 180 days old require weekly or current-airing evidence; historical popularity and ratings alone cannot keep them in the list. Genuine older resurfacing titles remain possible through those evidence paths.

## 6. Movies and TV

Both types have their own candidate queries and weekly feed. Deduplication uses media type plus ID, so a movie and series sharing a numeric ID stay distinct. Scores use the same bounded scale and combine across types, with competitive media diversity rather than a fixed 12/12 quota. All/Movies/TV filters only change which types are fetched.

## 7. Homepage and See All

Homepage shows up to 24 country picks alongside the existing 20 movie and 20 TV global rows. Explore by Genre stays separate. `/country/trending` uses the **same eligibility, pool and score** and paginates that finite selection in groups of 24. Its first page matches home for the same upstream snapshot. Newest/current relevance and current-year/all-current filters are shareable query parameters; switching a filter resets page one and invalid/out-of-range pages clamp safely.

Pagination slices already-qualified results. It never walks arbitrary TMDB catalog pages or relaxes freshness to fill a page. Counts describe the bounded current selection, not all available titles in the country. Cached data can change on revalidation, so separate visits can legitimately reflect newer upstream data.

## 8. Remaining TMDB limitation and legal availability

TMDB supplies global weekly interest, not true country-level watch charts or exposed per-country daily user counters. The country heading is explicitly described as an estimate. Origin, current release/airing evidence and regional availability are proxies; the code never claims that Indian, American or other local users actually watched these titles. TMDB provider reporting can lag and does not guarantee a user's entitlement. The existing Where to Watch flow still displays only actual provider data and links.

Sources: [TMDB popularity versus trending](https://developer.themoviedb.org/docs/popularity-and-trending), [Movie Discover](https://developer.themoviedb.org/reference/discover-movie), [TV Discover](https://developer.themoviedb.org/reference/discover-tv).

## 9. Future iFynex activity

`lib/country-trending.ts` separates candidate retrieval, eligibility, scoring and final ordering, and exposes `CountryActivitySource` / `CountryActivitySignal`. A later server adapter can aggregate real searches, title views, wishlist additions and provider clicks by country over a trailing seven-day window. It supplies normalized scores keyed by media type plus ID. Cross-country, future-dated and more-than-seven-day-old signals are rejected. No adapter is configured, no activity events are fabricated, and no tracking/profile/authentication changes are included now. A later editorial adapter can operate separately without replacing automatic retrieval.

## 10. Performance and preservation

Per country/type: at most four Discover requests plus four bounded provider checks and one shared weekly feed. An All page therefore uses at most 18 cold requests before retries; homepage additionally uses two existing cached genre lists. Provider responses include all countries, so their cache can be reused across country switches. Home reuses the same two global promises. There are no per-card detail fetches and no new requests for later result pages when fetch entries are warm. The five-country audit including all pagination, media/year/sort filters and provider samples made 61 unique network requests total.

Existing server-only TMDB helper retains 30-minute revalidation and 24-hour genre caching. Cache URLs distinguish country/date/type/page. API credentials remain in the server process. CountrySelector, CountryProvider, Google authentication, wishlist, profile country, detail pages and Where to Watch code were not edited.

## 11. Verification

- `node --test tests/discovery.test.mjs tests/country-trending.test.mjs`: **28 passed**.
- `npm run lint`: **passed**, zero errors; one pre-existing `@next/next/no-img-element` warning in `components/wishlist-page.tsx`.
- `npm run build`: **passed**, including TypeScript and all routes. One rerun encountered an existing OneDrive read-only flag in generated `.next` output; clearing only those generated-output flags allowed the final build to pass.
- Real audit: `node --env-file=.env.local tests/live-country-discovery.mjs`; sanitized evidence in `docs/country-discovery-live-audit.json`.

| Country | Home local / total | Home 2026 | Home movies / TV | See All local / total | See All older exceptions |
| --- | ---: | ---: | ---: | ---: | ---: |
| India | 17 / 24 | 24 / 24 | 14 / 10 | 21 / 37 | 3 |
| USA | 21 / 24 | 24 / 24 | 14 / 10 | 84 / 88 | 8 |
| UK | 16 / 24 | 24 / 24 | 11 / 13 | 39 / 55 | 5 |
| Japan | 15 / 24 | 24 / 24 | 7 / 17 | 19 / 31 | 3 |
| South Korea | 17 / 24 | 24 / 24 | 6 / 18 | 35 / 44 | 2 |

Every country had different results, local majority, both media types and international current titles. South Korea's full list also contained one late-2025 title with current evidence. Older exceptions followed all current-window titles and remained below 10%. Provider samples from every country returned real providers. These are live snapshot measurements, not promised future counts or quotas.

Browser verification on the production preview passed See All navigation, matching home/page-one under the same refreshed cache, nonduplicate page two, Movies/TV filters, newest/current-year controls, the existing country selector for all five countries, preserved filters across country switches and country persistence after reload. Global chart ordering stayed unchanged when the homepage country changed. No browser console errors appeared during those checks. All 19 generated client JavaScript files were checked; none contained the configured server TMDB credential. Authentication itself was not re-exercised; its source remains unchanged.

The machine's system DNS timed out for TMDB. Live auditing and the local preview used a temporary process-only lookup through 1.1.1.1 for the same official TMDB hostname with normal HTTPS certificate verification. No OS DNS, TLS setting, application endpoint or production configuration was changed.
