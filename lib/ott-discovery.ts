import "server-only";
import { isEnabledCountryCode } from "@/lib/countries";
import { getCollection, getRegionalPlatforms, getReleaseSource, getWatchProviders, type TmdbResult } from "@/lib/tmdb";
import { hasPlatformSubscription, platformDiscoveryParams, type OttPlatform } from "@/lib/ott";
import type { Media, MediaType } from "@/lib/media";

export type PlatformDiscovery = { platform: OttPlatform | null; trendingMovies: Media[]; trendingShows: Media[]; popular: Media[] };
export async function getPlatformDiscovery(slug: string, region: string, now = new Date()): Promise<TmdbResult<PlatformDiscovery>> {
  region = region.toUpperCase();
  if (!isEnabledCountryCode(region)) return { error: "not-found" };
  const platforms = await getRegionalPlatforms(region);
  if (!platforms.data) return { error: platforms.error };
  const platform = platforms.data.find(item => item.slug === slug);
  if (!platform) return platforms.partial ? { error: "upstream" } : { data: { platform: null, trendingMovies: [], trendingShows: [], popular: [] } };
  const today = now.toISOString().slice(0, 10);
  const results = await Promise.all((["movie", "tv"] as MediaType[]).map(async type => {
    const ids = platform.providerIds[type];
    if (!ids.length) return { trending: [], popular: [], error: false };
    const [popular, trending] = await Promise.all([
      getReleaseSource(type, platformDiscoveryParams(type, region, ids, now)), getCollection(type, "trending"),
    ]);
    const released = (media: Media) => Number.isSafeInteger(media.id) && media.id > 0 && Boolean(media.releaseDate && media.releaseDate <= today);
    // Weekly trends intersected with actual regional subscription/free/ad offers.
    const candidates = (trending.data ?? []).filter(released).slice(0, 20);
    const verified = await Promise.all(candidates.map(async media => {
      const offers = await getWatchProviders(type, media.id, region);
      return { media, available: Boolean(offers.data && hasPlatformSubscription(offers.data, ids)), error: Boolean(offers.error) };
    }));
    return { trending: verified.filter(item => item.available).map(item => item.media), popular: (popular.data ?? []).filter(released), error: Boolean(popular.error || trending.error || verified.some(item => item.error)) };
  }));
  const error = platforms.partial || results.some(result => result.error);
  const popular = results.flatMap(result => result.popular).sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0));
  if (error && !popular.length && results.every(result => !result.trending.length)) return { error: "upstream" };
  return { data: { platform, trendingMovies: results[0].trending, trendingShows: results[1].trending, popular }, partial: Boolean(error) };
}

