# Country discovery

## Homepage order

The existing hero stays in place. Content sections are: (1) Latest Releases in the selected country, (2) Trending in that country, (3) Global Trending 🌎 (separate movie and TV rows), (4) the existing genre explorer. India uses the same visual components and country preference architecture.

## Release discovery

`data/discovery-config.ts` owns the rolling UTC calendar windows: the last 14 days through today, and tomorrow through the next 7 days. Bounds are inclusive. No permanently dated release list is shipped.

`lib/releases.ts` builds date-filtered queries and orders verified release events. `lib/tmdb-releases.ts` retrieves candidates through the existing cached TMDB adapter. `lib/release-metadata.ts` extracts the actual evidence:

- Movies: selected-country release dates, types 2/3 (theatrical) and 4 (digital). Regional schedules take precedence over a global premiere. A recent primary premiere with actual regional watch offers is a fallback only when no regional theatrical/digital records exist.
- TV: first air date, last episode and next episode. Shows require either selected-country origin or real watch offers in that country. TMDB does not provide a dependable country-specific TV launch calendar; episode dates are reported air dates, not promises of local streaming availability.
- Rating, vote count and popularity are not release eligibility gates. Discover queries are date constrained; bounded digital/episode/upcoming samples use popularity to find relevant candidates, then real event dates alone determine release status and chronology.
- Released events sort newest first, then upcoming events soonest first, with regional dates winning date ties. A show with both recent and future episodes appears once in All and can appear with its future episode in Upcoming.
- Future dates are labeled `Coming Sep 25` etc. No country release heading shares another country's unfiltered catalog. Dates missing from TMDB are not guessed.

`/country/releases` supports Movies/TV, Recently Released/Upcoming, origin, year and 24-item pagination. It never calls the trending ranking algorithm. The homepage displays page one, so a full recent-release page may defer upcoming events to See All → Upcoming.

## India trending

Edit **only `data/india-trending.ts`** to refresh the India Top 10, approximately every 48 hours:

1. Verify the exact TMDB title, year and media type.
2. Replace/reorder the ten `{ id, type, label }` entries. Array order is the editorial rank. `label` is an editor note; displayed titles/posters/ratings come from TMDB.
3. Update `updatedAt`. This records the editorial review date; it is not a release date or a measured trending timestamp.
4. Run lint/build and publish through your normal code release process. Editing this source configuration requires a rebuild/redeploy on a hosted instance; no UI or algorithm change is needed.

The initial list follows the user's first ten candidates. Bigg Boss is the Hindi series (2006); Chumbak is the 2026 Indian series; Welcome To The Jungle is the 2026 film. See `india-candidate-audit.md` for all supplied candidates and ambiguous/unresolved names.

`lib/india-trending.ts` preserves editorial priority, merges qualified current global feeds and deduplicates by `(mediaType, TMDB ID)` (movie and TV IDs have separate namespaces). The server adapter verifies local offers, local origin for editorial picks, or a real regional theatrical/digital release. Future/invalid titles are skipped, including an overseas premiere with a wholly upcoming India schedule. An old editorially selected title may trend without being a latest release.

Daily and weekly feeds are interleaved before the bounded verification budget so neither source crowds out the other. India uses no generic popular catalog filler. See All uses the same membership/order as home, with media/origin/year filters, current/newest sorting and existing pagination. Newest deliberately reorders the qualified selection; it never expands it.

## Global and other countries

The global rows still call `/trending/movie/week` and `/trending/tv/week`, preserving returned order. The India list never replaces these feeds. The global section can contain TMDB's own anticipated titles; those are not inserted into country Trending merely because they are upcoming.

USA, UK, Japan, South Korea and all other enabled countries keep automatic `country-trending.ts` discovery: actual daily/weekly trends, evidenced recent audience interest, and qualifying active series, with regional watch offers. The former release-only six-month admission has been removed: a recent date alone is no longer trending evidence. Existing local/international allocation, sorting and pagination remain. No manual India configuration is used for these countries.

The country selector, cookie/local-storage preference, genre explorer and title details retain their existing architecture. Where to Watch received one loading-state correction: when refreshed server props catch up to a country change, the pending client loader is cleared. Subscription, rent, buy, free/ad-supported groups and TMDB-provided destination links remain country specific.

## Performance and limits

TMDB fetches retain server `force-cache` with 30-minute revalidation. The metadata URL is shared across release/India discovery; concurrent detail requests are also deduplicated in flight. Title IDs never require a runtime search.

Release work is bounded to one page per source (four movie sources, four TV sources) and at most 20 detail checks per type. India trending checks at most ten manual IDs plus ten current feed candidates per type. Those budgets are configurable. Warm filters/pagination reuse cached source responses. A cold request has more work, and these are intentionally bounded discovery selections, not exhaustive release catalogs. The audit reports the actual request totals.

TMDB data can be incomplete or inaccurate, and offers do not reveal the date a streaming service added a title. Empty results stay empty; upstream outages are surfaced with partial/error states rather than fabricated fallback content. Cross-section repeats are retained when a title separately qualifies as fresh and trending.

## Validation

- `node --test tests/discovery.test.mjs tests/country-trending.test.mjs tests/releases-india.test.mjs`
- `node --env-file=.env.local tests/live-country-discovery.mjs` (live credential required; writes `docs/country-discovery-live-audit.json`, never credentials).
- `npm run lint` and `npm run build`.
- Actual local browser: homepage order, all five country changes, release/media filters, trending See All and pagination, and Where to Watch country changes.

This machine's system DNS resolves TMDB's main hostname to an unreachable address. Local verification uses a process-only Cloudflare DNS resolver with the original HTTPS hostname and certificate checks intact, as in the previous audit. Production code and OS DNS settings were not changed. Default local commands still require working access to TMDB.

TMDB reference: https://developer.themoviedb.org/reference/discover-movie and https://developer.themoviedb.org/docs/region-support.
