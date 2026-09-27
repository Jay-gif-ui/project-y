# Availability and discovery verification — 27 September 2026

The existing Next.js application, routes, country context, India curation, automatic non-India discovery, and iFynex styling are preserved. No deployment was performed. This report supersedes the five-per-type and no-homepage-fallback descriptions in `fix-verification.md`.

## Files changed

| File | Change |
| --- | --- |
| `lib/theatrical.ts` | Selected-country theatrical release calculation. |
| `lib/provider-links.ts` | Central verified official homepage mapping; exact TMDB provider names. |
| `lib/tmdb.ts` | Separate theatrical/provider requests with independent failures; deduplicated homepage trending retrieval. |
| `lib/watch-providers.ts` | Supplied provider URL first, verified homepage fallback; Streaming label. |
| `lib/release-metadata.ts` | Normalize country casing for regional movie events. |
| `lib/releases.ts` | Enforce regional theatrical/digital events for movie freshness even at the selector boundary. |
| `data/discovery-config.ts` | Six homepage results per media type; bounded extra trending pages. |
| `components/watch-providers.tsx` | Separate theatres/streaming/rent/buy, precise missing-data messages, real external anchors, country refresh and independent errors. |
| `app/[type]/[id]/page.tsx` | Initial regional availability; label generic date as Original release date / First air date. |
| `app/api/title/[type]/[id]/providers/route.ts` | Return regional theatre and provider data; retain partial success. |
| `app/page.tsx` | Six unique movies and six unique shows; existing See All retained. |
| `tests/theatrical.test.mjs` | Past/today/future, country isolation, invalid types/dates, rereleases and independent outages. |
| `tests/watch-providers.test.mjs` | Verified fallback, supplied URL precedence, unknown provider and unsafe URL checks. |
| `tests/releases-india.test.mjs` | Explicit 1992/2005/2010/2015 regressions, including qualifying regional rereleases. |
| `tests/global-trending.test.mjs` | Six unique results, next-page fill and honest insufficient supply. |
| `tests/live-release-trending.mjs` | Update live destination assertions; actual Resident Evil country records and homepage count audit. |
| `docs/availability-live-audit.json` | Final real-TMDB audit output, without credentials. |
| `docs/availability-verification.md` | This report and official URL verification sources. |

## Theatrical detection

Only `/movie/{id}/release_dates` records for the selected ISO country and release types 2 (limited theatrical) / 3 (theatrical) qualify. Digital, physical, TV, premiere, global `release_date`, provider listings and status strings cannot create theatrical status. Dates are validated and compared as calendar dates with the existing rolling UTC current-date convention.

Use the latest theatrical date on/before today; if there is none, use the earliest future theatrical date. Past records show **Released in Theatres in [country]** and the actual date. Future records show **Coming to Theatres in [country]** and the actual date. A future rerelease does not erase an earlier completed release. Missing regional data stays explicitly missing. Provider failure cannot hide a successfully loaded theatre date, or vice versa.

Live Resident Evil (`movie/1423191`) check: **India 2026-09-17**, **USA 2026-09-18**, **UK 2026-09-18**; no India OTT offers. The screenshot's 2026-09-16 is its generic original date, not its India theatrical date. Browser switching confirmed the regional dates. Baththa (`movie/1515692`) correctly showed Coming to Theatres in India on **2026-10-01**.

## Provider links

Availability and displayed names/IDs come exclusively from the selected country's TMDB watch-provider response. Use a safe HTTPS URL supplied on the individual offer first. Reject credentials, non-HTTPS and TMDB/JustWatch destinations as provider CTAs. Otherwise use an exact, normalized provider-name lookup in the verified official-homepage configuration. No title-specific URL is fabricated. Unknown providers remain visible without a clickable action. The optional TMDB reference stays a separate disclosure.

Every actionable card is an anchor with `target="_blank"` and `rel="noopener noreferrer"`. Subscription/free/ads/rent/buy distinctions and existing local click-event integration are preserved. Homepages can choose their regional landing page; they do not add offers to any country.

Official sources checked on 2026-09-27:

