import { Suspense } from "react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { CountryContent } from "@/components/country-content";
import { MovieShelf } from "@/components/movie-shelf";
import { MediaImage } from "@/components/media-image";
import { COUNTRY_PREFERENCE_COOKIE, getCountry } from "@/lib/countries";
import { getPlatformDefinition } from "@/lib/ott";
import { getPlatformDiscovery } from "@/lib/ott-discovery";
import { imageUrl } from "@/lib/media";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const platform = getPlatformDefinition((await params).slug);
  return { title: platform ? `${platform.name} movies & TV shows | iFynex` : "Platform not found | iFynex", description: platform ? `Discover trending and popular titles on ${platform.name}, with streaming availability for your country.` : undefined };
}
async function PlatformContent({ slug, region }: { slug: string; region: string }) {
  const country = getCountry(region), definition = getPlatformDefinition(slug)!;
  const result = await getPlatformDiscovery(slug, country.tmdbRegion);
  const data = result.data;
  const sections = [
    { title: "Trending movies", items: data?.trendingMovies ?? [] },
    { title: "Trending TV shows", items: data?.trendingShows ?? [] },
    { title: `Popular on ${definition.name}`, items: data?.popular ?? [] },
  ];
  return <CountryContent region={region}>
    <div className="platform-masthead shell"><Link className="platform-back" href="/#ott">← All streaming platforms</Link>
      <div className="platform-heading">{data?.platform?.logoPath ? <span className="platform-logo large"><MediaImage src={imageUrl(data.platform.logoPath, "w154")} alt={definition.name} sizes="88px" /></span> : null}<div><p>STREAMING IN {country.name.toUpperCase()}</p><h1>{definition.name}</h1></div></div>
      <p className="platform-description">Find your next watch. Explore movies and TV shows available on {definition.name} in {country.name}.</p>
    </div>
    {result.error ? <div className="cinema-empty shell" role="status"><h2>We couldn’t load this platform</h2><p>Please try again shortly. Streaming availability is temporarily unavailable.</p><Link href={`/ott/${slug}`} className="violet-button" prefetch={false}>Try again</Link></div>
      : !data?.platform ? <div className="cinema-empty shell"><h2>No catalogue reported in {country.name}</h2><p>Our data source doesn’t currently list {definition.name} for this country.</p><Link href="/#ott" className="violet-button">Explore other platforms</Link></div>
      : <>{result.partial ? <p className="discovery-note shell" role="status">Some sources are temporarily unavailable. Only confirmed results are shown.</p> : null}
        {sections.map((section, index) => <section className="cinema-section shell" key={section.title} aria-labelledby={`ott-section-${index}`}><div className="cinema-section-heading"><div><h2 id={`ott-section-${index}`}>{section.title}</h2></div></div>{section.items.length ? <MovieShelf movies={section.items} label={section.title} ranked={index < 2} /> : <p className="cinema-empty">No {index < 2 ? "current weekly trends with confirmed availability" : "matching titles"} were found on {definition.name} in {country.name}.</p>}</section>)}
        <p className="ott-data-note shell">Trending titles use TMDB’s weekly order with confirmed local subscription, free or ad-supported offers. Popular titles use the regional platform catalogue. Availability can change; open a title for watch options. Watch data: <a href="https://www.justwatch.com/" target="_blank" rel="noreferrer">JustWatch</a> via TMDB.</p>
      </>}
  </CountryContent>;
}
export default async function OttPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!getPlatformDefinition(slug)) notFound();
  const country = getCountry((await cookies()).get(COUNTRY_PREFERENCE_COOKIE)?.value);
  return <><Navbar /><main id="main-content" className="platform-page"><Suspense key={`${country.code}:${slug}`} fallback={<div className="shell platform-loading" role="status"><div className="skeleton-heading" /><div className="shelf-skeleton">{[0, 1, 2, 3].map(index => <div key={index} />)}</div><span className="sr-only">Loading streaming catalogue…</span></div>}><PlatformContent slug={slug} region={country.code} /></Suspense></main><Footer /></>;
}

