import type { Media, MediaType } from "./media";

export type Genre = { id: number; name: string };
export type DiscoveryPeriod = "recent" | "year";
export type DiscoveryCandidate = { media: Media; local?: boolean; recentlyAired?: boolean };
export type CountrySurface = "home" | "browse";
export type CountryMediaFilter = "all" | MediaType;
export type CountryPick = { media: Media; local: boolean; score: number };

const DAY = 86_400_000;
export function discoveryDates(now = new Date()) {
  const today = now.toISOString().slice(0, 10);
  const year = now.getUTCFullYear();
  return { today, year, recentStart: `${year - 1}-01-01`, yearStart: `${year}-01-01`, activityStart: new Date(Date.parse(today) - 90 * DAY).toISOString().slice(0, 10) };
}

// watch_region alone does not filter availability; monetization must accompany it.
export function discoveryParams(type: MediaType, region: string, now = new Date(), options: { activity?: boolean; local?: boolean; genreId?: number; period?: DiscoveryPeriod; countryFocused?: boolean; page?: number } = {}): Record<string, string> {
  const dates = discoveryDates(now);
  const start = options.period === "year" ? dates.yearStart : options.countryFocused ? `${dates.year - 1}-07-01` : dates.recentStart;
  const dateField = type === "movie" ? "primary_release_date" : "first_air_date";
  return {
    language: "en-US", watch_region: region,
    with_watch_monetization_types: "flatrate|free|ads|rent|buy",
    sort_by: "popularity.desc", include_adult: "false", page: String(options.page ?? 1),
    [`${dateField}.lte`]: dates.today,
    ...(!options.activity ? { [`${dateField}.gte`]: start } : {}),
    ...(type === "movie" ? { include_video: "false" } : { include_null_first_air_dates: "false", timezone: "UTC" }),
    ...(options.activity && type === "tv" ? { "air_date.gte": dates.activityStart, "air_date.lte": dates.today } : {}),
    ...(options.local ? { with_origin_country: region } : {}),
    ...(options.genreId ? { with_genres: String(options.genreId) } : {}),
  };
}

const mediaKey = (media: Media) => `${media.mediaType}:${media.id}`;

// This is an editorial discovery score, never a TMDB country chart or viewing rank.
// Popularity is log-normalized within one media type so outliers cannot swamp freshness.
export function rankDiscovery(candidates: DiscoveryCandidate[], trending: Media[], now = new Date(), options: { limit?: number; period?: DiscoveryPeriod } = {}): Media[] {
  const { today, year, recentStart, yearStart } = discoveryDates(now);
  const start = options.period === "year" ? yearStart : recentStart;
  const limit = options.limit ?? 18;
  const trendRanks = new Map(trending.map((media, index) => [mediaKey(media), index]));
  const unique = new Map<string, DiscoveryCandidate>();
  for (const candidate of candidates) {
    const key = mediaKey(candidate.media);
    const previous = unique.get(key);
    unique.set(key, { ...candidate, local: candidate.local || previous?.local, recentlyAired: candidate.recentlyAired || previous?.recentlyAired });
  }
  const eligible = [...unique.values()].filter(({ media, recentlyAired }) => {
    const date = media.releaseDate;
    if (!date || !Number.isFinite(Date.parse(date)) || date > today || !Number.isSafeInteger(media.id) || media.id < 1) return false;
    return date >= start || (options.period !== "year" && (trendRanks.has(mediaKey(media)) || (media.mediaType === "tv" && recentlyAired)));
  });
  const maxPopularity = Math.max(1, ...eligible.map(({ media }) => Math.log1p(Math.max(0, media.popularity ?? 0))));
  const scored = eligible.map(candidate => {
    const { media, recentlyAired } = candidate;
    const ageDays = (Date.parse(today) - Date.parse(media.releaseDate!)) / DAY;
    const releaseYear = Number(media.releaseDate!.slice(0, 4));
    const trendRank = trendRanks.get(mediaKey(media));
    const score = 45 * Math.pow(0.5, ageDays / 180)
      + (releaseYear === year ? 20 : releaseYear === year - 1 ? 12 : 0)
      + 25 * Math.log1p(Math.max(0, media.popularity ?? 0)) / maxPopularity
      + (trendRank === undefined ? 0 : 10 * (trending.length - trendRank) / trending.length)
      + (recentlyAired && media.mediaType === "tv" ? 10 : 0);
    return { ...candidate, score, older: media.releaseDate! < start };
  }).sort((a, b) => b.score - a.score || b.media.releaseDate!.localeCompare(a.media.releaseDate!) || a.media.id - b.media.id);

  // At most one older pick per three recent picks, even with sparse provider coverage.
  // Sparse regions stay short rather than silently falling back to an old/global catalog.
  const recentCount = scored.filter(item => !item.older).length;
  const olderLimit = options.period === "year" ? 0 : Math.min(Math.floor(limit / 4), Math.floor(recentCount / 3));
  const selected: typeof scored = [];
  let olderCount = 0;
  while (selected.length < limit) {
    const available = scored.filter(item => !selected.includes(item) && (!item.older || olderCount < olderLimit));
    if (!available.length) break;
    const next = available[0];
    selected.push(next);
    if (next.older) olderCount += 1;
  }
  return selected.map(item => item.media);
}

