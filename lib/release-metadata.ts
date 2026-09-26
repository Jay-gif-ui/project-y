import type { Media } from "@/lib/media";
import { validReleaseDate, type ReleaseCandidate, type ReleaseEvent } from "@/lib/releases";
import { normalizeWatchProviders, OFFER_TYPES } from "@/lib/watch-providers";

type Raw = Record<string, unknown>;
const records = (value: unknown): Raw[] => Array.isArray(value) ? value.filter((item): item is Raw => Boolean(item) && typeof item === "object") : [];
export function hasRegionalOffers(raw: Raw, region: string) {
  return regionalAvailability(raw, region) === true;
}
function regionalAvailability(raw: Raw, region: string): boolean | undefined {
  const response = raw["watch/providers"];
  if (!response || typeof response !== "object") return undefined;
  const offers = normalizeWatchProviders(response as Raw, region);
  return offers ? OFFER_TYPES.some(({ key }) => offers[key].length > 0) : undefined;
}
export function regionalMovieEvents(raw: Raw, region: string): ReleaseEvent[] {
  const releases = raw.release_dates as { results?: unknown } | undefined;
  return records(releases?.results).filter(item => item.iso_3166_1 === region).flatMap(item => records(item.release_dates)).flatMap(item => {
    const date = typeof item.release_date === "string" ? item.release_date.slice(0, 10) : "";
    return validReleaseDate(date) && Number.isFinite(Date.parse(String(item.release_date))) && [2, 3, 4].includes(Number(item.type)) ? [{ date, kind: Number(item.type) === 4 ? "digital" as const : "theatrical" as const, regional: true }] : [];
  });
}
export function releaseCandidate(media: Media, raw: Raw, region: string): ReleaseCandidate {
  const available = regionalAvailability(raw, region), local = Boolean(media.originCountries?.includes(region));
  if (media.mediaType === "movie") {
    const events = regionalMovieEvents(raw, region);
    // A provider listing confirms an offer, never the local release date. Without
    // a regional theatrical/digital record the date cannot be confidently verified.
    return { media, events, available };
  }
  if (!available && !local) return { media, events: [], available };
  // TMDB has no country-specific TV episode schedule: these are reported air dates,
  // qualified by country origin or current offers, not invented platform launch dates.
  const events: ReleaseEvent[] = validReleaseDate(media.releaseDate) ? [{ date: media.releaseDate, kind: "premiere", regional: false }] : [];
  for (const name of ["last_episode_to_air", "next_episode_to_air"]) {
    const episode = raw[name] as Raw | null | undefined;
    if (validReleaseDate(episode?.air_date) && (!validReleaseDate(media.releaseDate) || episode.air_date >= media.releaseDate)) events.push({ date: episode.air_date, kind: "episode", regional: false });
  }
  return { media, events, available };
}
export function relevantReleasedTitle(media: Media, raw: Raw, region: string, today: string, manual = false) {
  if (!validReleaseDate(media.releaseDate) || media.releaseDate > today) return false;
  const events = media.mediaType === "movie" ? regionalMovieEvents(raw, region) : [];
  // Advance provider listings and an earlier overseas premiere must not override
  // a wholly upcoming local schedule, even for a manually configured title.
  if (events.length && events.every(event => event.date > today)) return false;
  if (hasRegionalOffers(raw, region)) return true;
  if (events.some(event => event.date <= today && (manual || Date.parse(today) - Date.parse(event.date) <= 90 * 86_400_000))) return true;
  return manual && Boolean(media.originCountries?.includes(region));
}
