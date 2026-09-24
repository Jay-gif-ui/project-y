import { cookies } from "next/headers";
import { Footer } from "@/components/footer";
import { Navbar } from "@/components/navbar";
import { CountryTrendingPage } from "@/components/country-trending-page";
import { COUNTRY_PREFERENCE_COOKIE, getCountry } from "@/lib/countries";
import { getCountryDiscovery } from "@/lib/tmdb";

export const metadata = { title: "Latest releases in your country | iFynex", description: "Recent movie releases and series premieres with watch options in your country." };

export default async function CountryReleases({ searchParams }: { searchParams: Promise<{ type?: string | string[]; period?: string | string[]; page?: string | string[]; origin?: string | string[] }> }) {
  const country = getCountry((await cookies()).get(COUNTRY_PREFERENCE_COOKIE)?.value);
  const { type, period: requestedPeriod, page: requestedPage, origin: requestedOrigin } = await searchParams;
  const filter = type === "movie" || type === "tv" ? type : "all";
  const period = requestedPeriod === "year" ? "year" : "current";
  const page = typeof requestedPage === "string" && /^\d+$/.test(requestedPage) ? Number(requestedPage) : 1;
  const origin = requestedOrigin === "local" ? "local" : "all";
  const now = new Date();
  const result = await getCountryDiscovery(country.tmdbRegion, { surface: "browse", view: "releases", filter, period, page, origin }, undefined, now);
  return <><Navbar /><CountryTrendingPage view="releases" initialRegion={country.code} filter={filter} origin={origin} sort="newest" period={period} page={result.data?.page ?? 1} total={result.data?.total ?? 0} localTotal={result.data?.localTotal ?? 0} internationalTotal={result.data?.internationalTotal ?? 0} totalPages={result.data?.totalPages ?? 1} movies={result.data?.items ?? []} partial={result.partial ?? false} error={Boolean(result.error)} year={now.getUTCFullYear()} /><Footer /></>;
}
