"use client";
import Image from "next/image"; import { useRouter } from "next/navigation"; import { imageUrl, type Media } from "@/lib/media";
const signalLabels = {
  "daily-trend": "TMDB today", "weekly-trend": "TMDB this week",
  "recent-airing": "Recent episodes", "recent-interest": "Recent release · Audience interest",
  "recent-release": "Recent release", "ifynex-activity": "iFynex activity",
};
export function MovieCard({ movie, index, showRank = false }: { movie: Media; index: number; showRank?: boolean }) {
  const router = useRouter();
  const year = movie.releaseDate?.slice(0, 4) ?? "Release date unavailable";
  const signal = movie.discoverySignal ? signalLabels[movie.discoverySignal] : undefined;
  return <button type="button" onClick={() => router.push(`/${movie.mediaType}/${movie.id}`)} className="movie-card" aria-label={`${movie.title}, ${year}, rated ${movie.rating.toFixed(1)}${signal ? `, ${signal}` : ""}. Open title.`}>
    <div className="poster">
      {movie.posterPath ? <Image src={imageUrl(movie.posterPath)!} alt={`${movie.title} poster`} fill sizes="(max-width: 700px) 48vw, 18vw" priority={index < 4} /> : <div className="poster-fallback" aria-label="Poster unavailable"><span>{movie.title.slice(0, 1)}</span></div>}
      <div className="poster-grain" />
      {showRank ? <span className="poster-number">{String(index + 1).padStart(2, "0")}</span> : null}
      {signal ? <span className="discovery-badge">{signal}</span> : null}
    </div>
    <div className="card-details"><div><h3>{movie.title}</h3><p>{year} · {movie.mediaType === "tv" ? "TV Show" : "Movie"}</p></div><span className="rating">★ {movie.rating ? movie.rating.toFixed(1) : "—"}</span></div>
  </button>;
}
