import { NextRequest, NextResponse } from "next/server";
import { getWatchProviders, type MediaType } from "@/lib/tmdb";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ type: string; id: string }> }) {
  const { type, id } = await params;
  if ((type !== "movie" && type !== "tv") || !/^\d+$/.test(id)) return NextResponse.json({ error: "Title not found." }, { status: 404 });
  const region = request.nextUrl.searchParams.get("region")?.toUpperCase() || "US";
  const result = await getWatchProviders(type as MediaType, Number(id), region);
  if ("data" in result && result.data) return NextResponse.json({ providers: result.data, region });
  const status = result.error === "not-configured" ? 503 : result.error === "not-found" ? 404 : result.error === "unauthorized" ? 502 : 503;
  return NextResponse.json({ error: "Watch-provider information is temporarily unavailable." }, { status });
}
