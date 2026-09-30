import "server-only";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { isEnabledCountryCode, resolveAccountCountry } from "./countries";
import { getDiscoveryMetadata } from "./tmdb";
import { getSupabaseServerClient } from "./supabase-server";
import { composeInterestShelf, INTEREST_CACHE_SECONDS, validateInterestRows } from "./title-interest";
import type { Media } from "./media";

const signingKey = () => process.env.TITLE_INTEREST_SECRET?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
export function interestConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && signingKey());
}
function digest(value: string) { return createHmac("sha256", signingKey()!).update(value).digest("hex"); }

export function visitorCookie(now = new Date()) {
  const payload = `${now.toISOString().slice(0, 10)}.${randomUUID()}`;
  return `${payload}.${digest(`cookie:${payload}`)}`;
}
export function validVisitorCookie(cookie: string | undefined, now = new Date()): cookie is string {
  if (!cookie || !/^\d{4}-\d{2}-\d{2}\.[a-f0-9-]{36}\.[a-f0-9]{64}$/.test(cookie)) return false;
  const [day, id, signature] = cookie.split(".");
  if (day !== now.toISOString().slice(0, 10)) return false;
  return timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(digest(`cookie:${day}.${id}`), "hex"));
}
export function viewerHash(cookie: string, userId?: string, now = new Date()) {
  // Different each UTC day; never persist the account ID or raw cookie in analytics.
  return digest(`view:${now.toISOString().slice(0, 10)}:${userId ? `account:${userId}` : `anonymous:${cookie}`}`);
}

export async function resolveViewCountry(cookieCountry: string | undefined, authorization: string | null) {
  if (authorization) {
    if (!authorization.startsWith("Bearer ")) return null;
    const token = authorization.slice(7);
    const client = getSupabaseServerClient(token);
    if (!client) return null;
    try {
      // getUser verifies the access token with Supabase; never trust decoded claims.
      const { data, error } = await client.auth.getUser(token);
      if (error || !data.user) return null;
      const profile = await client.from("profiles").select("country_code").eq("user_id", data.user.id).maybeSingle();
      const country = resolveAccountCountry(profile.data?.country_code, data.user.user_metadata?.country_code);
      return country ? { country, userId: data.user.id } : null;
    } catch { return null; }
  }
  return isEnabledCountryCode(cookieCountry) ? { country: cookieCountry.toUpperCase(), userId: undefined } : null;
}

export async function getCountryInterest(country: string) {
  if (!interestConfigured() || !isEnabledCountryCode(country)) return [];
  try {
    const url = new URL("/rest/v1/rpc/get_country_title_interest", process.env.NEXT_PUBLIC_SUPABASE_URL!);
    url.searchParams.set("p_country", country);
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const response = await fetch(url, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: "force-cache", next: { revalidate: INTEREST_CACHE_SECONDS }, signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return [];
    return validateInterestRows(await response.json(), country);
  } catch { return []; }
}

export async function getHomeInterest(country: string, fallback: Media[]) {
  const rows = await getCountryInterest(country);
  // The same cached metadata helper already used by discovery validates real TMDB titles.
  // Bounded at 15 candidates/type to cover deleted/unavailable title metadata.
  const ranked = (await Promise.all(rows.map(async row => {
    const result = await getDiscoveryMetadata(row.media_type, row.title_id);
    return result.data?.media;
  }))).filter((item): item is Media => Boolean(item));
  return { movie: composeInterestShelf("movie", ranked, fallback), tv: composeInterestShelf("tv", ranked, fallback) };
}
