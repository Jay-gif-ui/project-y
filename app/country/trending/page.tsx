import { cookies } from "next/headers";
import { Footer } from "@/components/footer";
import { Navbar } from "@/components/navbar";
import { CountryTrendingPage } from "@/components/country-trending-page";
import { COUNTRY_PREFERENCE_COOKIE, getCountry } from "@/lib/countries";
import { getCountryDiscovery } from "@/lib/tmdb";
import { discoveryDates } from "@/lib/discovery";

export const metadata = { title: "Trending in your country | iFynex", description: "Current movie and TV trends, recent audience interest and watch options for your selected country." };

export default async function CountryTrending({ searchParams }: { searchParams: Promise<{ type?: string | string[]; sort?: string | string[]; period?: string | string[]; page?: string | string[]; origin?: string | string[] }> }) {
  const country = getCountry((await cookies()).get(COUNTRY_PREFERENCE_COOKIE)?.value);
  const { type, sort: requestedSort, period: requestedPeriod, page: requestedPage, origin: requestedOrigin } = await searchParams;
  const filter = type === "movie" || type === "tv" ? type : "all";
  const sort = requestedSort === "newest" ? "newest" : "current";
  const period = requestedPeriod === "year" ? "year" : "current";
  const page = typeof requestedPage === "string" && /^\d+$/.test(requestedPage) ? Number(requestedPage) : 1;
  const origin = requestedOrigin === "local" ? "local" : "all";
  const now = new Date();
  const result = await getCountryDiscovery(country.tmdbRegion, { surface: "browse", filter, sort, period, page, origin }, undefined, now);
  return <><Navbar /><CountryTrendingPage initialRegion={country.code} filter={filter} origin={origin} sort={sort} period={period} page={result.data?.page ?? 1} total={result.data?.total ?? 0} totalPages={result.data?.totalPages ?? 1} movies={result.data?.items ?? []} partial={result.partial ?? false} error={Boolean(result.error)} year={discoveryDates(now).year} /><Footer /></>;
}
