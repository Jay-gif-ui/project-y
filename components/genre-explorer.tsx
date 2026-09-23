"use client";

import { useEffect, useState } from "react";
import { useCountry } from "@/components/country-provider";
import { MovieGrid } from "@/components/movie-grid";
import type { DiscoveryPeriod, Genre } from "@/lib/discovery";
import type { Media, MediaType } from "@/lib/media";

function GenreResults({ type, genre, period, region, countryName }: { type: MediaType; genre: Genre; period: DiscoveryPeriod; region: string; countryName: string }) {
  const [result, setResult] = useState<{ items: Media[]; partial?: boolean } | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError(false);
    setResult(null);
    const params = new URLSearchParams({ type, genre: String(genre.id), period });
    fetch(`/api/discover?${params}`, { signal: controller.signal, cache: "no-store" }).then(async response => {
      const data = await response.json() as { results?: Media[]; region?: string; partial?: boolean };
      if (!response.ok || !Array.isArray(data.results) || data.region !== region) throw new Error("Discovery unavailable");
      if (!controller.signal.aborted) setResult({ items: data.results, partial: data.partial });
    }).catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [type, genre.id, period, region, attempt]);
  return <div className="genre-results" aria-busy={!result && !error}>
    <p className="discovery-note" role="status">{error ? <>We couldn’t load this selection. <button className="text-button" onClick={() => setAttempt(value => value + 1)}>Try again</button></>
      : !result ? `Finding ${genre.name.toLowerCase()} ${type === "movie" ? "movies" : "TV shows"} to watch in ${countryName}…`
      : `${genre.name} · ${type === "movie" ? "Movies" : "TV shows"} · Available in ${countryName}${result.partial ? " · Some discovery sources are temporarily unavailable" : ""}`}</p>
    {result ? result.items.length ? <MovieGrid movies={result.items} /> : <p className="section-status">No current titles match this genre and watch region. Try another genre or release window.</p> : null}
  </div>;
}

export function GenreExplorer({ genres, year }: { genres: Record<MediaType, Genre[]>; year: number }) {
  const { country } = useCountry();
  const [type, setType] = useState<MediaType>("movie");
  const [genreId, setGenreId] = useState<number | null>(null);
  const [period, setPeriod] = useState<DiscoveryPeriod>("recent");
  const selected = genres[type].find(genre => genre.id === genreId);
  return <section id="genres" className="movie-section shell" aria-labelledby="genres-title">
    <div className="section-heading"><div>
      <p className="eyebrow">03 · Follow your taste</p>
      <h2 id="genres-title">Explore by genre</h2>
      <p className="section-description">Find your next movie or series to watch in {country.name}. Recent releases lead the selection.</p>
    </div></div>
    <div className="genre-controls">
      <div className="media-toggle" role="group" aria-label="Genre media type">
        {(["movie", "tv"] as const).map(value => <button key={value} type="button" aria-pressed={type === value} onClick={() => { setType(value); setGenreId(null); }}>{value === "movie" ? "Movies" : "TV shows"}</button>)}
      </div>
      <label className="discovery-filter">Release window<select value={period} onChange={event => setPeriod(event.target.value as DiscoveryPeriod)}>
        <option value="recent">{year - 1}–{year} + current favorites</option>
        <option value="year">{year} releases only</option>
      </select></label>
    </div>
    <div className="genre-list" role="group" aria-label={`${type === "movie" ? "Movie" : "TV"} genres`}>
      {genres[type].map(genre => <button type="button" key={genre.id} aria-pressed={genreId === genre.id} onClick={() => setGenreId(genre.id)}>{genre.name}</button>)}
    </div>
    {!genres[type].length ? <p className="section-status">Genres are temporarily unavailable. Please refresh to try again.</p> : !selected ? <p className="section-status">Choose a genre to explore current {type === "movie" ? "movies" : "TV shows"}.</p>
      : <GenreResults key={`${country.code}:${type}:${selected.id}:${period}`} type={type} genre={selected} period={period} region={country.code} countryName={country.name} />}
    <p className="discovery-note">Ordered by freshness and TMDB popularity. Returning favorites need current weekly trend or recent TV airing evidence. Availability can change.</p>
  </section>;
}
