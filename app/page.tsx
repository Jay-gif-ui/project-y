import { Footer } from "@/components/footer";
import { Hero } from "@/components/hero";
import { MovieSection } from "@/components/movie-section";
import { Navbar } from "@/components/navbar";
import { getCollection, getPopularAvailableInRegion } from "@/lib/tmdb";
import { cookies } from "next/headers";
import { COUNTRY_PREFERENCE_COOKIE, getCountry } from "@/lib/countries";

export const dynamic = "force-dynamic";

export default async function Home() {
  const country = getCountry((await cookies()).get(COUNTRY_PREFERENCE_COOKIE)?.value);
  // Independent endpoints run concurrently; each has its own timeout, retry, and safe fallback.
  const [trending,countryAvailability,topRated,popularTV,trendingTV]=await Promise.all([
    getCollection("movie","trending"),
    getPopularAvailableInRegion(country.tmdbRegion),
    getCollection("movie","top_rated"),
    getCollection("tv","popular"),
    getCollection("tv","trending"),
  ]);
  const collections=[trending,countryAvailability,topRated,popularTV,trendingTV]; const error=collections.find(result=>"error" in result); const values=collections.map(result=>"data"in result&&result.data?result.data:[]);
  const message=error?.error === "not-configured" ? "TMDB_API_KEY is not configured. Add it to .env.local and restart the server." : error?.error === "unauthorized" ? "TMDB rejected the server credential. Confirm that TMDB_API_KEY is a valid TMDB v3 API key." : "Project Y cannot reach the movie service from this server. Check firewall, antivirus, proxy, or network egress.";
  return <><Navbar/><main><Hero spotlight={values[0][0]}/>{error?<section className="shell api-notice" role="status"><strong>Live titles are temporarily unavailable.</strong><span>{message}</span></section>:null}<MovieSection id="discover" eyebrow="Global weekly trends" title="Trending now" description="TMDB’s global weekly trend list." movies={values[0]}/><MovieSection id="country-availability" eyebrow={`Legal availability · ${country.flag} ${country.name}`} title={`Popular to watch in ${country.name} ${country.flag}`} description={`A balanced selection of popular local and international titles with legal availability reported by TMDB for ${country.name}.`} movies={values[1]}/><MovieSection id="top-rated" eyebrow="Global audience favorites" title="Top rated movies" movies={values[2]}/><MovieSection id="tv-shows" eyebrow="Global television" title="Popular TV shows" movies={values[3]}/><MovieSection id="trending-tv" eyebrow="Global weekly trends" title="Trending TV shows" movies={values[4]}/></main><Footer/></>;
}
