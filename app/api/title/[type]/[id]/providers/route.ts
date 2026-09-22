import { NextRequest, NextResponse } from "next/server";
import { getWatchProviders, type MediaType } from "@/lib/tmdb";
import { DEFAULT_COUNTRY_CODE, getCountry, isEnabledCountryCode } from "@/lib/countries";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ type: string; id: string }> }) {
  const { type, id } = await params;
  if ((type !== "movie" && type !== "tv") || !/^\d+$/.test(id)) return NextResponse.json({ error: "Title not found." }, { status: 404 });
  const requestedRegion = request.nextUrl.searchParams.get("region")?.toUpperCase() || DEFAULT_COUNTRY_CODE;
  if (!isEnabledCountryCode(requestedRegion)) return NextResponse.json({ error: "Unsupported country." }, { status: 400 });
  const country = getCountry(requestedRegion);
  const result = await getWatchProviders(type as MediaType, Number(id), country.tmdbRegion);
  if ("data" in result && result.data) return NextResponse.json({ providers: result.data, region: country.code });
  const status = result.error === "not-configured" ? 503 : result.error === "not-found" ? 404 : result.error === "unauthorized" ? 502 : 503;
  return NextResponse.json({ error: "Watch-provider information is temporarily unavailable." }, { status });
}
