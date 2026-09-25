# India discovery completion report

Implemented and verified on 2026-09-25 in the existing project. No deployment, project recreation or visual redesign.

## 1. Exact files changed

- [app/page.tsx](../app/page.tsx)
- [app/country/releases/page.tsx](../app/country/releases/page.tsx)
- [components/country-discovery.tsx](../components/country-discovery.tsx)
- [components/country-trending-page.tsx](../components/country-trending-page.tsx)
- [components/movie-card.tsx](../components/movie-card.tsx)
- [components/watch-providers.tsx](../components/watch-providers.tsx)
- [data/discovery-config.ts](../data/discovery-config.ts)
- [data/india-trending.ts](../data/india-trending.ts)
- [lib/country-trending.ts](../lib/country-trending.ts)
- [lib/india-trending.ts](../lib/india-trending.ts)
- [lib/media.ts](../lib/media.ts)
- [lib/release-metadata.ts](../lib/release-metadata.ts)
- [lib/releases.ts](../lib/releases.ts)
- [lib/tmdb-releases.ts](../lib/tmdb-releases.ts)
- [lib/tmdb.ts](../lib/tmdb.ts)
- [tests/country-trending.test.mjs](../tests/country-trending.test.mjs)
- [tests/discovery.test.mjs](../tests/discovery.test.mjs)
- [tests/live-country-discovery.mjs](../tests/live-country-discovery.mjs)
- [tests/releases-india.test.mjs](../tests/releases-india.test.mjs)
- [docs/discovery.md](../docs/discovery.md)
- [docs/india-candidate-audit.md](../docs/india-candidate-audit.md)
- [docs/country-discovery-live-audit.json](../docs/country-discovery-live-audit.json)
- [docs/discovery-runtime-audit.json](../docs/discovery-runtime-audit.json)
- [docs/india-discovery-completion.md](../docs/india-discovery-completion.md)

## 2. Exact India homepage content order

The existing hero remains, followed by:

1. Latest Releases in India 🇮🇳
2. Trending in India 🇮🇳
3. Global Trending 🌎 (TMDB movie and TV rows)
4. Explore by genre / existing sections

## 3–4. Latest and upcoming calculations

UTC rolling dates: last 14 days through today, then the next 7 days. Movie evidence is actual selected-country theatrical/digital dates, with primary-premiere plus real regional offers only as a fallback when regional dates are absent. TV evidence is premiere, last episode or next episode, qualified by local origin or regional watch offers. No popularity/rating floor decides release eligibility. Date-filtered candidate sampling is bounded; final ordering is newest released, then upcoming soon, with regional date evidence winning ties. Future events always carry Coming labels. Recently Released and Upcoming are separate filters.

## 5–6. India Top 10 and TMDB merge

`data/india-trending.ts` contains verified IDs, media types and editable editorial order. Initial order follows the first ten supplied candidates: Vishwanath & Sons; Irumudi; Modha Rathri; Jana Nayagan; Lust Stories 3; 365 Days; Bigg Boss (Hindi); Zakir Khan: Papa Yaar; Chumbak (2026); Welcome To The Jungle (2026). UI metadata comes from TMDB, never those editor labels.

Editorial picks lead; qualified daily and weekly TMDB feeds follow. Both feeds get candidates within the bounded verification budget. Local offers or recent regional release evidence qualify global entries; future releases are excluded. Deduplication uses media type plus TMDB ID. Global homepage rows retain original weekly ordering independently.

## 7. Other countries

USA, UK, Japan, South Korea and all other enabled countries keep automatic TMDB discovery and their existing local/international selection. India curation is entered only for IN. The old release-only admission into Trending was removed. Country-specific release queries, selector, preference persistence, genres and provider behavior are retained.

## 8. Refresh India Top 10 every approximately 48 hours

Edit/reorder `titles` and update `updatedAt` in `data/india-trending.ts`. Use verified IDs and `movie`/`tv`; no UI/ranking edits or runtime searches are needed. A hosted site needs the normal rebuild/redeploy after changing this source file. No automatic scheduler was added. See `docs/discovery.md` for the maintenance guide.

## 9–11. Validation results

- Lint: passed, zero errors. One pre-existing `@next/next/no-img-element` warning in `components/wishlist-page.tsx:16`; unrelated file unchanged.
- Production build: passed; Next.js 16.3.1 compile, TypeScript and all generated routes succeeded. Final build includes the provider loading-state fix.
- Regression suite: 50/50 passed. The 11 new release/India cases passed again after test cleanup.
- Live TMDB audit: passed for IN, US, GB, JP and KR; manual rank, no manual leakage, current-only trending, dates, media/status/origin filters, pagination, cached requests, and exact provider-group/link comparison.
- Actual development browser: correct section/Top 10 order, all five country selections changed actual cards, See All/pagination, media/status filters, newest sort, Coming labels, and provider country changes verified.
- Production runtime: all five homepages, both See All routes, title page and provider endpoints returned HTTP 200; order/country content verified. Final warm homepage requests measured 69–352 ms locally (not a deployment performance guarantee).
- Final production browser: provider switching showed distinct US Buy/Free groups and correct India data without stuck loading; zero console errors observed.
- Whitespace diff check: passed.

Live audit selection counts (will change):

| Country | Trending total | Release total | Upcoming events in All |
| --- | ---: | ---: | ---: |
| India | 27 | 40 | 9 |
| USA | 85 | 38 | 12 |
| UK | 14 | 38 | 11 |
| Japan | 13 | 39 | 11 |
| South Korea | 13 | 39 | 13 |

The Upcoming filter can show more titles than the All list’s upcoming count: a returning series can have both a recently aired and next episode, and All keeps one card per title. Raw evidence is in `country-discovery-live-audit.json` and `discovery-runtime-audit.json`.

## 12. Limitations and unmatched research

- Prahaar: The Untold Story of Ujjwal Nikam: no confident exact TMDB match; skipped, no invented ID/date.
- Raw, The Gentlemen, Monster Island and The Mummy: multiple plausible movies/series; not manually pinned from ambiguous names. Automatic discovery may independently show a verified title with one of those names. All candidate search matches are documented in `india-candidate-audit.md`.
- Drishyam: The Conclusion and Valmiki Ramayana: India theatrical Oct 2 verified. Drishyam was observed in the Upcoming UI. Valmiki is a verified match but not guaranteed a slot in the bounded feed. Bokshi Oct 9, Raftaar Oct 16 and Nayyi Navelli Oct 16 were also verified, but are outside the current seven-day window.
- TMDB television dates are not a verified country/platform-specific launch calendar. Provider offers do not establish when a streaming catalog added a title.
- Discovery is bounded and cached (30 minutes), not exhaustive. At most 20 release details per type, ten manual IDs and ten global candidates per type; some genuine releases will fall outside those caps. Missing titles/metadata are not replaced with fake data.
- Legitimately qualifying titles may repeat between Latest, India Trending and Global Trending; each individual selection is deduplicated.
- This machine has a pre-existing TMDB DNS issue. Live/local tests used a process-only Cloudflare resolver with original HTTPS hostname/certificate validation. Production code and OS DNS were not changed; normal local runs need working TMDB connectivity.
