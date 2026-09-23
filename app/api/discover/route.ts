import { NextRequest, NextResponse } from "next/server";
import { COUNTRY_PREFERENCE_COOKIE, getCountry } from "@/lib/countries";
import { discoverGenre } from "@/lib/tmdb";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const type = params.get("type");
  const genre = params.get("genre") ?? "";
  const period = params.get("period") ?? "recent";
  const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
  if ((type !== "movie" && type !== "tv") || !/^\d{1,6}$/.test(genre) || Number(genre) < 1 || (period !== "recent" && period !== "year")) {
    return NextResponse.json({ error: "Choose a valid media type, genre and release window." }, { status: 400, headers });
  }
  const country = getCountry(request.cookies.get(COUNTRY_PREFERENCE_COOKIE)?.value);
  const result = await discoverGenre(type, country.tmdbRegion, Number(genre), period);
  if (!result.data) return NextResponse.json({ error: "Discovery is temporarily unavailable." }, { status: result.error === "not-found" ? 400 : 503, headers });
  return NextResponse.json({ results: result.data, region: country.code, partial: result.partial ?? false }, { headers });
}
