import type { Provider } from "@/lib/media";

// Official destinations verified 2026-09-27; sources in docs/availability-verification.md.
// Match exact TMDB names, never substrings (e.g. an Amazon Channel is a different offer).
// This only chooses a destination AFTER TMDB has reported the regional provider.
const OFFICIAL_PROVIDER_HOME: Readonly<Record<string, string>> = {
  netflix: "https://www.netflix.com/",
  "netflix standard with ads": "https://www.netflix.com/",
  "amazon prime video": "https://www.primevideo.com/",
  "amazon prime video with ads": "https://www.primevideo.com/",
  "prime video": "https://www.primevideo.com/",
  "amazon video": "https://www.primevideo.com/",
  "apple tv": "https://tv.apple.com/",
  "apple tv+": "https://tv.apple.com/",
  "apple tv store": "https://tv.apple.com/",
  jiohotstar: "https://www.hotstar.com/",
  zee5: "https://www.zee5.com/",
  sonyliv: "https://www.sonyliv.com/",
  "sony liv": "https://www.sonyliv.com/",
  "disney plus": "https://www.disneyplus.com/",
  youtube: "https://www.youtube.com/feed/storefront",
  "google play movies": "https://play.google.com/store/movies?hl=en",
  "fandango at home": "https://athome.fandango.com/content/movies/",
  "hbo max": "https://www.hbomax.com/",
  "hbo max amazon channel": "https://www.primevideo.com/",
  "rakuten tv": "https://www.rakuten.tv/",
  "sky store": "https://www.skystore.com/",
};

export function officialProviderHomepage(provider: Provider): string | undefined {
  const name = provider.name.trim().toLowerCase();
  return Object.hasOwn(OFFICIAL_PROVIDER_HOME, name) ? OFFICIAL_PROVIDER_HOME[name] : undefined;
}
