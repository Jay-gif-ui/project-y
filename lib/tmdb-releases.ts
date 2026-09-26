import "server-only";
import { DISCOVERY_CONFIG } from "@/data/discovery-config";
import { isEnabledCountryCode } from "@/lib/countries";
import { mediaKey, type CountryMediaFilter } from "@/lib/country-trending";
import { releaseParams, selectReleaseItems, type ReleaseFilter } from "@/lib/releases";
import { releaseCandidate } from "@/lib/release-metadata";
import { getDiscoveryMetadata, getReleaseSource, type CountryDiscoveryData, type TmdbResult } from "@/lib/tmdb";
import type { Media, MediaType } from "@/lib/media";

export async function getCountryReleases(region: string, options: { filter?: CountryMediaFilter; status?: ReleaseFilter; page?: number; origin?: "all" | "local"; period?: "current" | "year" } = {}, now = new Date()): Promise<TmdbResult<CountryDiscoveryData>> {
  region = region.toUpperCase();
  if (!isEnabledCountryCode(region)) return { error: "not-found" };
  const types: MediaType[] = options.filter && options.filter !== "all" ? [options.filter] : ["movie", "tv"];
  const pools = await Promise.all(types.map(async type => {
    const sources = type === "movie" ? ["recent", "upcoming", "digital"] : ["local-premieres", "available-premieres", "local-episodes", "available-episodes"];
    const results = await Promise.all(sources.map(async source => {
      const data: Media[] = [];
      for (let page = 1; page <= DISCOVERY_CONFIG.releasePagesPerSource; page++) {
        const result = await getReleaseSource(type, releaseParams(type, region, now, source, page));
        if (!result.data) return { data, error: result.error };
        data.push(...result.data);
        if (page >= (result.totalPages ?? 1)) break;
      }
      return { data };
    }));
    // Interleave before the cap so premieres, episodes and upcoming all get probes.
    const unique = new Map<string, Media>();
    for (let index = 0; index < Math.max(0, ...results.map(result => result.data.length)); index++) {
      for (const result of results) { const item = result.data[index]; if (item) unique.set(mediaKey(item), item); }
    }
    const details = await Promise.all([...unique.values()].slice(0, DISCOVERY_CONFIG.releaseDetailsPerType).map(media => getDiscoveryMetadata(media.mediaType, media.id)));
    return { candidates: details.flatMap(result => result.data ? [releaseCandidate(result.data.media, result.data.raw, region)] : []), errors: [...results, ...details].flatMap(result => result.error ? [result.error] : []) };
  }));
  const all = selectReleaseItems(pools.flatMap(pool => pool.candidates), now, options.status).filter(media => (options.origin !== "local" || media.originCountries?.includes(region)) && (options.period !== "year" || media.releaseEvent?.date.startsWith(String(now.getUTCFullYear()))));
  const error = pools.flatMap(pool => pool.errors)[0];
  if (!all.length && error) return { error };
  const totalPages = Math.max(1, Math.ceil(all.length / DISCOVERY_CONFIG.pageSize));
  const page = Math.max(1, Math.min(totalPages, Number.isSafeInteger(options.page) ? options.page! : 1));
  const items = all.slice((page - 1) * DISCOVERY_CONFIG.pageSize, page * DISCOVERY_CONFIG.pageSize);
  const local = (media: Media) => Boolean(media.originCountries?.includes(region));
  const localTotal = all.filter(local).length;
  return { data: { items, localIds: items.filter(local).map(mediaKey), localTotal, internationalTotal: all.length - localTotal, total: all.length, page, totalPages }, partial: Boolean(error) };
}
