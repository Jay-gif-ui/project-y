# Current, local-first country discovery

Implemented against the existing Next.js/TMDB/country architecture on 23 September 2026. Authentication, Google login, wishlist, profile writes and provider links are unchanged.

## Inspection findings

The earlier unbounded popularity queries caused the original old-catalog dominance. The immediately preceding implementation already had date windows and current-evidence exceptions; it did not simply sort the entire catalog. Its remaining weaknesses were: locality only received every third slot, vote count/rating did not affect ranking, and that local-slot override could move an eligible older title ahead of a recent title. The previous live audit had already confirmed recent releases dominated; this change primarily strengthens locality and quality while tightening the treatment of older exceptions.

Global trending is a separate product surface: `/trending/movie/week` and `/trending/tv/week`, original order, separate rows. Older series in those real current feeds remain legitimate and are not re-ranked by country.

## Country queries and source of truth

The existing `ifynex_country` cookie, `CountryProvider`, `CountrySelector`, localStorage and `lib/countries.ts` remain the only browsing-country architecture. The same code applies to every enabled country. No country-specific branches or language shortcuts are added. The profile country is not written when browsing country changes.

Both homepage and `/country/trending` read the selected country from that cookie. A country-neutral route deliberately keeps the existing browsing selection as the sole source of truth instead of introducing a competing URL country. Changing the navbar country refreshes either surface; pending results are hidden until their server region matches. The page's filters use `/country/trending?type=movie` or `?type=tv`; absent/invalid type selects All.

Per requested media type, three page-1 Discover requests run concurrently:

1. Local recent: `with_origin_country=<selected region>`, premiere/release from July 1 of the previous year through today.
2. Unrestricted recent: the same dates, no origin or language restriction. This is the international candidate pool; local titles found here still receive local credit when metadata or the local pool proves their origin.
3. Local activity: selected origin country and an upper premiere/release bound of today, without the lower release bound. TV also requires an episode air date within the preceding 90 days. Movies from this pool older than the recent window require membership in the current weekly global feed.

All requests include `watch_region`, `with_watch_monetization_types=flatrate|free|ads|rent|buy`, `sort_by=popularity.desc`, adult exclusion, and type-correct date fields (`primary_release_date` for movies, `first_air_date` for TV). TV excludes null premiere dates. The current country window is 2025-07-01 through 2026-09-23; dates advance automatically in UTC.

See All additionally retrieves page 2 of the **local recent** pool, only if TMDB reports more than one page. It does not expand international pages. Origin evidence comes from the server's real `with_origin_country` response and normalized `origin_country` / `production_countries.iso_3166_1` metadata. IDs are deduplicated by media type plus ID. A co-production may be local to multiple countries.

## Quality and international eligibility

The same eligibility gates apply before origin bonuses:

- A title with at least ten votes and rating below 5.5 is excluded.
- Otherwise it needs established audience support (at least 20 votes and rating at least 6), current weekly trend membership, or emerging interest (released within 60 days and normalized log-popularity at least 0.4).
- Older-than-window exceptions additionally require established audience support and current weekly trend membership or recent TV-airing evidence.
- International candidates additionally need current weekly trend membership, or established quality with normalized log-popularity at least 0.65 and a release within 180 days (or recent airing evidence if available in the candidate pool).
- Future, missing-date and invalid-ID results are excluded.

These are editorial quality/relevance proxies, not a guarantee of artistic quality. A new title may have little voting history; strong current interest can qualify it without inventing a rating. Weak local titles cannot be inserted to fill a quota. If both local endpoints fail for a type, that type does not fall back to a global-only chart. Partial failures are disclosed.

## Exact country score

Normalize popularity within each media type's deduplicated, dated candidate pool:

```text
P = ln(1 + max(0, TMDB popularity)) /
    max(1, largest ln(1 + popularity) in that candidate pool)

score = 40 × 2^(-releaseAgeDays / 120)
      + yearBonus
      + 20 × P
      + 10 × (clampedRating / 10) × voteCount / (voteCount + 50)
      + weeklyTrendBonus
      + airingBonus
      + localBonus

yearBonus = 22 for this year; 10 for the previous July–December; otherwise 0
weeklyTrendBonus = 18 × (feedLength - zeroBasedPosition) / feedLength;
                   zero when absent from the type's weekly feed
airingBonus = 8 for confirmed recent TV-airing-query membership, otherwise 0
localBonus = 44 on homepage; 60 on See All; zero without local-origin evidence
```

The 120-day release half-life favors current premieres; log-popularity bounds the influence of lifetime popularity; vote confidence prevents tiny high-rating samples receiving the same quality bonus as established ratings. A 2026 title receives both stronger year weight and substantially stronger recency than a catalog title.

Recent and older titles are separate ordering groups: **all selected recent titles precede all older exceptions**, including after Movies/TV are combined. Within a group, sort by score, descending release date, then ascending ID. An older exception only replaces a recent candidate if its score is competitive with the weakest selected recent candidate. Older exceptions are limited per type to `min(floor(limit/5), floor(recentEligibleCount/4), olderEligibleCount)`; sparse lists are shortened. There is no random sort and no fixed local/international split. Strong international entries can outrank weaker local candidates; a result can also be entirely local when those are the strongest qualified candidates.

## Homepage versus See All

