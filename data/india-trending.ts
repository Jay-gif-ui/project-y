import type { MediaType } from "@/lib/media";

// Editorial order, initially taken from the supplied candidate order.
// Verified against TMDB on 2026-09-25. Labels are editor notes, never UI metadata.
// Update this ONE file roughly every 48 hours; retain real IDs and media types.
// Unreleased, invalid or region-irrelevant entries are skipped at runtime.
export const INDIA_TRENDING: { updatedAt: string; titles: { id: number; type: MediaType; label: string }[] } = {
  updatedAt: "2026-09-25",
  titles: [
    { id: 1408162, type: "movie", label: "Vishwanath & Sons" },
    { id: 1441228, type: "movie", label: "Irumudi" },
    { id: 1685882, type: "movie", label: "Modha Rathri" },
    { id: 1235877, type: "movie", label: "Jana Nayagan" },
    { id: 1451944, type: "movie", label: "Lust Stories 3" },
    { id: 664413, type: "movie", label: "365 Days (365 dni)" },
    { id: 11436, type: "tv", label: "Bigg Boss (Hindi, 2006 series)" },
    { id: 1760576, type: "movie", label: "Zakir Khan: Papa Yaar" },
    { id: 313172, type: "tv", label: "Chumbak (2026 series)" },
    { id: 1169516, type: "movie", label: "Welcome To The Jungle (2026)" },
  ],
};
