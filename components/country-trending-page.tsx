"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useCountry } from "@/components/country-provider";
import { MovieGrid } from "@/components/movie-grid";
import type { CountryMediaFilter, CountryPeriod, CountrySort, CountryView } from "@/lib/country-trending";
import { DISCOVERY_CONFIG } from "@/data/discovery-config";
import type { ReleaseFilter } from "@/lib/releases";
import type { Media } from "@/lib/media";

export function CountryTrendingPage({ initialRegion, filter, sort, period, page, totalPages, total, localTotal, internationalTotal, movies, partial, error, year, view = "trending", origin = "all", releaseStatus = "all" }: { initialRegion: string; filter: CountryMediaFilter; sort: CountrySort; period: CountryPeriod; page: number; totalPages: number; total: number; localTotal: number; internationalTotal: number; movies: Media[]; partial: boolean; error: boolean; year: number; view?: CountryView; releaseStatus?: ReleaseFilter; origin?: "all" | "local" }) {
  const { country, refreshing } = useCountry();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const updating = refreshing || pending || country.code !== initialRegion;
  const releases = view === "releases";
  function navigate(next: { releaseStatus?: ReleaseFilter; filter?: CountryMediaFilter; sort?: CountrySort; period?: CountryPeriod; page?: number; origin?: "all" | "local" }) {
    const params = new URLSearchParams();
    const nextFilter = next.filter ?? filter, nextSort = next.sort ?? sort, nextPeriod = next.period ?? period;
    if (releases && (next.releaseStatus ?? releaseStatus) !== "all") params.set("status", next.releaseStatus ?? releaseStatus);
    if (nextFilter !== "all") params.set("type", nextFilter);
    if (!releases && nextSort !== "current") params.set("sort", nextSort);
    if (nextPeriod !== "current") params.set("period", nextPeriod);
    if ((next.origin ?? origin) === "local") params.set("origin", "local");
    if (next.page && next.page > 1) params.set("page", String(next.page));
    startTransition(() => router.replace(`/country/${view}${params.size ? `?${params}` : ""}`, { scroll: false }));
  }
  return <main className="shell search-page country-trending-page" aria-labelledby="country-page-title" aria-busy={updating}>
    <Link className="back-link" href="/">← Back to discovery</Link>
    <p className="eyebrow">{releases ? "Fresh to discover" : "What’s getting attention"}</p>
    <h1 id="country-page-title">{releases ? "Latest releases" : "Trending"} in {country.name} {country.flag}</h1>
    <p className="section-description">{releases ? `Movies, series and episodes from the last ${DISCOVERY_CONFIG.recentDays} days and next ${DISCOVERY_CONFIG.upcomingDays} days. Newest released first, then upcoming soon.` : country.code === "IN" ? "India’s editorial Top 10 and qualified daily/weekly TMDB trends. New releases alone do not qualify as trending." : "Current TMDB trends, recent audience interest and returning series, with local titles leading the selection."}</p>
    <p className="discovery-note">{releases ? "Movies require a verified regional theatrical/digital date. TV uses reported premiere/episode dates with local origin or watch offers; these are not guaranteed local streaming dates." : country.code === "IN" ? "Editorial order leads by default. Each title appears once; unreleased titles belong in Latest Releases." : "Up to 200 local and 50 international movies and shows, depending on audience signals and availability. TMDB does not provide country viewing charts."}</p>
    <nav className="discovery-shortcuts" aria-label="Country discovery"><Link href="/country/trending" aria-current={!releases ? "page" : undefined}>Trending now</Link><Link href="/country/releases" aria-current={releases ? "page" : undefined}>Latest releases</Link></nav>
    <div className="genre-controls country-trending-controls">
      <div className="media-toggle" role="group" aria-label="Country discovery media type">
        {(["all", "movie", "tv"] as const).map(value => <button key={value} type="button" aria-pressed={filter === value} onClick={() => navigate({ filter: value })} disabled={updating}>{value === "all" ? "All" : value === "movie" ? "Movies" : "TV Shows"}</button>)}
      </div>
      {releases ? <div className="media-toggle" role="group" aria-label="Release status">{(["all", "released", "upcoming"] as const).map(value => <button key={value} type="button" aria-pressed={releaseStatus === value} onClick={() => navigate({ releaseStatus: value })} disabled={updating}>{value === "all" ? "All releases" : value === "released" ? "Recently Released" : "Upcoming"}</button>)}</div> : null}
      <label className="discovery-filter">Origin <select aria-label="Country of origin" value={origin} disabled={updating} onChange={event => navigate({ origin: event.target.value === "local" ? "local" : "all" })}><option value="all">Local + international</option><option value="local">From {country.name}</option></select></label>
      {!releases ? <label className="discovery-filter">Sort <select aria-label="Sort current trending" value={sort} disabled={updating} onChange={event => navigate({ sort: event.target.value as CountrySort })}><option value="current">{country.code === "IN" ? "India Top 10 · Current relevance" : "Local first · Current relevance"}</option><option value="newest">Newest among current picks</option></select></label> : null}
      <label className="discovery-filter">Releases <select aria-label="Release year" value={period} disabled={updating} onChange={event => navigate({ period: event.target.value as CountryPeriod })}><option value="current">All current picks</option><option value="year">{year} releases</option></select></label>
    </div>
    {updating ? <p className="section-status" role="status">Updating current picks for {country.name}…</p>
      : error ? <p className="section-status" role="status">We couldn’t load this selection. <button className="text-button" onClick={() => startTransition(() => router.refresh())}>Try again</button></p>
      : <>{partial ? <p className="discovery-note" role="status">Some discovery sources are temporarily unavailable; showing the available results.</p> : null}
        {total > 0 ? <p className="discovery-note" role="status">{total} current picks · {localTotal} from {country.name} · {internationalTotal} international · Page {page} of {totalPages}</p> : null}
        {movies.length ? <MovieGrid movies={movies} /> : <p className="section-status" role="status">No titles meet the current discovery criteria for this country and media type. Try another filter.</p>}
        {totalPages > 1 ? <nav className="trending-pagination" aria-label="Current trending pages"><button type="button" className="text-button" disabled={page <= 1 || updating} onClick={() => navigate({ page: page - 1 })}>← Previous</button><span>Page {page} of {totalPages}</span><button type="button" className="text-button" disabled={page >= totalPages || updating} onClick={() => navigate({ page: page + 1 })}>Next →</button></nav> : null}
      </>}
  </main>;
}
