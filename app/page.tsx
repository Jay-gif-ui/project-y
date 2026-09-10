import { Footer } from "@/components/footer";
import { Hero } from "@/components/hero";
import { MovieSection } from "@/components/movie-section";
import { Navbar } from "@/components/navbar";
import { getCollection } from "@/lib/tmdb";

export const dynamic = "force-dynamic";

export default async function Home() {
  // Independent endpoints run concurrently; each has its own timeout, retry, and safe fallback.
  const [trending,popularMovies,topRated,popularTV,trendingTV]=await Promise.all([
    getCollection("movie","trending"),
    getCollection("movie","popular"),
    getCollection("movie","top_rated"),
    getCollection("tv","popular"),
    getCollection("tv","trending"),
  ]);
  const collections=[trending,popularMovies,topRated,popularTV,trendingTV]; const error=collections.find(result=>"error" in result); const values=collections.map(result=>"data"in result&&result.data?result.data:[]);
  const message=error?.error === "not-configured" ? "TMDB_API_KEY is not configured. Add it to .env.local and restart the server." : error?.error === "unauthorized" ? "TMDB rejected the server credential. Confirm that TMDB_API_KEY is a valid TMDB v3 API key." : "Project Y cannot reach the movie service from this server. Check firewall, antivirus, proxy, or network egress.";
  return <><Navbar/><main><Hero spotlight={values[0][0]}/>{error?<section className="shell api-notice" role="status"><strong>Live titles are temporarily unavailable.</strong><span>{message}</span></section>:null}<MovieSection id="discover" eyebrow="Start here" title="Trending now" description="The titles currently moving through conversations." movies={values[0]}/><MovieSection id="movies" eyebrow="Fresh on the scene" title="Popular movies" movies={values[1]}/><MovieSection id="top-rated" eyebrow="Critics and audiences" title="Top rated movies" movies={values[2]}/><MovieSection id="tv-shows" eyebrow="On television" title="Popular TV shows" movies={values[3]}/><MovieSection id="trending-tv" eyebrow="Binge-worthy now" title="Trending TV shows" movies={values[4]}/></main><Footer/></>;
}
