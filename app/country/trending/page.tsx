import { cookies } from "next/headers";
import { Footer } from "@/components/footer";
import { Navbar } from "@/components/navbar";
import { CountryTrendingPage } from "@/components/country-trending-page";
import { COUNTRY_PREFERENCE_COOKIE, getCountry } from "@/lib/countries";
import { getCountryDiscovery } from "@/lib/tmdb";
import { discoveryDates } from "@/lib/discovery";

export const metadata = { title: "Country discovery | Project Y", description: "Current movies and TV shows, led by local stories for your selected country." };

export default async function CountryTrending({ searchParams }: { searchParams: Promise<{ type?: string | string[] }> }) {
  const country = getCountry((await cookies()).get(COUNTRY_PREFERENCE_COOKIE)?.value);
  const { type } = await searchParams;
  const filter = type === "movie" || type === "tv" ? type : "all";
  const now = new Date();
  const result = await getCountryDiscovery(country.tmdbRegion, { surface: "browse", filter }, undefined, now);
  return <><Navbar /><CountryTrendingPage initialRegion={country.code} filter={filter} movies={result.data?.items ?? []} partial={result.partial ?? false} error={Boolean(result.error)} year={discoveryDates(now).year} /><Footer /></>;
}
