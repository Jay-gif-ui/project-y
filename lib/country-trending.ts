import type { Media, MediaType } from "./media";

export type CountrySurface = "home" | "browse";
export type CountryMediaFilter = "all" | MediaType;
export type CountrySort = "current" | "newest";
export type CountryPeriod = "current" | "year";
export type CountryCandidate = { media: Media; available: boolean; local?: boolean; recentlyAired?: boolean };
// Future server-side adapter input. No production adapter or fabricated activity exists.
// recentScore must be a normalized trailing-seven-day aggregate, never a lifetime count.
export type CountryActivitySignal = { region: string; asOf: string; recentScore: number };
export type CountryActivitySource = (region: string, type: MediaType, now: Date) => Promise<ReadonlyMap<string, CountryActivitySignal>>;
export type CountryPick = {
  media: Media; local: boolean; score: number; older: boolean;
  signals: { weekly: number; airing: boolean; popularity: number; activity: number; reason: "weekly-trend" | "recent-airing" | "recent-release" | "ifynex-activity" };
};

const DAY = 86_400_000;
export const COUNTRY_HOME_LIMIT = 24;
export const COUNTRY_PAGE_SIZE = 24;
export const COUNTRY_TREND_PROBE_LIMIT = 4;
export const mediaKey = (media: Media) => `${media.mediaType}:${media.id}`;
export function countryTrendingDates(now = new Date()) {
  const today = now.toISOString().slice(0, 10);
  const year = now.getUTCFullYear();
  const ago = (days: number) => new Date(Date.parse(today) - days * DAY).toISOString().slice(0, 10);
  return { today, year, recentStart: `${year - 1}-07-01`, releaseStart: ago(180), freshStart: ago(60), activityStart: ago(28) };
}

// Discover builds a bounded candidate pool, never the final chart. Every query is
// scoped to actual reported regional monetization. No unbounded movie activity query.
export function countryTrendingParams(type: MediaType, region: string, now: Date, pool: "local" | "international" | "activity", page = 1): Record<string, string> {
  const dates = countryTrendingDates(now);
  const field = type === "movie" ? "primary_release_date" : "first_air_date";
  const airing = pool === "activity" && type === "tv";
  return {
    language: "en-US", include_adult: "false", page: String(page),
    watch_region: region, with_watch_monetization_types: "flatrate|free|ads|rent|buy",
    sort_by: pool === "activity" && type === "movie" ? "primary_release_date.desc" : "popularity.desc",
    [`${field}.lte`]: dates.today,
    ...(!airing ? { [`${field}.gte`]: pool === "activity" ? dates.freshStart : dates.releaseStart } : {}),
    ...(pool !== "international" ? { with_origin_country: region } : {}),
    ...(type === "movie" ? { include_video: "false" } : { include_null_first_air_dates: "false", timezone: "UTC" }),
    ...(airing ? { "air_date.gte": dates.activityStart, "air_date.lte": dates.today } : {}),
  };
}

const clamp = (value: number) => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
// A fixed saturation point prevents one huge catalog outlier or another page from
// changing every other title's eligibility. Popularity contributes at most 12 points.
export const countryPopularity = (media: Media) => clamp(Math.log1p(Math.max(0, media.popularity ?? 0)) / Math.log(101));

