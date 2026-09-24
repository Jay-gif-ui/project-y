"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useCountry } from "@/components/country-provider";
import { MovieGrid } from "@/components/movie-grid";
import type { CountryMediaFilter, CountryPeriod, CountrySort } from "@/lib/country-trending";
import type { Media } from "@/lib/media";

export function CountryTrendingPage({ initialRegion, filter, sort, period, page, totalPages, total, movies, partial, error, year }: { initialRegion: string; filter: CountryMediaFilter; sort: CountrySort; period: CountryPeriod; page: number; totalPages: number; total: number; movies: Media[]; partial: boolean; error: boolean; year: number }) {
  const { country, refreshing } = useCountry();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const updating = refreshing || pending || country.code !== initialRegion;
  function navigate(next: { filter?: CountryMediaFilter; sort?: CountrySort; period?: CountryPeriod; page?: number }) {
    const params = new URLSearchParams();
    const nextFilter = next.filter ?? filter, nextSort = next.sort ?? sort, nextPeriod = next.period ?? period;
    if (nextFilter !== "all") params.set("type", nextFilter);
    if (nextSort !== "current") params.set("sort", nextSort);
    if (nextPeriod !== "current") params.set("period", nextPeriod);
    if (next.page && next.page > 1) params.set("page", String(next.page));
    startTransition(() => router.replace(`/country/trending${params.size ? `?${params}` : ""}`, { scroll: false }));
  }
  return <main className="shell search-page country-trending-page" aria-labelledby="country-page-title" aria-busy={updating}>
    <Link className="back-link" href="/">← Back to discovery</Link>
    <p className="eyebrow">Local entertainment · Current discovery</p>
    <h1 id="country-page-title">Trending in {country.name} {country.flag}</h1>
    <p className="section-description">Current interest in local stories and selected international titles. Recent {year} releases lead; {year - 1} releases and returning series need ongoing relevance.</p>
    <p className="discovery-note">A country-focused estimate using weekly trends, release and airing activity, audience interest and reported watch availability. TMDB does not provide country viewing charts.</p>
    <div className="genre-controls country-trending-controls">
      <div className="media-toggle" role="group" aria-label="Country discovery media type">
        {(["all", "movie", "tv"] as const).map(value => <button key={value} type="button" aria-pressed={filter === value} onClick={() => navigate({ filter: value })} disabled={updating}>{value === "all" ? "All" : value === "movie" ? "Movies" : "TV Shows"}</button>)}
      </div>
      <label className="discovery-filter">Sort <select aria-label="Sort current trending" value={sort} disabled={updating} onChange={event => navigate({ sort: event.target.value as CountrySort })}><option value="current">Current relevance</option><option value="newest">Newest releases</option></select></label>
      <label className="discovery-filter">Releases <select aria-label="Trending release window" value={period} disabled={updating} onChange={event => navigate({ period: event.target.value as CountryPeriod })}><option value="current">All current picks</option><option value="year">{year} releases</option></select></label>
    </div>
    {updating ? <p className="section-status" role="status">Updating current picks for {country.name}…</p>
      : error ? <p className="section-status" role="status">We couldn’t load this selection. <button className="text-button" onClick={() => startTransition(() => router.refresh())}>Try again</button></p>
      : <>{partial ? <p className="discovery-note" role="status">Some discovery sources are temporarily unavailable; showing the available results.</p> : null}
        {total > 0 ? <p className="discovery-note" role="status">{total} current picks · Page {page} of {totalPages}</p> : null}
        {movies.length ? <MovieGrid movies={movies} /> : <p className="section-status" role="status">No titles meet the current discovery criteria for this country and media type. Try another filter.</p>}
        {totalPages > 1 ? <nav className="trending-pagination" aria-label="Current trending pages"><button type="button" className="text-button" disabled={page <= 1 || updating} onClick={() => navigate({ page: page - 1 })}>← Previous</button><span>Page {page} of {totalPages}</span><button type="button" className="text-button" disabled={page >= totalPages || updating} onClick={() => navigate({ page: page + 1 })}>Next →</button></nav> : null}
      </>}
  </main>;
}
