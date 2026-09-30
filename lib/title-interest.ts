import type { Media, MediaType } from "./media";

export const INTEREST_CACHE_SECONDS = 300;
export const VIEW_COOKIE = "ifynex_interest";
export type InterestRow = { country_code: string; media_type: MediaType; title_id: number; recent_views: number; score: number };
export type InterestShelf = { items: Media[]; source: "community" | "mixed" | "tmdb"; communityCount: number };

export function parseTitleView(value: unknown): { mediaType: MediaType; titleId: number } | null {
  if (!value || typeof value !== "object") return null;
  const { mediaType, titleId } = value as Record<string, unknown>;
  return (mediaType === "movie" || mediaType === "tv") && typeof titleId === "number" && Number.isSafeInteger(titleId) && titleId > 0
    ? { mediaType, titleId } : null;
}

export function validateInterestRows(value: unknown, country: string): InterestRow[] {
  if (!Array.isArray(value)) return [];
  return value.filter((row): row is InterestRow => row && row.country_code === country
    && (row.media_type === "movie" || row.media_type === "tv") && Number.isSafeInteger(row.title_id) && row.title_id > 0
    && Number.isSafeInteger(row.recent_views) && row.recent_views >= 3 && Number.isFinite(row.score) && row.score > 0)
    .sort((a, b) => b.score - a.score || b.recent_views - a.recent_views || a.title_id - b.title_id);
}

export function composeInterestShelf(type: MediaType, ranked: Media[], fallback: Media[]): InterestShelf {
  const seen = new Set<number>();
  const take = (items: Media[]) => items.filter(item => {
    if (item.mediaType !== type || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
  const community = take(ranked).slice(0, 10).map(item => ({ ...item, discoverySignal: "ifynex-activity" as const }));
  const items = [...community, ...take(fallback)].slice(0, 10);
  return { items, communityCount: community.length, source: community.length === 0 ? "tmdb" : community.length === items.length ? "community" : "mixed" };
}
