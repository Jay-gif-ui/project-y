# Country discovery and local/international allocation — 24 September 2026

The latest request replaces the former soft country preference with an explicit local-led mix. Production has no hardcoded titles or invented activity/provider data. Changes are local and have not been deployed by this task.

## Selection and limits

- Country homepage: up to **16 local + 8 international** movies/TV, interleaved two local then one international. No numbered country chart is shown, because placement includes this editorial allocation.
- See All: up to **200 local + 50 international = 250** qualified titles. The default first page matches the homepage; remaining picks favor local content four-to-one while preserving rank within each origin bucket. Missing slots never admit stale or unqualified titles.
- If fewer than 200 local picks qualify, the international cap is `min(50, max(8, floor(localCount / 4)))`. This preserves the eight homepage picks while keeping larger, shorter lists locally focused. If either bucket lacks supply, actual counts are smaller. The UI reports those actual counts.
- Default page one contains the same up-to-24 cards as home. Later pages contain up to 24 remaining items. Sparse first pages do not cause skipped or duplicated titles. Full 250-title lists have 11 pages.
- All / Movies / TV, From Country, current-year, and current/newest filters act on eligible candidates before allocation. Newest preserves the capped membership and sorts it chronologically across every page. Its first page can differ from the default home preview. Latest releases has its own 60-day window and chronological See All.
- Both media types share the score scale and use `mediaType:id` identity. Within an origin bucket, after three cards of one type an alternate type can move up if within 10 score points and in the same freshness group.

## Endpoints and origin verification

Global rows still use `/trending/movie/week` and `/trending/tv/week` in TMDB's returned order. Country ranking also uses `/trending/movie/day` and `/trending/tv/day`.

Per type, four paginated `/discover/movie` or `/discover/tv` pools supply candidates:

| Pool | Window / activity | Maximum pages |
|---|---|---:|
| Selected-country origin | Released/premiered within 180 days | 10 |
| All origins | Released/premiered within 180 days | 4 |
| Selected-country activity | Movies released within 60 days, newest first; TV aired within 28 days | 2 |
| All-origin activity | Same activity windows | 1 |

All Discover queries require `watch_region` plus `with_watch_monetization_types=flatrate|free|ads|rent|buy`, nonfuture premiere/release, at least 5 votes and rating 6. Local queries use `with_origin_country`. Pagination stops at the source's end; this is bounded current discovery, not arbitrary catalog pagination.

Selected country comes from the existing CountryProvider/cookie/profile architecture. A matching origin-filtered result proves local relevance. Actual origin/production metadata also establishes origin; a co-production may be local in multiple countries. Language and title names never determine nationality.

TMDB movie Discover results may omit origin metadata. An all-origin movie can be classified as nonlocal by absence from the identical local recent query ONLY after that query is fully exhausted successfully. The movie activity window is a subset of that query. Truncated or failed local coverage never proves nonlocality. Unknown-origin items are omitted unless verified.

Up to four otherwise-uncovered daily/weekly candidates or unknown-origin candidates per type use `/{type}/{id}?append_to_response=watch/providers`. This supplies real origin and regional offers in one request. A title without reported regional offers is excluded. Existing Where to Watch/provider-link helpers are unchanged.

Maximum cold budget: 34 Discover page requests + 4 global feeds + 8 bounded detail/offer probes = **46**, excluding retries. Home additionally loads two genre endpoints. Actual requests stop early for small pools. The five-country audit used 119 unique requests in total, including filtered views, all pagination and provider samples. Pagination/filter navigation reused cached URLs without fetching a new catalog. Existing server-only fetch caching/revalidation remains 30 minutes (genres 24 hours); the key stays server-side.

## Current eligibility and exact score

Require a valid ID and nonfuture date, classified origin, and real regional availability. Reject ratings below 5.5 when there are at least 10 votes. At least one of these signals is required:

1. Membership in the actual global daily or weekly trend feed.
2. Release within 90 days with at least 20 votes, rating 6 and popularity 20.
3. Emerging release within 45 days with at least 5 votes, rating 6 and popularity 20.
4. Recent TV episode evidence within 28 days with at least 100 votes, rating 6.5 and popularity 30.
5. For the requested combined trending/latest surface: release within 180 days, at least 5 votes, rating 6 and popularity 3. These supported releases carry a **Recent release** badge, never a fabricated trending badge. This criterion is symmetric for both origins.
6. A future verified country-matched iFynex activity signal >= 0.5, with at least 20 votes and rating 6. Production does not supply this signal.

Titles before July 1 of the previous year additionally need 20 votes and rating 6. High popularity, accumulated votes or local origin alone never qualify an old catalog title.

