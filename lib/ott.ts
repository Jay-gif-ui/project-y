import type { MediaType, Provider, WatchProviders } from "./media";

// IDs and availability come from TMDB's regional catalogue, never this registry.
export const PLATFORM_DEFINITIONS = [
  { slug: "netflix", name: "Netflix", aliases: ["Netflix", "Netflix Standard with Ads"] },
  { slug: "amazon-prime-video", name: "Amazon Prime Video", aliases: ["Amazon Prime Video", "Amazon Prime Video with Ads"] },
  { slug: "disney-plus", name: "Disney+", aliases: ["Disney Plus"] },
  { slug: "jiohotstar", name: "JioHotstar", aliases: ["JioHotstar", "Hotstar"] },
  { slug: "apple-tv-plus", name: "Apple TV+", aliases: ["Apple TV Plus", "Apple TV"] },
  { slug: "hbo-max", name: "HBO Max", aliases: ["HBO Max", "HBO Max Amazon Channel", "Max", "Max Amazon Channel"] },
  { slug: "hulu", name: "Hulu", aliases: ["Hulu"] },
  { slug: "paramount-plus", name: "Paramount+", aliases: ["Paramount Plus", "Paramount+ Amazon Channel", "Paramount Plus Apple TV Channel"] },
  { slug: "peacock", name: "Peacock", aliases: ["Peacock Premium", "Peacock Premium Plus"] },
  { slug: "bbc-iplayer", name: "BBC iPlayer", aliases: ["BBC iPlayer"] },
  { slug: "itvx", name: "ITVX", aliases: ["ITVX"] },
  { slug: "channel-4", name: "Channel 4", aliases: ["Channel 4"] },
  { slug: "sonyliv", name: "Sony LIV", aliases: ["Sony Liv"] },
  { slug: "zee5", name: "ZEE5", aliases: ["Zee5"] },
  { slug: "sun-nxt", name: "Sun NXT", aliases: ["Sun Nxt"] },
  { slug: "mubi", name: "MUBI", aliases: ["MUBI"] },
] as const;
export type OttPlatform = { slug: string; name: string; logoPath?: string; providerIds: Record<MediaType, number[]> };
export const getPlatformDefinition = (slug: string) => PLATFORM_DEFINITIONS.find(platform => platform.slug === slug);
export function regionalPlatforms(movie: Provider[], tv: Provider[]): OttPlatform[] {
  return PLATFORM_DEFINITIONS.flatMap(definition => {
    const matches = (provider: Provider) => definition.aliases.some(alias => alias.toLowerCase() === provider.name.toLowerCase());
    const movies = movie.filter(matches), shows = tv.filter(matches);
    if (!movies.length && !shows.length) return [];
    return [{ slug: definition.slug, name: definition.name, logoPath: [...movies, ...shows].find(provider => provider.logoPath)?.logoPath, providerIds: { movie: [...new Set(movies.map(provider => provider.id))], tv: [...new Set(shows.map(provider => provider.id))] } }];
  });
}
export function hasPlatformSubscription(offers: WatchProviders, ids: number[]) {
  return [...offers.flatrate, ...offers.free, ...offers.ads].some(provider => ids.includes(provider.id));
}
export function platformDiscoveryParams(type: MediaType, region: string, ids: number[], now = new Date()): Record<string, string> {
  return { language: "en-US", watch_region: region, with_watch_providers: ids.join("|"), with_watch_monetization_types: "flatrate|free|ads", sort_by: "popularity.desc", include_adult: "false", page: "1", [type === "movie" ? "primary_release_date.lte" : "first_air_date.lte"]: now.toISOString().slice(0, 10), ...(type === "movie" ? { include_video: "false" } : { include_null_first_air_dates: "false" }) };
}

