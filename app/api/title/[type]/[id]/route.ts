import { NextResponse } from "next/server";
import { getTitleDetails, type MediaType } from "@/lib/tmdb";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ type: string; id: string }> }) {
  const { type, id } = await params;
  if ((type !== "movie" && type !== "tv") || !/^\d+$/.test(id)) return NextResponse.json({ error: "Title not found." }, { status: 404 });
  const result = await getTitleDetails(type as MediaType, Number(id));
  if (!("data" in result) || !result.data) return NextResponse.json({ error: "Title details are temporarily unavailable." }, { status: result.error === "not-found" ? 404 : 503 });
  const title = result.data;
  return NextResponse.json({ title: { id: title.id, mediaType: title.mediaType, title: title.title, overview: title.overview, posterPath: title.posterPath, backdropPath: title.backdropPath, releaseDate: title.releaseDate, rating: title.rating, voteCount: title.voteCount, genreIds: title.genreIds } });
}
