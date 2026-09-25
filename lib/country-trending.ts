import type { Media, MediaType } from "./media";

export type CountrySurface = "home" | "browse";
export type CountryMediaFilter = "all" | MediaType;
export type CountrySort = "current" | "newest";
export type CountryPeriod = "current" | "year";
export type CountryView = "trending" | "releases";
export type CountryCandidate = { media: Media; available: boolean; local?: boolean; recentlyAired?: boolean };
// An optional future server adapter, not a fabricated or lifetime activity count.
export type CountryActivitySignal = { region: string; asOf: string; recentScore: number };
export type CountryActivitySource = (region: string, type: MediaType, now: Date) => Promise<ReadonlyMap<string, CountryActivitySignal>>;
export type CountryPick = {
  media: Media; local: boolean; score: number; older: boolean;
  signals: { daily: number; weekly: number; airing: boolean; popularity: number; activity: number; reason: NonNullable<Media["discoverySignal"]> };
};

const DAY = 86_400_000;
export const COUNTRY_HOME_LIMIT = 24;
export const COUNTRY_PAGE_SIZE = 24;
export const COUNTRY_HOME_LOCAL = 16;
export const COUNTRY_HOME_INTERNATIONAL = 8;
export const COUNTRY_BROWSE_LOCAL = 200;
export const COUNTRY_BROWSE_INTERNATIONAL = 50;
export const COUNTRY_BROWSE_LIMIT = COUNTRY_BROWSE_LOCAL + COUNTRY_BROWSE_INTERNATIONAL;
export const COUNTRY_POOL_PAGES = { local: 10, international: 4, activity: 2, "international-activity": 1 } as const;
export const COUNTRY_TREND_PROBE_LIMIT = 4;
export const mediaKey = (media: Media) => `${media.mediaType}:${media.id}`;
export function countryTrendingDates(now = new Date()) {
  const today = now.toISOString().slice(0, 10), year = now.getUTCFullYear();
  const ago = (days: number) => new Date(Date.parse(today) - days * DAY).toISOString().slice(0, 10);
  return { today, year, recentStart: `${year - 1}-07-01`, releaseStart: ago(180), freshStart: ago(60), activityStart: ago(28) };
}

// Bounded candidates with reported regional offers. These queries are NOT charts.
export function countryTrendingParams(type: MediaType, region: string, now: Date, pool: "local" | "international" | "activity" | "international-activity", page = 1): Record<string, string> {
  const dates = countryTrendingDates(now);
  const field = type === "movie" ? "primary_release_date" : "first_air_date";
  const activity = pool === "activity" || pool === "international-activity";
  const airing = activity && type === "tv";
  return {
    language: "en-US", include_adult: "false", page: String(page),
    watch_region: region, with_watch_monetization_types: "flatrate|free|ads|rent|buy",
    sort_by: activity && type === "movie" ? "primary_release_date.desc" : "popularity.desc",
    [`${field}.lte`]: dates.today,
    ...(!airing ? { [`${field}.gte`]: activity ? dates.freshStart : dates.releaseStart } : {}),
    ...(pool === "local" || pool === "activity" ? { with_origin_country: region } : {}),
    // Stop unrated metadata stubs crowding the limited Discover pool. Genuine
    // daily/weekly trends are fetched independently and do not use this floor.
    "vote_count.gte": "5", "vote_average.gte": "6",
    ...(type === "movie" ? { include_video: "false" } : { include_null_first_air_dates: "false", timezone: "UTC" }),
    ...(airing ? { "air_date.gte": dates.activityStart, "air_date.lte": dates.today } : {}),
  };
}

const clamp = (value: number) => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
export const countryPopularity = (media: Media) => clamp(Math.log1p(Math.max(0, media.popularity ?? 0)) / Math.log(101));
function releaseAge(media: Media, today: string) {
  const date = media.releaseDate;
  if (!Number.isSafeInteger(media.id) || media.id < 1 || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || date > today || new Date(date).toISOString().slice(0, 10) !== date) return null;
  return (Date.parse(today) - Date.parse(date)) / DAY;
}
function availableCandidates(candidates: CountryCandidate[], region: string) {
  const unique = new Map<string, CountryCandidate>();
  for (const candidate of candidates) {
    if (!candidate.available) continue;
    const key = mediaKey(candidate.media), previous = unique.get(key);
    const origin = candidate.media.originCountries;
    // Unknown movie origin is not automatically international. A verified local
    // response wins over a negative inference or a co-production's other country.
    const local = candidate.local === true || previous?.local === true || origin?.includes(region) ? true
      : candidate.local === false || previous?.local === false || origin?.length ? false : undefined;
    unique.set(key, { ...candidate, local, recentlyAired: candidate.recentlyAired || previous?.recentlyAired });
  }
  return [...unique.values()];
}
// Positive floor means even the end of an actual trending feed carries evidence.
const trendRanks = (items: Media[]) => new Map(items.map((media, index) => [mediaKey(media), 0.25 + 0.75 * (items.length - index) / items.length]));