```text
S = 50 * max(D, 0.85 * W) + 10 * B
  + 18 * R + 6 * E + 12 * P + 4 * Q + 8 * L + 20 * I

D,W = 0 when absent; otherwise 0.25 + 0.75 * (N - index) / N
      in that media type's daily/weekly feed, index starting at zero.
B = 1 when present in both feeds, otherwise 0.
P = clamp(ln(1 + max(0,popularity)) / ln(101), 0, 1).
Q = clamp(rating / 10, 0, 1) * votes / (votes + 50).
R = max(2^(-ageDays / 90), 0.8 for qualifying recent TV airing else 0).
E = 1 for qualifying recent TV airing;
    otherwise 2^(-ageDays / 30) within 90 days, else 0.
L = 1 for selected-country origin, otherwise 0.
I = validated recent country activity, currently zero.
```

Scoring orders titles within their local/international buckets; allocation sets the requested composition. Local score bonus cannot admit a weak title. Feed agreement is evidence, not a measured growth rate.

Qualified older returning series can compete on score, capped at 20% of each bucket's leading selection (four current releases precede the first). Other older genuine revivals are appended after current picks, capped by `min(floor(selectedCount/9), floor(bucketLimit/10), remainingSpace)`. No old slots are reserved. Newest sorting changes display order, not eligibility or membership.

Dates roll with server UTC, not a hardcoded 2026. On September 24, 2026, 180-day retrieval starts March 28; latest releases start July 26; episode activity starts August 27. A late-2025 release still qualifies with current daily/weekly or appropriate episode evidence. Latest releases remain a separate 60-day surface requiring 5 votes, rating 6 and popularity 10. Movie releases/series premieres are not provider-addition or new-season timestamps.

## Why the previous results were wrong

The original movie activity query used `sort_by=popularity.desc` with an upper date but no lower date, letting old popular catalog movies enter the candidate pool. Later revisions fixed that unbounded query. The previous soft 8-point origin preference then allowed international trend-feed picks to dominate the homepage: the prior live audit had only five local India cards. The requested hard allocation now happens after eligibility, rather than trying to solve composition by inflating a nationality score.

## Remaining limitation and future iFynex activity

TMDB does not expose JustWatch-style country-level user viewing charts. This selection estimates current relevance using global feeds, recent releases/episodes, origin, popularity/votes and reported country offers. It cannot truthfully claim actual Indian/US/etc. viewing ranks, guarantee 200 current local titles in every country, or infer unreported streaming availability.

The pure ranker retains a typed CountryActivitySignal adapter: region, asOf and normalized recentScore. It rejects other-country, future and older-than-seven-day activity. A later server adapter can aggregate real searches, detail views, wishlists and provider clicks. No fake activity or process-memory momentum has been added. Auth, Google sign-in, country preference storage, wishlist and detail/provider flows were not changed.

References: [Movie Discover](https://developer.themoviedb.org/reference/discover-movie), [TV Discover](https://developer.themoviedb.org/reference/discover-tv), [Global trends](https://developer.themoviedb.org/reference/trending-movies), [Append to response](https://developer.themoviedb.org/docs/append-to-response).

## Verification

Live TMDB audit on September 24, 2026; these counts will change with live data:

| Country | Home local / international | Home 2026 releases | Home movies / TV | See All local / international | Total |
|---|---:|---:|---:|---:|---:|
| India | 16 / 8 | 23 | 13 / 11 | 36 / 9 | 45 |
| United States | 16 / 8 | 20 | 11 / 13 | 200 / 50 | 250 |
| United Kingdom | 16 / 8 | 20 | 9 / 15 | 55 / 13 | 68 |
| Japan | 16 / 8 | 20 | 5 / 19 | 104 / 26 | 130 |
| South Korea | 16 / 8 | 21 (+1 late-2025) | 5 / 19 | 36 / 9 | 45 |

All five country fingerprints differ. Real provider samples, both media types, current eligibility, origin filters, year/newest filters, default home/See All equality, chronological latest pages, no duplicate/omitted pagination items, and no additional API queries during pagination pass. Sanitized evidence is in `country-discovery-live-audit.json`.

- Regression tests: **41 pass**, including full 250-capacity fixtures, every requested country mix, sparse supply, correct movie origin on truncated/failed sources, and unchanged global order.
- `npm run lint`: **passes**, 0 errors; one pre-existing `next/no-img-element` warning in `components/wishlist-page.tsx`.
- `npm run build`: **passes** with all existing routes.
- Browser verification: country switching changed visible See All counts for all five countries; India home displayed 16/8 and 24 cards; refreshed default home/See All membership matched; India page two contained the remaining 21 cards; Movies/TV and Newest controls worked; USA showed 250 results across 11 pages. Desktop layout inspected and no browser warning/error logs were recorded. Google sign-in and wishlist mutations were not exercised. The temporary preview was stopped.
