"use client";
import Image from "next/image";
import { useRef } from "react";
import { MovieCard } from "@/components/movie-card";
import type { Media } from "@/lib/media";
export function MovieShelf({ movies, ranked = false, label }: { movies: Media[]; ranked?: boolean; label: string }) {
  const rail = useRef<HTMLDivElement>(null);
  function move(direction: number) {
    const element = rail.current;
    if (element) element.scrollBy({ left: direction * element.clientWidth, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }
  return <div className="movie-shelf" role="region" aria-label={label}>
    <div className="shelf-rail" ref={rail} tabIndex={0} aria-label={`${label}, scroll for more titles`}>
      {movies.map((movie, index) => <MovieCard key={`${movie.mediaType}:${movie.id}`} movie={movie} index={index} showRank={ranked} cinematic />)}
    </div>
    {movies.length > 1 ? <div className="shelf-controls"><button type="button" className="shelf-arrow previous" onClick={() => move(-1)} aria-label={`Previous ${label.toLowerCase()}`}><Image src="/figma/arrow-right.png" alt="" width={40} height={40} /></button><button type="button" className="shelf-arrow" onClick={() => move(1)} aria-label={`Next ${label.toLowerCase()}`}><Image src="/figma/arrow-right.png" alt="" width={40} height={40} /></button></div> : null}
  </div>;
}