export function rankCountryDiscovery(candidates: CountryCandidate[], trending: Media[], region: string, now = new Date(), options: { daily?: Media[]; activity?: ReadonlyMap<string, CountryActivitySignal> } = {}): CountryPick[] {
  const { today, recentStart } = countryTrendingDates(now);
  const weeks = trendRanks(trending), days = trendRanks(options.daily ?? []);
  const picks: CountryPick[] = [];
  for (const { media, local, recentlyAired } of availableCandidates(candidates, region)) {
    if (local === undefined) continue;
    const age = releaseAge(media, today);
    if (age === null) continue;
    const votes = Number.isFinite(media.voteCount) ? Math.max(0, media.voteCount) : 0;
    const rating = clamp(media.rating / 10), popularity = countryPopularity(media);
    const established = votes >= 20 && rating >= 0.6;
    if (votes >= 10 && rating < 0.55) continue;
    const daily = days.get(mediaKey(media)) ?? 0, weekly = weeks.get(mediaKey(media)) ?? 0;
    // Recent episode evidence is independent of the show's original premiere.
    // A long-running low-interest soap cannot enter just because it is still airing.
    const airing = media.mediaType === "tv" && Boolean(recentlyAired) && votes >= 100 && rating >= 0.65 && (media.popularity ?? 0) >= 30;
    const supplied = options.activity?.get(mediaKey(media));
    const activityAge = supplied ? (Date.parse(today) - Date.parse(supplied.asOf)) / DAY : NaN;
    const activity = supplied?.region === region && activityAge >= 0 && activityAge <= 7 ? clamp(supplied.recentScore) : 0;
    // Symmetric eligibility: nationality never relaxes the interest threshold.
    const recentInterest = age <= 90 && established && (media.popularity ?? 0) >= 20;
    const emergingInterest = age <= 45 && votes >= 5 && rating >= 0.6 && (media.popularity ?? 0) >= 20;
    if (!daily && !weekly && !airing && !recentInterest && !emergingInterest && !(activity >= 0.5 && established)) continue;
    const older = media.releaseDate! < recentStart;
    if (older && !established) continue;
    const freshness = Math.max(Math.pow(0.5, age / 90), airing ? 0.8 : 0);
    const event = airing ? 1 : age <= 90 ? Math.pow(0.5, age / 30) : 0;
    const score = 50 * Math.max(daily, 0.85 * weekly) + (daily && weekly ? 10 : 0)
      + 18 * freshness + 6 * event + 12 * popularity + 4 * rating * votes / (votes + 50)
      + (local ? 8 : 0) + 20 * activity;
    const reason = daily ? "daily-trend" : weekly ? "weekly-trend" : activity >= 0.5 && established ? "ifynex-activity" : airing ? "recent-airing" : "recent-interest";
    picks.push({ media: { ...media, discoverySignal: reason }, local: Boolean(local), score, older, signals: { daily, weekly, airing, popularity, activity, reason } });
  }
  return sortCountryPicks(picks);
}

export function sortCountryPicks(picks: CountryPick[], sort: CountrySort = "current"): CountryPick[] {
  return [...picks].sort((a, b) => Number(a.older) - Number(b.older)
    || (sort === "newest" ? b.media.releaseDate!.localeCompare(a.media.releaseDate!) : 0)
    || b.score - a.score || b.media.releaseDate!.localeCompare(a.media.releaseDate!)
    || a.media.mediaType.localeCompare(b.media.mediaType) || a.media.id - b.media.id);
}

export function selectCountryPicks(picks: CountryPick[], limit = 120, sort: CountrySort = "current"): CountryPick[] {
  // Sorting never expands or swaps the eligible set selected by the current chart.
  if (sort === "newest") return sortCountryPicks(selectCountryPicks(picks, limit), "newest");
  const ordered = sortCountryPicks(picks);
  const recent = ordered.filter(pick => !pick.older).slice(0, limit);
  const returning = ordered.filter(pick => pick.older && pick.signals.airing);
  // Returning series may compete on current interest, but cannot take more than
  // 20% of ANY leading selection. Four current releases must precede the first.
  // This is a ceiling, never a target or a reason to insert a weak series.
  const eligible = [...recent, ...returning].sort((a, b) => b.score - a.score || b.media.releaseDate!.localeCompare(a.media.releaseDate!) || a.media.mediaType.localeCompare(b.media.mediaType) || a.media.id - b.media.id);
  // Soft media diversity only among similarly strong results within a bucket.
  const mixed: CountryPick[] = [];
  let returningCount = 0;
  while (eligible.length && mixed.length < limit) {
    const allowed = (pick: CountryPick) => !pick.older || returningCount < Math.floor((mixed.length + 1) / 5);
    const next = eligible.findIndex(allowed);
    if (next < 0) break;
    const last = mixed.slice(-3);
    const alternate = last.length === 3 && last.every(pick => pick.media.mediaType === last[0].media.mediaType)
      ? eligible.findIndex(pick => allowed(pick) && pick.media.mediaType !== last[0].media.mediaType && pick.older === eligible[next].older && pick.score >= eligible[next].score - 10) : -1;
    const [pick] = eligible.splice(alternate >= 0 ? alternate : next, 1);
    mixed.push(pick);
    if (pick.older) returningCount++;
  }
  const revivalLimit = Math.min(Math.floor(mixed.length / 9), Math.floor(limit / 10), limit - mixed.length);
  return [...mixed, ...ordered.filter(pick => pick.older && !pick.signals.airing).slice(0, revivalLimit)];
}