- Homepage: maximum 12 cards, up to six movies and six TV shows, with local bonus 44. “Trending in [country] [flag]” includes an explicit discovery-method note, not viewing statistics. See All goes to `/country/trending` with automatic prefetch disabled.
- See All: maximum 36 cards. All mode takes up to 18 movies and 18 TV shows; a single-type filter considers up to 36 of that type. Local bonus 60 and the additional local candidate page make this a more strongly local selection strategy, not a global trending page with a region label. Actual local percentages depend on available qualified data and are not forced. Sparse markets may show fewer titles.
- Movies and TV rank separately so popularity scales are not compared across types. The lists alternate within the recent group and the older group. Cards retain their media label and title route. Existing cinematic cards and typography are reused; the See All page uses a wrapping grid.

## Genres and performance

Official Movie/TV genre lists, genre filtering, current/recent windows and the selected watch region remain intact. Genre discovery retains its existing freshness-first score and at-most-25% evidence-backed older exceptions; it does not use country origin as a mandatory filter.

Homepage uses six country Discover requests, two shared global trending requests, and two cached genre lists: **ten cold requests maximum, excluding retries**, unchanged from the preceding implementation. See All uses at most eight Discover requests and two cached trending feeds for All; single-type filters only fetch that type (at most four Discover plus one trending). There are no per-card metadata or provider lookups in production discovery. Global promises are reused on the homepage.

The existing server fetch helper retains 30-minute revalidation and 24-hour genre metadata caching. URLs isolate region, dates, type and pagination. API credentials remain server-only. Provider details continue to use the real TMDB provider endpoint.

## Verification

Final results: `node --test tests/discovery.test.mjs` passed all 20 tests. `npm run lint` passed with zero errors and one pre-existing wishlist image warning. `npm run build` passed, including TypeScript and the new `/country/trending` route. Browser checks passed for See All, All/Movies/TV filtering, India-to-USA switching with the active filter retained, homepage country refresh and country-independent global title order. No browser console errors were observed; the production client bundle check found no TMDB credential. All 13 provider samples in the live audit returned real availability.

The regression suite covers all 23 country mappings, local metadata, quality gates, strong international eligibility, older-title exclusion/evidence/order/caps, dynamic year windows, Movie/TV mixing, browse-only local expansion, sparse regions, failed local endpoints, unchanged global order and genre behavior.

The live audit is reproducible with `node --env-file=.env.local tests/live-country-discovery.mjs`. It fetches real TMDB responses and saves sanitized query parameters, actual IDs/dates/origin evidence, rating/vote/popularity signals and provider samples in `docs/country-discovery-live-audit.json`.

| Country | Homepage local / total | Homepage recent / total | See All local / total | See All recent / total |
| --- | ---: | ---: | ---: | ---: |
| India | 8 / 12 | 12 / 12 | 23 / 28 | 27 / 28 |
| United States | 12 / 12 | 12 / 12 | 36 / 36 | 36 / 36 |
| United Kingdom | 10 / 12 | 12 / 12 | 36 / 36 | 35 / 36 |
| Japan | 12 / 12 | 12 / 12 | 32 / 36 | 33 / 36 |
| South Korea | 11 / 12 | 12 / 12 | 35 / 36 | 36 / 36 |

“Recent” here is July 2025 through today. These are a dated snapshot, not promised percentages. Every tested homepage contained six movies and six TV shows. India See All returned a shorter list because qualifying TV coverage was sparse; it was not padded with low-quality local content. International titles remained present in India's and Korea's homepage and India's/Japan's/Korea's broader selections. Fully local snapshots in some countries are a score outcome, not an origin-only restriction.

## API and environment limitations

TMDB does not provide exact country viewing charts or the underlying daily activity counters. Popularity and weekly trending remain worldwide signals; legal regional availability and origin make this a country-focused **approximation**. Provider metadata can lag; availability does not guarantee entitlement or a playback link. TV recency uses series premiere and query-level airing evidence, not an invented new-season date. Bounded candidate pools do not exhaust the full catalog.

This machine's system DNS has previously timed out for the official TMDB API. Live verification uses a temporary process-only lookup through 1.1.1.1 when needed, with the same HTTPS hostname and full certificate validation. No application endpoint, OS DNS or TLS settings are changed.

Official references: [TMDB Movie Discover](https://developer.themoviedb.org/reference/discover-movie), [TV Discover](https://developer.themoviedb.org/reference/discover-tv), [Popularity and Trending](https://developer.themoviedb.org/docs/popularity-and-trending).

## Files changed in this iteration

- `lib/discovery.ts`: separate country quality/current/local score and eligibility; removed the old local-slot override.
- `lib/tmdb.ts`: normalized origin metadata, shared local-focused pools, expanded browse helper, pagination metadata.
- `lib/media.ts`: optional origin-country metadata.
- `components/country-discovery.tsx`: dynamic heading, transparent wording and See All CTA.
- `app/country/trending/page.tsx`, `components/country-trending-page.tsx`: selected-country server page and All/Movies/TV filters.
- `app/globals.css`: small additions for the existing grid/filter presentation.
- `tests/discovery.test.mjs`, `tests/live-country-discovery.mjs`: regression and real-data verification.
- `docs/discovery.md`, `docs/country-discovery-live-audit.json`: implementation and live evidence.