| Service / TMDB variants | Verified destination and evidence |
| --- | --- |
| Netflix / Netflix Standard with Ads | [Netflix homepage](https://www.netflix.com/) |
| Amazon Prime Video / with Ads / Amazon Video | [Prime Video homepage](https://www.primevideo.com/) |
| Apple TV / Apple TV+ / Apple TV Store | [Apple TV homepage](https://tv.apple.com/) |
| JioHotstar | [Official service](https://www.hotstar.com/), confirmed by [JioHotstar About Us](https://ads.hotstar.com/about-us/) |
| ZEE5 | [ZEE5 homepage](https://www.zee5.com/) |
| Sony LIV | [Sony LIV homepage](https://www.sonyliv.com/) |
| Disney Plus | [Disney+ homepage](https://www.disneyplus.com/) |
| YouTube | [Movies and Shows](https://www.youtube.com/feed/storefront) |
| Google Play Movies | [Google Play Movies](https://play.google.com/store/movies?hl=en) |
| Fandango At Home | [Official store](https://athome.fandango.com/content/movies/) |
| HBO Max | [Homepage](https://www.hbomax.com/), confirmed by [HBO Max Help](https://help.hbomax.com/us) |
| HBO Max Amazon Channel | [Prime Video](https://www.primevideo.com/); Amazon subscription option confirmed by [HBO Max signup help](https://help.hbomax.com/us/Answer/Detail/000002544) |
| Rakuten TV | [Homepage](https://www.rakuten.tv/), confirmed by [official getting-started help](https://support.rakuten.tv/hc/en-us/articles/360010788614-First-Steps-at-Rakuten-TV) |
| Sky Store | [Homepage](https://www.skystore.com/), confirmed by [Sky Help](https://www.sky.com/help/articles/sky-store-voucher-help) |

## Latest Releases and Trending

The existing independent date-driven release pipeline remains in place: `recentDays: 14`, `upcomingDays: 7`, in `data/discovery-config.ts`. Movies require actual selected-country theatrical/digital dates. TV uses first-air or last/next episode dates, qualified by local origin or real regional offers. Ranking/popularity/curation cannot admit an old movie without a qualifying recent/upcoming regional event. Genuine old-film rereleases and current episodes of older series are allowed and labelled with their event dates. No year is hardcoded in production filtering.

Global Trending reads the existing weekly TMDB movie/TV endpoints, keeps upstream order, filters invalid/adult/duplicate records, and targets six unique cards per type. Up to three pages can fill a short first page; insufficient real supply is never padded with duplicates. See All retains the existing paginated All/Movies/TV view. India curation and other countries' automatic architecture remain unchanged.

## Verification results

- `node --test tests/*.test.mjs`: **74 passed, 0 failed** on final source.
- Live audit: **passed** for India, USA and UK, including release windows, original TMDB event provenance, upcoming status, global order/pagination, provider metadata/destinations and Resident Evil. See the JSON audit for counts and exact samples.
- Browser: Resident Evil IN → US → GB → IN dates; India future movie Baththa; Fight Club India Netflix plus Google Play/YouTube purchase anchors; Fight Club UK Prime Video; six movie and six TV homepage cards; See All opens the Global Trending page with 20 results and pagination.
- Provider anchors were activated and their exact `href`, `_blank`, `noopener noreferrer` checked. The in-app browser does not expose the external tab's final loaded page, so external-tab landing/load is **not claimed as observed**. Official destinations were independently verified above.
- Old-movie regressions: 1992, 2005, 2010 and 2015 movies with extreme popularity/vote counts and India offers are rejected without a fresh regional event; valid current India rereleases qualify. Current TV episodes are explicitly distinguished from the old series premiere.
- `npm run lint`: **exit 0**, zero errors; one existing `@next/next/no-img-element` warning at `components/wishlist-page.tsx:16`, outside this change.
- `npm run build`: **exit 0**, TypeScript and all 16 static-generation steps passed. A repeat build first hit a OneDrive read-only generated `.next/static` directory; removing that verified generated directory resolved it. No source or system configuration was changed for this recovery.
- `git diff --check`: passed.
- No deployment.

## Limits

- [TMDB release records](https://developer.themoviedb.org/reference/movie-release-dates) confirm reported releases, not current cinema showtimes or continued exhibition. The UI deliberately says Released in Theatres and carries this qualification.
- [TMDB watch providers](https://developer.themoviedb.org/reference/movie-watch-providers) report country-specific streaming/rental/purchase offers and usually do not return provider deep links. An empty result is not proof the title is unreleased or unavailable everywhere.
- TMDB has no country-specific episode schedule in the fields used here; local streaming dates may differ. A recent digital release record alone never creates a provider offer.
- Existing request cache lifetime is 30 minutes; newly added offers appear through normal revalidation. Missing/incorrect upstream records and bounded discovery coverage remain TMDB limitations.
- The machine's previously documented system-DNS timeout for TMDB required a **test-process-only Cloudflare resolver** during live/local testing. Original HTTPS hostname and certificate validation stayed enabled; application DNS behavior and OS settings were not changed. Normal local runs still need functioning TMDB connectivity.
