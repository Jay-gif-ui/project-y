import { cookies } from "next/headers";
import Link from "next/link";
import { ArrowIcon } from "@/components/icons";
import { Footer } from "@/components/footer";
import { Hero } from "@/components/hero";
import { MovieGrid } from "@/components/movie-grid";
import { Navbar } from "@/components/navbar";
import { CountryDiscovery } from "@/components/country-discovery";
import { GenreExplorer } from "@/components/genre-explorer";
import { getCollection, getGenres, getCountryDiscovery } from "@/lib/tmdb";
import { DISCOVERY_CONFIG } from "@/data/discovery-config";
import { COUNTRY_PREFERENCE_COOKIE, getCountry } from "@/lib/countries";
import { getCountryReleases } from "@/lib/tmdb-releases";
import { discoveryDates } from "@/lib/discovery";

export default async function Home() {
  // cookies() keeps rendering country-specific; explicit fetch caching remains enabled.
  const country = getCountry((await cookies()).get(COUNTRY_PREFERENCE_COOKIE)?.value);
  const now = new Date();
  const moviePromise = getCollection("movie", "trending");
  const tvPromise = getCollection("tv", "trending");
  const [movies, tv, available, releases, movieGenres, tvGenres] = await Promise.all([
    moviePromise, tvPromise,
    getCountryDiscovery(country.tmdbRegion, { surface: "home" }, { movie: moviePromise, tv: tvPromise }, now),
    getCountryReleases(country.tmdbRegion, {}, now),
    getGenres("movie"), getGenres("tv"),
  ]);
  return <><Navbar /><main>
    <Hero />
    <CountryDiscovery initialRegion={country.code} movies={available.data?.items ?? []} latest={releases.data?.items ?? []} releaseError={Boolean(releases.error)} releasePartial={releases.partial ?? false} localCount={available.data?.localIds.length ?? 0} error={Boolean(available.error)} partial={available.partial ?? false} />
    <section id="discover" className="movie-section shell" aria-labelledby="global-title">
      <div className="section-heading"><div>
        <p className="eyebrow">03 · Worldwide this week</p>
        <h2 id="global-title">Global Trending 🌎</h2>
        <p className="section-description">Movies and TV shows trending worldwide this week, in TMDB’s original order.</p>
      </div><Link className="see-all" href="/trending/global" prefetch={false} aria-label="See all global trending titles">See All <ArrowIcon /></Link></div>
      <div id="movies" className="discovery-row">
        <h3>Trending movies</h3>
        {movies.error ? <p className="section-status" role="status">Trending movies are temporarily unavailable. Please try again shortly.</p> : <MovieGrid movies={movies.data?.slice(0, Math.ceil(DISCOVERY_CONFIG.globalHomeLimit / 2)) ?? []} showRank />}
      </div>
      <div id="tv-shows" className="discovery-row">
        <h3>Trending TV shows</h3>
        {tv.error ? <p className="section-status" role="status">Trending TV shows are temporarily unavailable. Please try again shortly.</p> : <MovieGrid movies={tv.data?.slice(0, Math.floor(DISCOVERY_CONFIG.globalHomeLimit / 2)) ?? []} showRank />}
      </div>
    </section>
    <GenreExplorer genres={{ movie: movieGenres.data ?? [], tv: tvGenres.data ?? [] }} year={discoveryDates(now).year} />
  </main><Footer /></>;
}
