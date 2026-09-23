import type { Media } from "@/lib/tmdb";
import { MovieCard } from "@/components/movie-card";
export function MovieGrid({ movies, showRank = false }: { movies: Media[]; showRank?: boolean }) { return movies.length ? <div className="movie-grid">{movies.map((movie, index) => <MovieCard key={`${movie.mediaType}-${movie.id}`} movie={movie} index={index} showRank={showRank} />)}</div> : <p className="section-status">No titles are available right now.</p>; }
