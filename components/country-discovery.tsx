"use client";

import { useCountry } from "@/components/country-provider";
import { MovieGrid } from "@/components/movie-grid";
import type { Media } from "@/lib/media";

export function CountryDiscovery({ initialRegion, movies, error, partial, year }: { initialRegion: string; movies: Media[]; error: boolean; partial: boolean; year: number }) {
  const { country, refreshing } = useCountry();
  const updating = refreshing || country.code !== initialRegion;
  return <section id="country-availability" className="movie-section shell" aria-labelledby="country-title" aria-busy={updating}>
    <div className="section-heading"><div>
      <p className="eyebrow">02 · {country.flag} Available in your country</p>
      <h2 id="country-title">Popular to watch in {country.name}</h2>
      <p className="section-description">Local and international movies + TV, focused on {year - 1}–{year} releases, with a few returning favorites.</p>
      <p className="discovery-note">Selected using release freshness and worldwide TMDB popularity, with watch availability reported for {country.name}. This is a discovery selection, not a country viewing chart.</p>
    </div></div>
    {updating ? <p className="section-status" role="status">Updating picks for {country.name}…</p>
      : error ? <p className="section-status" role="status">We couldn’t load watchable titles for {country.name}. Please try again shortly.</p>
      : <>{partial ? <p className="discovery-note" role="status">Some discovery sources are temporarily unavailable; showing the available results.</p> : null}
        {movies.length ? <MovieGrid movies={movies} /> : <p className="section-status">No current titles with reported watch availability were found for {country.name}.</p>}</>}
  </section>;
}