// Quotas are applied AFTER eligibility, separately to each origin bucket. Missing
// local slots cannot be silently replaced by more international catalog titles.
export function selectCountryMix(picks: CountryPick[], options: { sort?: CountrySort; origin?: "all" | "local" } = {}): { home: CountryPick[]; all: CountryPick[]; localTotal: number; internationalTotal: number } {
  const unique = new Map<string, CountryPick>();
  for (const pick of picks) {
    const key = mediaKey(pick.media), previous = unique.get(key);
    if (!previous || pick.local || !previous.local) unique.set(key, pick);
  }
  const newest = options.sort === "newest";
  const order = (items: CountryPick[]) => newest ? [...items].sort((a, b) => b.media.releaseDate!.localeCompare(a.media.releaseDate!) || b.score - a.score || a.media.mediaType.localeCompare(b.media.mediaType) || a.media.id - b.media.id) : items;
  const bucket = (local: boolean, cap: number) => {
    const eligible = [...unique.values()].filter(pick => pick.local === local);
    return order(selectCountryPicks(eligible, cap));
  };
  const local = bucket(true, COUNTRY_BROWSE_LOCAL);
  // Preserve a local-led full list when fewer than 200 local titles qualify.
  // Keep room for the eight home picks; otherwise use the requested 4:1 ratio.
  const internationalCap = Math.min(COUNTRY_BROWSE_INTERNATIONAL, Math.max(COUNTRY_HOME_INTERNATIONAL, Math.floor(local.length / 4)));
  const international = options.origin === "local" ? [] : bucket(false, internationalCap);
  if (options.origin === "local") return { home: local.slice(0, COUNTRY_HOME_LOCAL), all: local, localTotal: local.length, internationalTotal: 0 };
  const homeLocal = local.slice(0, COUNTRY_HOME_LOCAL), homeInternational = international.slice(0, COUNTRY_HOME_INTERNATIONAL);
  const weave = (locals: CountryPick[], others: CountryPick[], localRun: number) => {
    const mixed: CountryPick[] = [];
    for (let l = 0, i = 0; l < locals.length || i < others.length;) {
      mixed.push(...locals.slice(l, l + localRun)); l += localRun;
      if (i < others.length) mixed.push(others[i++]);
    }
    return mixed;
  };
  // Home: two local then one international. The remainder favors local content
  // four-to-one until a bucket ends, while retaining the full 200/50 caps.
  const home = newest ? order([...homeLocal, ...homeInternational]) : weave(homeLocal, homeInternational, 2);
  // Newest sorts the same capped membership chronologically across ALL pages.
  // Home keeps its 16/8 preview; the default current page matches that preview.
  const all = newest ? order([...local, ...international]) : [...home, ...weave(local.slice(homeLocal.length), international.slice(homeInternational.length), 4)];
  return { home, all, localTotal: local.length, internationalTotal: international.length };
}

export function countryPageSlice(selection: { home: CountryPick[]; all: CountryPick[] }, requestedPage = 1, origin: "all" | "local" = "all") {
  // A sparse first page matches home exactly, rather than filling it past 8
  // international picks. Following pages contain up to 24 remaining items.
  const firstSize = origin === "local" ? Math.min(COUNTRY_PAGE_SIZE, selection.all.length) : selection.home.length;
  const totalPages = 1 + Math.ceil(Math.max(0, selection.all.length - firstSize) / COUNTRY_PAGE_SIZE);
  const page = Math.max(1, Math.min(totalPages, Number.isSafeInteger(requestedPage) ? requestedPage : 1));
  const start = page === 1 ? 0 : firstSize + (page - 2) * COUNTRY_PAGE_SIZE;
  return { page, totalPages, items: selection.all.slice(start, page === 1 ? firstSize : start + COUNTRY_PAGE_SIZE) };
}
