"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { MovieGrid } from "@/components/movie-grid";
import type { Media, MediaType } from "@/lib/media";

export function GlobalTrendingPage({ filter, movies, page, totalPages, error }: { filter: "all" | MediaType; movies: Media[]; page: number; totalPages: number; error: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  function navigate(type: "all" | MediaType, nextPage = 1) {
    const params = new URLSearchParams();
    if (type !== "all") params.set("type", type);
    if (nextPage > 1) params.set("page", String(nextPage));
    startTransition(() => router.push(`/trending/global${params.size ? `?${params}` : ""}`, { scroll: false }));
  }
  return <main className="shell search-page country-trending-page" aria-labelledby="global-page-title" aria-busy={pending}>
    <Link className="back-link" href="/#discover">← Back to discovery</Link>
    <p className="eyebrow">Worldwide this week</p>
    <h1 id="global-page-title">Global Trending 🌎</h1>
    <p className="section-description">Movies and TV shows trending worldwide this week, in TMDB’s original order.</p>
    <div className="genre-controls country-trending-controls"><div className="media-toggle" role="group" aria-label="Global trending media type">
      {(["all", "movie", "tv"] as const).map(type => <button key={type} type="button" aria-pressed={filter === type} disabled={pending} onClick={() => navigate(type)}>{type === "all" ? "All" : type === "movie" ? "Movies" : "TV Shows"}</button>)}
    </div></div>
    {pending ? <p className="section-status" role="status">Updating global trending…</p> : error ? <p className="section-status" role="status">Global trending is temporarily unavailable. <button className="text-button" onClick={() => startTransition(() => router.refresh())}>Try again</button></p> : <>
      <MovieGrid movies={movies} />
      {totalPages > 1 ? <nav className="trending-pagination" aria-label="Global trending pages">
        <button type="button" className="text-button" disabled={page <= 1} onClick={() => navigate(filter, page - 1)}>← Previous</button>
        <span>Page {page} of {totalPages}</span>
        <button type="button" className="text-button" disabled={page >= totalPages} onClick={() => navigate(filter, page + 1)}>Next →</button>
      </nav> : null}
    </>}
  </main>;
}
