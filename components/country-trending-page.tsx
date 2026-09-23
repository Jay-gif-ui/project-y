"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useCountry } from "@/components/country-provider";
import { MovieGrid } from "@/components/movie-grid";
import type { CountryMediaFilter } from "@/lib/discovery";
import type { Media } from "@/lib/media";

export function CountryTrendingPage({ initialRegion, filter, movies, partial, error, year }: { initialRegion: string; filter: CountryMediaFilter; movies: Media[]; partial: boolean; error: boolean; year: number }) {
  const { country, refreshing } = useCountry();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const updating = refreshing || pending || country.code !== initialRegion;
  function selectFilter(value: CountryMediaFilter) {
    startTransition(() => router.replace(value === "all" ? "/country/trending" : `/country/trending?type=${value}`, { scroll: false }));
  }
  return <main className="shell search-page country-trending-page" aria-labelledby="country-page-title" aria-busy={updating}>
    <Link className="back-link" href="/">← Back to discovery</Link>
    <p className="eyebrow">Local entertainment · Current discovery</p>
    <h1 id="country-page-title">Trending in {country.name} {country.flag}</h1>
    <p className="section-description">Explore more from {country.name}: local movies and series lead, with selected international favorites. Focused on {year} and the second half of {year - 1}.</p>
    <p className="discovery-note">A country-focused selection based on origin, freshness, audience signals and reported watch availability—not exact viewing statistics. A few older favorites may appear when they have strong current relevance.</p>
    <div className="media-toggle country-media-toggle" role="group" aria-label="Country discovery media type">
      {(["all", "movie", "tv"] as const).map(value => <button key={value} type="button" aria-pressed={filter === value} onClick={() => selectFilter(value)} disabled={pending}>{value === "all" ? "All" : value === "movie" ? "Movies" : "TV Shows"}</button>)}
    </div>
    {updating ? <p className="section-status" role="status">Updating current picks for {country.name}…</p>
      : error ? <p className="section-status" role="status">We couldn’t load this selection. <button className="text-button" onClick={() => startTransition(() => router.refresh())}>Try again</button></p>
      : <>{partial ? <p className="discovery-note" role="status">Some discovery sources are temporarily unavailable; showing verified available results.</p> : null}
        {movies.length ? <MovieGrid movies={movies} /> : <p className="section-status" role="status">No titles meet the current discovery criteria for this country and media type. Try another filter.</p>}
      </>}
  </main>;
}
