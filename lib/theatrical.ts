import { regionalMovieEvents } from "@/lib/release-metadata";
import { releaseDates } from "@/lib/releases";

export type TheatricalRelease = { date: string; status: "released" | "upcoming" };

// Only selected-country type 2/3 records establish theatrical release.
// A release date does not establish ongoing cinema screenings or showtimes.
export function theatricalRelease(raw: Record<string, unknown>, region: string, now = new Date()): TheatricalRelease | null {
  const { today } = releaseDates(now);
  const dates = [...new Set(regionalMovieEvents(raw, region.toUpperCase())
    .filter(event => event.kind === "theatrical").map(event => event.date))].sort();
  const released = dates.filter(date => date <= today).at(-1);
  const date = released ?? dates[0];
  return date ? { date, status: date <= today ? "released" : "upcoming" } : null;
}
