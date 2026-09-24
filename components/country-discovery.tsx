"use client";

import { useCountry } from "@/components/country-provider";
import Link from "next/link";
import { ArrowIcon } from "@/components/icons";
import { MovieGrid } from "@/components/movie-grid";
import type { Media } from "@/lib/media";

export function CountryDiscovery({ initialRegion, movies, latest, error, partial }: { initialRegion: string; movies: Media[]; latest: Media[]; error: boolean; partial: boolean }) {
  const { country, refreshing } = useCountry();
  const updating = refreshing || country.code !== initialRegion;
  return <><section id="country-availability" className="movie-section shell country-home-section" aria-labelledby="country-title" aria-busy={updating}>
    <div className="section-heading"><div>
      <p className="eyebrow">01 · What’s getting attention</p>
      <h2 id="country-title">Trending in {country.name} {country.flag}</h2>
      <p className="section-description">Today’s trends, breakout releases and returning series you can watch in {country.name}.</p>
      <details className="discovery-method"><summary>How these picks work</summary><p>Daily and weekly TMDB trends lead, alongside recent releases with audience interest and active series. Country origin adds a small preference; reported local watch availability is required. This is an estimate, not a chart of viewers in {country.name}.</p></details>
      <Link className="country-origin-link" href="/country/trending?origin=local" prefetch={false}>Explore current titles from {country.name} →</Link>
    </div><Link className="see-all" href="/country/trending" prefetch={false} aria-label={`See all current picks for ${country.name}`}>See all <ArrowIcon /></Link></div>
    {updating ? <p className="section-status" role="status">Updating picks for {country.name}…</p>
      : error ? <p className="section-status" role="status">We couldn’t load watchable titles for {country.name}. Please try again shortly.</p>
      : <>{partial ? <p className="discovery-note" role="status">Some discovery sources are temporarily unavailable; showing the available results.</p> : null}
        {movies.length ? <MovieGrid movies={movies} showRank /> : <p className="section-status">No current titles with reported watch availability were found for {country.name}.</p>}</>}
  </section>
  <section id="latest-releases" className="movie-section shell" aria-labelledby="latest-title" aria-busy={updating}>
    <div className="section-heading"><div><p className="eyebrow">02 · Fresh to discover</p>
      <h2 id="latest-title">Latest releases in {country.name}</h2>
      <p className="section-description">Movies and series that premiered in the last 60 days, with watch options in your country.</p>
      <p className="discovery-note">Ordered by release date. A recent release does not necessarily mean a new addition to a streaming service.</p>
    </div><Link className="see-all" href="/country/releases" prefetch={false}>See all <ArrowIcon /></Link></div>
    {updating ? <p className="section-status" role="status">Updating releases for {country.name}…</p> : error ? <p className="section-status">Latest releases are temporarily unavailable.</p> : latest.length ? <MovieGrid movies={latest} /> : <p className="section-status">No recent releases with reported watch availability were found.</p>}
  </section></>;
}
