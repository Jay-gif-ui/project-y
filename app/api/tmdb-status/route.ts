import { NextResponse } from "next/server";
import { getCollection } from "@/lib/tmdb";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await getCollection("movie", "popular");
  if ("data" in result && result.data) {
    return NextResponse.json({ configured: true, reachable: true, results: result.data.length });
  }
  return NextResponse.json(
    {
      configured: result.error !== "not-configured",
      reachable: false,
      reason: result.error,
    },
    { status: result.error === "not-configured" ? 503 : result.error === "unauthorized" ? 502 : 504 },
  );
}
