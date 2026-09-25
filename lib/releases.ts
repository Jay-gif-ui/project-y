import { DISCOVERY_CONFIG } from "@/data/discovery-config";
import { mediaKey } from "@/lib/country-trending";
import type { Media, MediaType } from "@/lib/media";

export type ReleaseFilter = "all" | "released" | "upcoming";
export type ReleaseEvent = { date: string; kind: "theatrical" | "digital" | "premiere" | "episode"; regional: boolean };
export type ReleaseCandidate = { media: Media; events: ReleaseEvent[] };
const DAY = 86_400_000;
export function releaseDates(now = new Date()) {
  const today = now.toISOString().slice(0, 10);
  const offset = (days: number) => new Date(Date.parse(today) + days * DAY).toISOString().slice(0, 10);
  return { today, recentStart: offset(-DISCOVERY_CONFIG.recentDays), upcomingEnd: offset(DISCOVERY_CONFIG.upcomingDays), tomorrow: offset(1) };
}
export function validReleaseDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
export function releaseParams(type: MediaType, region: string, now: Date, source: string, page = 1): Record<string, string> {
  const dates = releaseDates(now);
  const common = { language: "en-US", include_adult: "false", page: String(page) };
  const watch = { watch_region: region, with_watch_monetization_types: "flatrate|free|ads|rent|buy" };
  if (type === "movie") {
    if (source === "available") return { ...common, ...watch, include_video: "false", sort_by: "primary_release_date.desc", "primary_release_date.gte": dates.recentStart, "primary_release_date.lte": dates.today };
    // Within the strict date window, include a digital/current-interest probe so
    // older theatrical premieres and important upcoming titles aren't starved by
    // primary-release-date pagination. Verified event dates still decide all ranking.
    return { ...common, include_video: "false", region, with_release_type: source === "digital" ? "4" : "2|3|4", sort_by: source === "recent" ? "primary_release_date.desc" : "popularity.desc", "release_date.gte": source === "upcoming" ? dates.tomorrow : dates.recentStart, "release_date.lte": source === "upcoming" ? dates.upcomingEnd : dates.today };
  }
  const episodes = source.endsWith("episodes");
  const field = episodes ? "air_date" : "first_air_date";
  return { ...common, ...(source.startsWith("local") ? { with_origin_country: region } : watch), timezone: "UTC", include_null_first_air_dates: "false", sort_by: episodes ? "popularity.desc" : "first_air_date.desc", [`${field}.gte`]: dates.recentStart, [`${field}.lte`]: dates.upcomingEnd };
}

// Dates decide eligibility. Rating/popularity never disqualify a genuine new release.
// A regional event takes precedence over a generic premiere/provider fallback.
export function selectReleaseItems(candidates: ReleaseCandidate[], now = new Date(), status: ReleaseFilter = "all"): Media[] {
  const { today, recentStart, upcomingEnd } = releaseDates(now);
  const result = new Map<string, Media>();
  for (const { media, events } of candidates) {
    if (!Number.isSafeInteger(media.id) || media.id < 1) continue;
    const eligible = events.filter(event => validReleaseDate(event.date) && event.date >= recentStart && event.date <= upcomingEnd
      && (status === "all" || (status === "upcoming" ? event.date > today : event.date <= today)));
    eligible.sort((a, b) => Number(a.date > today) - Number(b.date > today)
      || (a.date > today ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)) || Number(b.regional) - Number(a.regional));
    const event = eligible[0];
    if (!event) continue;
    const item: Media = { ...media, discoverySignal: event.date > today ? "upcoming-release" : "recent-release", releaseEvent: { ...event, status: event.date > today ? "upcoming" : "released" } };
    const previous = result.get(mediaKey(item));
    if (!previous || compareReleases(item, previous) < 0) result.set(mediaKey(item), item);
  }
  return [...result.values()].sort(compareReleases);
}
export function compareReleases(a: Media, b: Media) {
  const x = a.releaseEvent!, y = b.releaseEvent!;
  return Number(x.status === "upcoming") - Number(y.status === "upcoming")
    || (x.status === "upcoming" ? x.date.localeCompare(y.date) : y.date.localeCompare(x.date))
    || Number(y.regional) - Number(x.regional) || a.mediaType.localeCompare(b.mediaType) || a.id - b.id;
}