// Country discovery has a stronger quality/locality policy than general genre browsing.
// Origin evidence comes from TMDB metadata or a with_origin_country-filtered response.
// These are product weights, not country viewing statistics; scores are never shown as ranks.
export function rankCountryDiscovery(candidates: DiscoveryCandidate[], trending: Media[], region: string, now = new Date(), options: { surface?: CountrySurface; limit?: number } = {}): CountryPick[] {
  const { today, year } = discoveryDates(now);
  const recentStart = `${year - 1}-07-01`;
  const limit = options.limit ?? 6;
  const surface = options.surface ?? "home";
  const trendRanks = new Map(trending.map((media, index) => [mediaKey(media), index]));
  const unique = new Map<string, DiscoveryCandidate>();
  for (const candidate of candidates) {
    const key = mediaKey(candidate.media);
    const previous = unique.get(key);
    unique.set(key, { ...candidate, local: candidate.local || previous?.local || candidate.media.originCountries?.includes(region), recentlyAired: candidate.recentlyAired || previous?.recentlyAired });
  }
  const dated = [...unique.values()].filter(({ media }) => media.releaseDate && /^\d{4}-\d{2}-\d{2}$/.test(media.releaseDate) && Number.isFinite(Date.parse(media.releaseDate)) && media.releaseDate <= today && Number.isSafeInteger(media.id) && media.id > 0);
  const popularityMax = Math.max(1, ...dated.map(({ media }) => Math.log1p(Math.max(0, media.popularity ?? 0))));
  const scored = dated.flatMap(({ media, local, recentlyAired }) => {
    const date = media.releaseDate!;
    const age = (Date.parse(today) - Date.parse(date)) / DAY;
    const popularity = Math.log1p(Math.max(0, media.popularity ?? 0)) / popularityMax;
    const votes = Math.max(0, media.voteCount);
    const rating = Math.max(0, Math.min(10, media.rating));
    const trendRank = trendRanks.get(mediaKey(media));
    const inTrend = trendRank !== undefined;
    const airing = media.mediaType === "tv" && Boolean(recentlyAired);
    const older = date < recentStart;
    // Established quality or credible fresh interest; no quota can rescue a weak local title.
    if (votes >= 10 && rating < 5.5) return [];
    const established = votes >= 20 && rating >= 6;
    const emerging = age <= 60 && popularity >= 0.4;
    if (!established && !inTrend && !emerging) return [];
    if (older && (!established || (!inTrend && !airing))) return [];
    // International picks need an additional strong current signal, not popularity alone.
    if (!local && !inTrend && !(established && popularity >= 0.65 && (age <= 180 || airing))) return [];
    const confidence = votes / (votes + 50);
    const score = 40 * Math.pow(0.5, age / 120)
      + (date.startsWith(String(year)) ? 22 : !older ? 10 : 0)
      + 20 * popularity
      + 10 * (rating / 10) * confidence
      + (inTrend ? 18 * (trending.length - trendRank) / trending.length : 0)
      + (airing ? 8 : 0)
      + (local ? surface === "browse" ? 60 : 44 : 0);
    return [{ media, local: Boolean(local), score, older }];
  }).sort((a, b) => Number(a.older) - Number(b.older) || b.score - a.score || b.media.releaseDate!.localeCompare(a.media.releaseDate!) || a.media.id - b.media.id);

  const recent = scored.filter(item => !item.older);
  const older = scored.filter(item => item.older);
  const olderLimit = Math.min(Math.floor(limit / 5), Math.floor(recent.length / 4), older.length);
  // Reserve only for a currently relevant older pick whose score is competitive with
  // the weakest selected recent pick. Older exceptions always follow the recent group.
  const selected = recent.slice(0, limit);
  for (const item of older.slice(0, olderLimit)) {
    if (selected.length < limit) selected.push(item);
    else {
      const lastRecentIndex = selected.findLastIndex(pick => !pick.older);
      if (lastRecentIndex < 0 || item.score < selected[lastRecentIndex].score) continue;
      selected.splice(lastRecentIndex, 1);
      selected.push(item);
    }
  }
  return selected.map(({ media, local, score }) => ({ media, local, score }));
}

export function combineDiscovery(movies: Media[], tv: Media[], limit = 18): Media[] {
  const result: Media[] = [];
  for (let index = 0; index < Math.max(movies.length, tv.length) && result.length < limit; index += 1) {
    if (movies[index]) result.push(movies[index]);
    if (tv[index] && result.length < limit) result.push(tv[index]);
  }
  return result;
}
