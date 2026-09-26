# Release, provider and global trending fixes

Verified on 26 September 2026. Existing Next.js routing, country context, India curated configuration, other-country ranking, title cards and detail navigation are preserved.

## 1. Files changed

| File | Change |
| --- | --- |
| `app/page.tsx` | Global See All link; five movie and five TV cards, retaining existing section anchors. |
| `app/trending/global/page.tsx` | New server route with media filter and page query parameters. |
| `components/global-trending-page.tsx` | All/Movies/TV controls, previous/next navigation, loading/error handling and existing title cards. |
| `components/country-trending-page.tsx` | Explain the stricter regional movie-date requirement. |
| `components/movie-card.tsx` | Explicit Coming Soon/In Theatres labels and separate streaming availability information. |
| `components/watch-providers.tsx` | Honest missing-link and missing-streaming copy. |
| `data/discovery-config.ts` | Configurable global homepage limit; existing recent/upcoming windows retained. |
| `lib/media.ts` | Separate release availability metadata. |
| `lib/release-metadata.ts` | Require regional movie events; validate dates/offers and reject contradictory TV episode dates. |
| `lib/releases.ts` | Regional events take precedence; availability does not determine release status. |
| `lib/tmdb-releases.ts` | Remove the movie provider/premiere fallback source. |
| `lib/tmdb.ts` | Paginated weekly global trending using the shared cached TMDB request helper. |
| `lib/watch-providers.ts` | Preserve valid supplied offer link/url destinations, including a later duplicate's destination. |
| `tests/global-trending.test.mjs` | Ordering, qualification, filters, endpoint selection, pagination and failure tests. |
| `tests/releases-india.test.mjs` | Regional-date, provider-independent release and contradictory-date regressions. |
| `tests/watch-providers.test.mjs` | Netflix/Prime/Apple supplied-link and missing-link fixtures. |
| `tests/live-release-trending.mjs` | Opt-in real TMDB release, upcoming, provider and global-order audit. |
| `docs/release-trending-live-audit.json` | Sanitized live verification results and sampled titles. |
| `docs/fix-verification.md` | This report. |

## 2. Latest Releases

Movies now require a valid theatrical/digital date for the selected country. Provider listings plus a worldwide premiere are insufficient evidence of a local release. Missing or unverified regional dates are excluded. Recent theatre/digital records qualify independently of OTT offers; missing provider data never creates a provider.

TV uses valid first-air/last-episode/next-episode dates with local origin or actual regional offers. An episode cannot precede a known series premiere. Country-specific TV streaming launch dates remain unavailable from this data source and the UI says so.

The rolling UTC windows remain configurable in `data/discovery-config.ts`: 14 days back, 7 days ahead. Future events display **Coming Soon**, recent theatrical events display **In Theatres**, and missing streaming coverage is labelled separately.

## 3. Where to Watch

Only a valid HTTPS destination supplied on a provider offer enables Watch/Rent/Buy. The original destination is preserved. Existing anchors open a new tab with `target="_blank"` and `rel="noopener noreferrer"`. TMDB/JustWatch reference URLs, unsafe URLs and missing destinations never become provider CTAs. There is no verified provider homepage mapping in this project; none was invented.

Live samples checked in the API and browser:

| Provider | Sample | Result |
| --- | --- | --- |
| Netflix | Fight Club, India (`movie/550`) | Actual availability; no provider destination returned. Non-clickable missing-link state verified. |
| Amazon Prime Video | The Boys, India (`tv/76479`) | Actual availability; no provider destination returned. Non-clickable missing-link state verified. |
| Apple TV Store | Fight Club, United States (`movie/550`) | Actual rent/buy offers; no provider destination returned. Non-clickable missing-link state verified. |

**Real external provider click-through testing could not be completed:** these live TMDB responses have no provider URLs. Supplied-link fixtures verify exact Netflix/Prime/Apple destination preservation, generic links, duplicate offers and labels; these fixtures are not live TMDB evidence and do not enter production data.

TMDB documents that this endpoint does not return full provider deep links: https://developer.themoviedb.org/reference/movie-watch-providers

## 4. Global Trending

`/trending/global` uses `/trending/all/week`, `/trending/movie/week` and `/trending/tv/week`. All retains the combined TMDB order; Movies/TV use their respective weekly feeds. Invalid entries, people, adult entries and duplicate identities are excluded without popularity sorting. Pagination reaches TMDB's available page limit, capped at 500. Changing the media filter resets to page one.

Homepage displays 10 cards total (5 movies + 5 TV), with the original navigation anchors. See All opens the new route. Country selection does not change the global feed.

## 5. Tests performed

- Full automated regression suite: **66 passed, 0 failed**, covering India curation, other-country behavior, dates, providers and global trending. Targeted suite after final homepage adjustment: 27 passed.
- Live India/US/UK regional dates and future-event classification checked against actual detail responses. Latest audit returned 29/34/38 qualified releases and 13/17/19 upcoming results respectively. These counts describe the bounded discovery pools at audit time, not the entire TMDB catalogue.
- Some metadata probes were unavailable/rejected: the live audit records `partial: true`. Assertions verify returned titles; they do not assert complete upstream coverage. Only successfully verified titles are retained.
- Global All/Movies/TV pages 1 and 2 matched their actual TMDB response order.
- Browser production checks: 10 homepage global cards; See All keyboard activation; Movies/TV filters; page-two navigation; filter resets; India upcoming labels; India → US → UK country changes; Netflix/Prime/Apple missing destinations; title card opens the correct details route.
- India manual/curated trending remained visible. Its configuration and other-country ranking code were not edited.
- Browser country preference restored to India. No user account or wishlist changes.
- `git diff --check`: passed.

## 6. Lint

`npm run lint`: **exit 0; zero errors**. One existing `@next/next/no-img-element` warning remains in `components/wishlist-page.tsx:16`. That unrelated file was not changed.

## 7. Production build

`npm run build`: **passed**, including TypeScript and route generation for `/trending/global`. A repeat build initially hit a OneDrive-generated `.next` reparse-point cleanup error. Only generated `.next` output was removed; the final clean build succeeded.

## 8. Remaining TMDB/environment limitations

- Provider APIs generally supply availability metadata and a regional TMDB reference page, not provider destinations. Missing URLs cannot support the requested real-provider click-through without an approved verified mapping or another legitimate destination source.
- Regional movie records may be missing/stale. Strict filtering intentionally omits movies whose local date cannot be verified.
- TV dates do not guarantee the exact selected-country streaming date. Availability can be delayed or missing, including for genuinely released content.
- TMDB global results and dates can change between requests. Global pagination follows the live API's order.
- Normal system DNS timed out for TMDB on this machine. Live verification used a **test-process-only Cloudflare resolver**, retaining the original HTTPS hostname and certificate validation. No application DNS behavior, system network settings or dependencies were changed.

Run the automated suite with `node --test tests/*.test.mjs`. The opt-in live audit is `node --env-file=.env.local tests/live-release-trending.mjs`; it needs network access to TMDB and writes no API credentials to its report.
