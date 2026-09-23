"use client";

import { useCountry } from "@/components/country-provider";
import Link from "next/link";
import { ArrowIcon } from "@/components/icons";
import { MovieGrid } from "@/components/movie-grid";
import type { Media } from "@/lib/media";

export function CountryDiscovery({ initialRegion, movies, error, partial, year }: { initialRegion: string; movies: Media[]; error: boolean; partial: boolean; year: number }) {
  const { country, refreshing } = useCountry();
  const updating = refreshing || country.code !== initialRegion;
  return <section id="country-availability" className="movie-section shell" aria-labelledby="country-title" aria-busy={updating}>
    <div className="section-heading"><div>
      <p className="eyebrow">02 · Local stories, current favorites</p>
      <h2 id="country-title">Trending in {country.name} {country.flag}</h2>
      <p className="section-description">A focused movie + TV selection led by local entertainment, {year} releases and standout international stories.</p>
      <p className="discovery-note">Ranked for current discovery using origin, release freshness, audience signals and reported watch availability. Not an official country viewing chart.</p>
    </div><Link className="see-all" href="/country/trending" prefetch={false} aria-label={`See all current picks for ${country.name}`}>See all <ArrowIcon /></Link></div>
    {updating ? <p className="section-status" role="status">Updating picks for {country.name}…</p>
      : error ? <p className="section-status" role="status">We couldn’t load watchable titles for {country.name}. Please try again shortly.</p>
      : <>{partial ? <p className="discovery-note" role="status">Some discovery sources are temporarily unavailable; showing the available results.</p> : null}
        {movies.length ? <MovieGrid movies={movies} /> : <p className="section-status">No current titles with reported watch availability were found for {country.name}.</p>}</>}
  </section>;
}
