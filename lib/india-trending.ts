import { DISCOVERY_CONFIG } from "@/data/discovery-config";
import { mediaKey, type CountrySort } from "@/lib/country-trending";
import type { Media } from "@/lib/media";
import { validReleaseDate } from "@/lib/releases";

// Inputs have already had regional relevance verified by the server adapter.
// Manual interest is independent of ratings, premiere age and global feed rank.
export function mergeIndiaTrending(manual: Media[], global: Media[], now = new Date(), sort: CountrySort = "current") {
  const today = now.toISOString().slice(0, 10), unique = new Map<string, Media>();
  for (const media of [...manual.slice(0, DISCOVERY_CONFIG.indiaManualLimit).map(item => ({ ...item, discoverySignal: "india-curated" as const })), ...global]) {
    if (!Number.isSafeInteger(media.id) || media.id < 1 || !validReleaseDate(media.releaseDate) || media.releaseDate > today || unique.has(mediaKey(media))) continue;
    unique.set(mediaKey(media), media);
  }
  const items = [...unique.values()];
  return sort === "newest" ? items.sort((a, b) => b.releaseDate!.localeCompare(a.releaseDate!) || mediaKey(a).localeCompare(mediaKey(b))) : items;
}