export function rankCountryDiscovery(candidates: CountryCandidate[], trending: Media[], region: string, now = new Date(), options: { activity?: ReadonlyMap<string, CountryActivitySignal> } = {}): CountryPick[] {
  const { today, year, recentStart } = countryTrendingDates(now);
  const ranks = new Map(trending.map((media, index) => [mediaKey(media), index]));
  const unique = new Map<string, CountryCandidate>();
  for (const candidate of candidates) {
    if (!candidate.available) continue;
    const key = mediaKey(candidate.media), previous = unique.get(key);
    unique.set(key, { ...candidate, local: Boolean(candidate.local || previous?.local || candidate.media.originCountries?.includes(region)), recentlyAired: candidate.recentlyAired || previous?.recentlyAired });
  }
  const picks: CountryPick[] = [];
  for (const { media, local, recentlyAired } of unique.values()) {
    const date = media.releaseDate;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || date > today || new Date(date).toISOString().slice(0, 10) !== date || !Number.isSafeInteger(media.id) || media.id < 1) continue;
    const age = (Date.parse(today) - Date.parse(date)) / DAY;
    const popularity = countryPopularity(media);
    const votes = Number.isFinite(media.voteCount) ? Math.max(0, media.voteCount) : 0;
    const rating = clamp(media.rating / 10);
    const established = votes >= 20 && rating >= 0.6;
    if (votes >= 10 && rating < 0.55) continue;
    const rank = ranks.get(mediaKey(media));
    const weekly = rank === undefined ? 0 : (trending.length - rank) / trending.length;
    const older = date < recentStart;
    const airing = media.mediaType === "tv" && Boolean(recentlyAired) && established && popularity >= (older ? 0.6 : 0.35) && (!older || (votes >= 50 && rating >= 0.65));
    const supplied = options.activity?.get(mediaKey(media));
    const activityAge = supplied ? (Date.parse(today) - Date.parse(supplied.asOf)) / DAY : NaN;
    const activity = supplied?.region === region && activityAge >= 0 && activityAge <= 7 ? clamp(supplied.recentScore) : 0;
    // Release freshness plus audience interest is a proxy only in the last 180 days.
    // Earlier 2026 / late-2025 releases require weekly trending or recent airing.
    const fresh = age <= 60 ? popularity >= 0.4 : age <= 180 && established && popularity >= 0.35;
    if (!weekly && !airing && !fresh && !(activity >= 0.5 && established)) continue;
    if (!established && !weekly && !(age <= 60 && popularity >= 0.4)) continue;
    if (older && !established) continue;
    // International releases need stronger evidence; origin never bypasses freshness.
    if (!local && !weekly && !(activity >= 0.5 && established) && !(established && popularity >= 0.9 && (age <= 30 || airing))) continue;
    const score = 40 * Math.pow(0.5, age / 90)
      + (date.startsWith(String(year)) ? 20 : !older ? 8 : 0)
      + 12 * popularity + 8 * rating * votes / (votes + 50)
      + 32 * weekly + (airing ? 12 : 0) + (local ? 32 : 0) + 20 * activity;
    picks.push({ media, local: Boolean(local), score, older, signals: { weekly, airing, popularity, activity, reason: weekly ? "weekly-trend" : airing ? "recent-airing" : activity >= 0.5 && established ? "ifynex-activity" : "recent-release" } });
  }
  return sortCountryPicks(picks);
}

export function sortCountryPicks(picks: CountryPick[], sort: CountrySort = "current"): CountryPick[] {
  return [...picks].sort((a, b) => Number(a.older) - Number(b.older)
    || (sort === "newest" ? b.media.releaseDate!.localeCompare(a.media.releaseDate!) : 0)
    || b.score - a.score || b.media.releaseDate!.localeCompare(a.media.releaseDate!)
    || a.media.mediaType.localeCompare(b.media.mediaType) || a.media.id - b.media.id);
}

// Same eligibility and score for home and See All. No slot reservations for old
// favorites; at most 10% genuine resurfacing titles, after all current releases.
export function selectCountryPicks(picks: CountryPick[], limit = 120, sort: CountrySort = "current"): CountryPick[] {
  const ordered = sortCountryPicks(picks, sort);
  const recent = ordered.filter(pick => !pick.older).slice(0, limit);
  const olderLimit = Math.min(Math.floor(recent.length / 9), Math.floor(limit / 10), limit - recent.length);
  const eligible = [...recent, ...ordered.filter(pick => pick.older).slice(0, olderLimit)];
  // Soft media diversity: after three of one type, use the next competitive title
  // of the other type (within 20 points). Never adds an ineligible or weak filler.
  if (sort === "newest") return eligible;
  const mixed: CountryPick[] = [];
  while (eligible.length) {
    const last = mixed.slice(-3);
    const alternate = last.length === 3 && last.every(pick => pick.media.mediaType === last[0].media.mediaType)
      ? eligible.findIndex(pick => pick.media.mediaType !== last[0].media.mediaType && pick.older === eligible[0].older && pick.score >= eligible[0].score - 20) : -1;
    const localRun = mixed.slice(-6);
    // A competitive genuine international trend may break a long local run.
    // It must be within the 32-point origin bonus; there is no nationality quota.
    const international = localRun.length === 6 && localRun.every(pick => pick.local)
      ? eligible.findIndex(pick => !pick.local && pick.signals.weekly > 0 && pick.older === eligible[0].older && pick.score >= eligible[0].score - 32) : -1;
    mixed.push(...eligible.splice(alternate > 0 ? alternate : international > 0 ? international : 0, 1));
  }
  return mixed;
}
