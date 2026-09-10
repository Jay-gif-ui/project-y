import Link from "next/link";
import type { Media } from "@/lib/tmdb";
import { ArrowIcon } from "@/components/icons";
import { MovieGrid } from "@/components/movie-grid";
export function MovieSection({ id, eyebrow, title, description, movies, href = "/search" }: { id: string; eyebrow: string; title: string; description?: string; movies: Media[]; href?:string }) { return <section id={id} className="movie-section shell" aria-labelledby={`${id}-title`}><div className="section-heading"><div><p className="eyebrow">{eyebrow}</p><h2 id={`${id}-title`}>{title}</h2>{description && <p className="section-description">{description}</p>}</div><Link href={href} className="see-all">See all <ArrowIcon /></Link></div><MovieGrid movies={movies} /></section>; }
