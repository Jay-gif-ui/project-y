import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Footer } from "@/components/footer";
import { MovieGrid } from "@/components/movie-grid";
import { Navbar } from "@/components/navbar";
import { WatchProviders } from "@/components/watch-providers";
import { getTitleDetails, getWatchProviders, imageUrl, type MediaType } from "@/lib/tmdb";
import { cookies } from "next/headers";
import { COUNTRY_PREFERENCE_COOKIE, getCountry } from "@/lib/countries";

type PageProps = { params: Promise<{ type: string; id: string }> };
const valid = (type: string, id: string): type is MediaType => (type === "movie" || type === "tv") && /^\d+$/.test(id);
const formatMoney = (amount?: number) => amount ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount) : undefined;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { type, id } = await params;
  if (!valid(type, id)) return { title: "Title not found | Project Y" };
  const result = await getTitleDetails(type, Number(id));
  if (!("data" in result) || !result.data) return { title: "Title unavailable | Project Y" };
  return { title: `${result.data.title} | Project Y`, description: result.data.overview || `Explore ${result.data.title} on Project Y`, openGraph: result.data.backdropPath ? { images: [imageUrl(result.data.backdropPath, "w1280")!] } : undefined };
}

export default async function TitlePage({ params }: PageProps) {
  const { type, id } = await params;
  if (!valid(type, id)) notFound();
  const titleId = Number(id);
  const country = getCountry((await cookies()).get(COUNTRY_PREFERENCE_COOKIE)?.value);
  const [detailResult, providerResult] = await Promise.all([getTitleDetails(type, titleId), getWatchProviders(type, titleId, country.tmdbRegion)]);
  if (!("data" in detailResult) || !detailResult.data) {
    if (detailResult.error === "not-found") notFound();
    return <><Navbar /><main className="shell title-error"><p className="eyebrow">Service update</p><h1>Title details are temporarily unavailable.</h1><p>We could not load this title from the movie service. Please try again shortly.</p><Link href="/" className="primary-link">Back to discovery</Link></main><Footer /></>;
  }
  const title = detailResult.data;
  const providers = "data" in providerResult && providerResult.data ? providerResult.data : { flatrate: [], rent: [], buy: [], free: [], ads: [] };
  const trailer = title.videos.find(video => video.official && video.type === "Trailer") ?? title.videos.find(video => video.type === "Trailer");
  const facts = [["Release", title.releaseDate], ["Runtime", title.runtime ? `${title.runtime} min` : undefined], ["Original language", title.originalLanguage], ["Status", title.status], ["Production", title.companies.join(", ") || undefined], ["Countries", title.countries.join(", ") || undefined], ["Budget", formatMoney(title.budget)], ["Revenue", formatMoney(title.revenue)]];
  return <><Navbar /><main><section className="title-hero">{title.backdropPath ? <Image className="title-backdrop" src={imageUrl(title.backdropPath, "w1280")!} alt="" fill priority sizes="100vw" /> : null}<div className="title-hero-shade" /><div className="shell title-hero-content"><Link className="back-link" href="/">← Back to discovery</Link><div className="title-summary">{title.posterPath ? <div className="title-poster"><Image src={imageUrl(title.posterPath)!} alt={`${title.title} poster`} fill priority sizes="(max-width: 700px) 45vw, 260px" /></div> : null}<div><p className="eyebrow">{type === "movie" ? "Movie" : "TV show"} · {title.releaseDate?.slice(0, 4) ?? "Release date unavailable"}</p><h1>{title.title}</h1>{title.originalTitle && title.originalTitle !== title.title ? <p className="original-title">Original title: {title.originalTitle}</p> : null}{title.tagline ? <p className="tagline">{title.tagline}</p> : null}<div className="title-meta"><strong>★ {title.rating ? title.rating.toFixed(1) : "—"}</strong><span>{title.voteCount.toLocaleString()} TMDB votes</span>{title.genres.map(genre => <span key={genre}>{genre}</span>)}</div><p className="overview">{title.overview || "No overview is available for this title."}</p><div className="title-actions">{trailer ? <a className="primary-link" href={`https://www.youtube.com/watch?v=${trailer.key}`} target="_blank" rel="noreferrer">Watch trailer ↗</a> : null}{title.imdbId ? <a className="secondary-link" href={`https://www.imdb.com/title/${title.imdbId}/`} target="_blank" rel="noreferrer">View on IMDb ↗</a> : null}</div></div></div></div></section><div className="shell detail-layout"><div className="detail-main"><WatchProviders mediaType={type} titleId={titleId} initialProviders={providers} initialRegion="US" /><section className="detail-section" aria-labelledby="about-title"><p className="eyebrow">About</p><h2 id="about-title">About this {type === "movie" ? "movie" : "show"}</h2><dl className="facts">{facts.filter(([, value]) => value).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section>{title.cast.length ? <section className="detail-section" aria-labelledby="cast-title"><p className="eyebrow">Cast & crew</p><h2 id="cast-title">The people behind the story</h2><div className="people-grid">{title.cast.map(person => <article key={person.id} className="person"><div className="person-image">{person.profilePath ? <Image src={imageUrl(person.profilePath, "w185")!} alt="" fill sizes="120px" /> : <span>{person.name.slice(0, 1)}</span>}</div><h3>{person.name}</h3><p>{person.role || "Cast"}</p></article>)}</div>{title.crew.length ? <div className="crew-list">{title.crew.map(person => <span key={`${person.id}-${person.role}`}><strong>{person.role}:</strong> {person.name}</span>)}</div> : null}</section> : null}{title.reviews.length ? <section className="detail-section" aria-labelledby="reviews-title"><p className="eyebrow">Audience thoughts</p><h2 id="reviews-title">TMDB reviews</h2><div className="reviews">{title.reviews.map(review => <article key={review.id}><h3>{review.author}</h3><p>{review.content}</p>{review.url ? <a href={review.url} target="_blank" rel="noreferrer">Read on TMDB ↗</a> : null}</article>)}</div></section> : null}</div></div>{title.recommendations.length ? <section className="related-section shell"><p className="eyebrow">Keep exploring</p><h2>Recommended for you</h2><MovieGrid movies={title.recommendations} /></section> : null}{title.similar.length ? <section className="related-section shell"><p className="eyebrow">More like this</p><h2>Similar titles</h2><MovieGrid movies={title.similar} /></section> : null}</main><Footer /></>;
}
