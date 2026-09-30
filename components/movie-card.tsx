"use client";
import Link from "next/link"; import { imageUrl, type Media } from "@/lib/media";
import { MediaImage } from "@/components/media-image";
const signalLabels = {
  "daily-trend": "TMDB today", "weekly-trend": "TMDB this week",
  "recent-airing": "Recent episodes", "recent-interest": "Recent release · Audience interest",
  "recent-release": "Recent release", "ifynex-activity": "iFynex activity", "india-curated": "India curated", "upcoming-release": "Coming soon",
};
export function MovieCard({ movie, index, showRank = false, cinematic = false }: { movie: Media; index: number; showRank?: boolean; cinematic?: boolean }) {
  const year = movie.releaseDate?.slice(0, 4) ?? "Release date unavailable";
  const event = movie.releaseEvent;
  const date = event ? new Date(`${event.date}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }) : "";
  const signal = event ? `${event.status === "upcoming" ? "Coming Soon ·" : event.kind === "episode" ? "Episode" : event.kind === "digital" ? "Digital" : event.kind === "theatrical" ? "In Theatres ·" : "Released"} ${date}` : movie.discoverySignal ? signalLabels[movie.discoverySignal] : undefined;
  return <Link href={`/${movie.mediaType}/${movie.id}`} prefetch={false} className="movie-card" aria-label={`${movie.title}, ${year}, rated ${movie.rating.toFixed(1)}${signal ? `, ${signal}` : ""}. Open title.`}>
    <div className="poster">
      <MediaImage src={imageUrl(movie.posterPath)} alt={`${movie.title} poster`} sizes={cinematic ? "(max-width: 700px) 62vw, (max-width: 1050px) 30vw, 296px" : "(max-width: 700px) 48vw, 18vw"} />
      <div className="poster-grain" />
      {showRank ? <span className="poster-number">{String(index + 1).padStart(2, "0")}</span> : null}
      {signal && (!cinematic || event) ? <span className="discovery-badge">{signal}</span> : null}
    </div>
    <div className="card-details"><div><h3>{movie.title}</h3><p>{year} · {movie.mediaType === "tv" ? "TV Show" : "Movie"}</p></div><span className="rating">★ {movie.rating ? movie.rating.toFixed(1) : "—"}</span></div>
    {event && movie.releaseAvailability !== "offers-reported" ? <p className="discovery-note">{movie.releaseAvailability === "not-found" ? "Streaming availability not found" : "Streaming availability not confirmed"}</p> : null}
  </Link>;
}
