import { NextRequest, NextResponse } from "next/server";
import { getTitleAvailability, type MediaType } from "@/lib/tmdb";
import { DEFAULT_COUNTRY_CODE, getCountry, isEnabledCountryCode } from "@/lib/countries";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ type: string; id: string }> }) {
  const { type, id } = await params;
  if ((type !== "movie" && type !== "tv") || !/^\d+$/.test(id) || !Number.isSafeInteger(Number(id)) || Number(id) < 1) return NextResponse.json({ error: "Title not found." }, { status: 404 });
  const requestedRegion = request.nextUrl.searchParams.get("region")?.toUpperCase() || DEFAULT_COUNTRY_CODE;
  if (!isEnabledCountryCode(requestedRegion)) return NextResponse.json({ error: "Unsupported country." }, { status: 400 });
  const country = getCountry(requestedRegion);
  const result = await getTitleAvailability(type as MediaType, Number(id), country.tmdbRegion);
  // Independent error flags preserve theatrical data during a provider outage and vice versa.
  return NextResponse.json({ ...result, region: country.code }, {
    status: result.providerError && (type === "tv" || result.theatricalError) ? 503 : 200,
  });
}
