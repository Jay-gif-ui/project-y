import type { MediaType, Provider, WatchProviders } from "@/lib/media";

export const OFFER_TYPES = [
  { key: "flatrate", label: "Stream" },
  { key: "rent", label: "Rent" },
  { key: "buy", label: "Buy" },
  { key: "free", label: "Free" },
  { key: "ads", label: "Free with ads" },
] as const;

export type OfferType = (typeof OFFER_TYPES)[number]["key"];
export type ProviderOffer = Provider & { types: OfferType[] };

function validDestination(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.username || url.password || !url.hostname.includes(".")) return undefined;
    // Discovery/reference pages must never be presented as a provider's playback CTA.
    if (["themoviedb.org", "tmdb.org", "justwatch.com"].some(host => url.hostname === host || url.hostname.endsWith(`.${host}`))) return undefined;
    return raw;
  } catch { return undefined; }
}

export function providerAction(provider: Provider, type: OfferType): { href: string; label: string } | undefined {
  const href = validDestination(provider.watchUrl);
  if (!href) return undefined;
  return { href, label: `${type === "rent" ? "Rent" : type === "buy" ? "Buy" : "Watch"} on ${provider.name}` };
}

export const PROVIDER_CLICK_EVENT = "ifynex:provider-click";
export function providerClickDetail(input: {
  titleId: number; mediaType: MediaType; country: string; provider: Provider; actionType: OfferType;
}, timestamp = new Date().toISOString()) {
  return {
    titleId: input.titleId, mediaType: input.mediaType, country: input.country,
    providerId: input.provider.id, providerName: input.provider.name,
    actionType: input.actionType, timestamp,
  };
}

export function providerList(raw: unknown): Provider[] {
  if (!Array.isArray(raw)) return [];
  const providers = new Map<number, Provider>();
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const id = item.provider_id;
    const name = typeof item.provider_name === "string" ? item.provider_name.trim() : "";
    if (!Number.isSafeInteger(id) || id < 1 || !name || providers.has(id)) continue;
    providers.set(id, {
      id, name,
      logoPath: typeof item.logo_path === "string" && item.logo_path.startsWith("/") ? item.logo_path : undefined,
      // Only an explicit URL on this provider's offer can become a provider CTA.
      // Current TMDB responses omit it. Never substitute results[country].link.
      watchUrl: validDestination(item.link),
    });
  }
  return [...providers.values()];
}

// TMDB supplies a regional watch page, not provider-specific playback URLs.
// Keep that exact destination; never construct a streaming link from a brand name.
function watchLink(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && ["www.themoviedb.org", "themoviedb.org"].includes(url.hostname)
      && !url.username && !url.password && /\/watch\/?$/.test(url.pathname) ? raw : undefined;
  } catch { return undefined; }
}

export function normalizeWatchProviders(raw: Record<string, unknown>, region: string): WatchProviders | undefined {
  if (!raw.results || typeof raw.results !== "object" || Array.isArray(raw.results)) return undefined;
  const result = (raw.results as Record<string, unknown>)[region.toUpperCase()];
  if (result != null && (typeof result !== "object" || Array.isArray(result))) return undefined;
  const values = (result ?? {}) as Record<string, unknown>;
  return {
    link: watchLink(values.link),
    flatrate: providerList(values.flatrate), rent: providerList(values.rent), buy: providerList(values.buy),
    free: providerList(values.free), ads: providerList(values.ads),
  };
}

// One row per provider, retaining each distinct subscription/rental/purchase offer.
export function getProviderOffers(providers: WatchProviders): ProviderOffer[] {
  const offers = new Map<number, ProviderOffer>();
  for (const { key } of OFFER_TYPES) {
    for (const provider of providers[key]) {
      const offer: ProviderOffer = offers.get(provider.id) ?? { ...provider, types: [] };
      if (!offer.types.includes(key)) offer.types.push(key);
      offers.set(provider.id, offer);
    }
  }
  return [...offers.values()];
}
