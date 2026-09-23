import { cookies } from "next/headers";
import { Footer } from "@/components/footer";
import { Hero } from "@/components/hero";
import { MovieGrid } from "@/components/movie-grid";
import { Navbar } from "@/components/navbar";
import { CountryDiscovery } from "@/components/country-discovery";
import { GenreExplorer } from "@/components/genre-explorer";
import { getCollection, getGenres, getPopularAvailableInRegion } from "@/lib/tmdb";
import { COUNTRY_PREFERENCE_COOKIE, getCountry } from "@/lib/countries";
import { discoveryDates } from "@/lib/discovery";

export default async function Home() {
  // cookies() keeps rendering country-specific; explicit fetch caching remains enabled.
  const country = getCountry((await cookies()).get(COUNTRY_PREFERENCE_COOKIE)?.value);
  const now = new Date();
  const moviePromise = getCollection("movie", "trending");
  const tvPromise = getCollection("tv", "trending");
  const [movies, tv, available, movieGenres, tvGenres] = await Promise.all([
    moviePromise, tvPromise,
    getPopularAvailableInRegion(country.tmdbRegion, { movie: moviePromise, tv: tvPromise }, now),
    getGenres("movie"), getGenres("tv"),
  ]);
  return <><Navbar /><main>
    <Hero spotlight={movies.data?.[0] ?? tv.data?.[0]} />
    <section id="discover" className="movie-section shell" aria-labelledby="global-title">
      <div className="section-heading"><div>
        <p className="eyebrow">01 · Worldwide this week</p>
        <h2 id="global-title">Global trending</h2>
        <p className="section-description">Movies and TV shows trending worldwide this week, in TMDB’s original order.</p>
      </div></div>
      <div id="movies" className="discovery-row">
        <h3>Trending movies</h3>
        {movies.error ? <p className="section-status" role="status">Trending movies are temporarily unavailable. Please try again shortly.</p> : <MovieGrid movies={movies.data ?? []} showRank />}
      </div>
      <div id="tv-shows" className="discovery-row">
        <h3>Trending TV shows</h3>
        {tv.error ? <p className="section-status" role="status">Trending TV shows are temporarily unavailable. Please try again shortly.</p> : <MovieGrid movies={tv.data ?? []} showRank />}
      </div>
    </section>
    <CountryDiscovery initialRegion={country.code} movies={available.data ?? []} error={Boolean(available.error)} partial={available.partial ?? false} year={discoveryDates(now).year} />
    <GenreExplorer genres={{ movie: movieGenres.data ?? [], tv: tvGenres.data ?? [] }} year={discoveryDates(now).year} />
  </main><Footer /></>;
}
