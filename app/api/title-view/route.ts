import { NextRequest, NextResponse } from "next/server";
import { COUNTRY_PREFERENCE_COOKIE } from "@/lib/countries";
import { parseTitleView, VIEW_COOKIE } from "@/lib/title-interest";
import { interestConfigured, resolveViewCountry, validVisitorCookie, viewerHash, visitorCookie } from "@/lib/title-interest-server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { getDiscoveryMetadata } from "@/lib/tmdb";

export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store", Vary: "Cookie, Authorization" };
const reply = (status: number, reason: string) => NextResponse.json({ recorded: reason === "recorded", reason }, { status, headers });

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin || request.headers.get("sec-fetch-site") === "cross-site") return reply(403, "origin");
  if (request.headers.get("dnt") === "1" || request.headers.get("sec-gpc") === "1") return reply(202, "privacy-preference");
  if (!request.headers.get("content-type")?.startsWith("application/json")) return reply(415, "content-type");
  // Read a bounded stream, even when the caller omits Content-Length.
  const reader = request.body?.getReader();
  if (!reader) return reply(400, "invalid-title");
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 512) { await reader.cancel(); return reply(413, "payload-too-large"); }
      chunks.push(value);
    }
  } catch { return reply(400, "invalid-title"); }
  let view;
  try { view = parseTitleView(JSON.parse(Buffer.concat(chunks).toString("utf8"))); }
  catch { return reply(400, "invalid-title"); }
  if (!view) return reply(400, "invalid-title");
  if (!interestConfigured()) return reply(503, "unavailable");

  const identity = await resolveViewCountry(request.cookies.get(COUNTRY_PREFERENCE_COOKIE)?.value, request.headers.get("authorization"));
  if (!identity) return reply(401, "country-unresolved");
  let visitor = request.cookies.get(VIEW_COOKIE)?.value;
  if (!validVisitorCookie(visitor)) {
    visitor = visitorCookie();
    const response = reply(202, "initialized");
    response.cookies.set(VIEW_COOKIE, visitor, { httpOnly: true, secure: request.nextUrl.protocol === "https:", sameSite: "strict", path: "/api/title-view", maxAge: 86400 });
    return response;
  }
  const metadata = await getDiscoveryMetadata(view.mediaType, view.titleId);
  if (!metadata.data) return reply(metadata.error === "not-found" ? 404 : 503, "title-unavailable");
  try {
    const client = getSupabaseServerClient()!;
    const { data, error } = await client.rpc("record_title_view", {
      p_country: identity.country, p_media_type: view.mediaType, p_title_id: view.titleId,
      p_viewer_hash: viewerHash(visitor, identity.userId),
    });
    if (error) return reply(503, "unavailable");
    if (data === "rate-limited") return reply(429, data);
    if (data !== "recorded" && data !== "duplicate") return reply(503, "unavailable");
    return reply(200, data);
  } catch { return reply(503, "unavailable"); }
}
