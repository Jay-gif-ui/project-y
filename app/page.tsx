import { Suspense } from "react";
import { cookies } from "next/headers";
import Link from "next/link";
import { Footer } from "@/components/footer";
import { Hero } from "@/components/hero";
import { Navbar } from "@/components/navbar";
import { Brand } from "@/components/brand";
import { CountryContent } from "@/components/country-content";
import { MovieShelf } from "@/components/movie-shelf";
import { MediaImage } from "@/components/media-image";
import { HomeBanner } from "@/components/home-banner";
import { OttPlatforms } from "@/components/ott-platforms";
import { getHomeTrending, getCountryDiscovery, getRegionalPlatforms } from "@/lib/tmdb";
import { getHomeInterest } from "@/lib/title-interest-server";
import { COUNTRY_PREFERENCE_COOKIE, getCountry, type Country } from "@/lib/countries";
import { getCountryReleases } from "@/lib/tmdb-releases";
import { imageUrl, type Media } from "@/lib/media";

function Section({ id, title, href, linkLabel = "See all", children }: { id: string; title: string; href?: string; linkLabel?: string; children: React.ReactNode }) {
  return <section id={id} className="cinema-section shell" aria-labelledby={`${id}-title`}>
    <div className="cinema-section-heading"><h2 id={`${id}-title`}>{title}</h2>{href ? <Link className="cinema-see-all" prefetch={false} href={href}>{linkLabel}</Link> : null}</div>{children}
  </section>;
}
function ShelfContent({ movies, error, label, ranked = false }: { movies: Media[]; error?: boolean; label: string; ranked?: boolean }) {
  if (!movies.length) return <p className="cinema-empty" role="status">{error ? "We couldn’t load these titles. Please try again shortly." : "No matching titles are currently reported for your country."}</p>;
  return <MovieShelf movies={movies} ranked={ranked} label={label} />;
}
async function HomeDiscovery({ country }: { country: Country }) {
  const trends = { movie: getHomeTrending("movie"), tv: getHomeTrending("tv") };
  const [movies, shows, releases, platforms] = await Promise.all([
    getCountryDiscovery(country.tmdbRegion, { surface: "home", filter: "movie" }, trends),
    getCountryDiscovery(country.tmdbRegion, { surface: "home", filter: "tv" }, trends),
    getCountryReleases(country.tmdbRegion), getRegionalPlatforms(country.tmdbRegion),
  ]);
  const fallback = [...(movies.data?.items ?? []), ...(shows.data?.items ?? [])];
  const interest = await getHomeInterest(country.code, fallback);
  const newShows = (releases.data?.items ?? []).filter(item => item.mediaType === "tv").slice(0, 10);
  const popular = [...fallback].sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0));
  const heroTitle = interest.movie.items.find(item => item.posterPath) ?? fallback.find(item => item.posterPath);
  const hasCommunity = interest.movie.communityCount + interest.tv.communityCount > 0;
  return <CountryContent region={country.code}>
    <Hero title={heroTitle} />
    <div id="discover" className="home-discovery">
      <Section id="movies" title="Top 10 Movies this week">
        <ShelfContent movies={interest.movie.items} error={Boolean(movies.error)} label={`Top movies in ${country.name}`} ranked />
      </Section>
      <Section id="tv-shows" title="Top 10 Shows this week">
        <ShelfContent movies={interest.tv.items} error={Boolean(shows.error)} label={`Top shows in ${country.name}`} ranked />
        <details className="cinema-method"><summary>What’s trending in {country.name}?</summary><p>{hasCommunity
          ? `Most-checked titles on Project Y in ${country.name} over the past seven days, with more weight on recent activity. Where activity is limited, we fill remaining places using our existing TMDB country discovery.`
          : `As more people explore titles in ${country.name}, their activity will shape these lists. For now, these are our existing TMDB country discovery picks.`} Rankings refresh about every five minutes. Repeat checks within 30 minutes count once. These measure interest in a title, not streams or ticket sales.</p></details>
      </Section>
      <Section id="latest-releases" title="New TV Shows">
        {!newShows.length ? <p className="cinema-empty">{releases.error ? "New releases are temporarily unavailable." : "No recent TV releases are currently reported."}</p> : <div className="feature-grid">{newShows.slice(0, 2).map(show => <Link href={`/tv/${show.id}`} prefetch={false} className="feature-card" key={show.id}><MediaImage src={imageUrl(show.backdropPath ?? show.posterPath, "w780")} alt={show.title} sizes="(max-width: 700px) 90vw, 45vw" /><div className="feature-copy"><p>{show.releaseEvent?.status === "upcoming" ? "Coming soon" : "New episodes & series"}</p><h3>{show.title}</h3><span>Explore show <span aria-hidden="true">↗</span></span></div></Link>)}</div>}
      </Section>
      <Section id="new-shows" title="New TV shows" href="/country/releases?type=tv" linkLabel="See all new TV shows">
        <ShelfContent movies={newShows} error={Boolean(releases.error)} label="New TV shows" />
      </Section>
      <Section id="popular" title="Popular movies & shows">
        <HomeBanner titles={popular} />
      </Section>
      <OttPlatforms platforms={platforms.data ?? []} countryName={country.name} error={Boolean(platforms.error)} />
    </div>
  </CountryContent>;
}
function HomeLoading() {
  return <><Hero /><div className="shell home-loading" role="status"><div className="skeleton-heading" /><div className="shelf-skeleton">{[0, 1, 2, 3].map(index => <div key={index} />)}</div><span className="sr-only">Loading movies, shows and streaming platforms…</span></div></>;
}
export default async function Home() {
  const country = getCountry((await cookies()).get(COUNTRY_PREFERENCE_COOKIE)?.value);
  return <><Navbar /><main id="main-content" className="cinema-home"><Suspense key={country.code} fallback={<HomeLoading />}><HomeDiscovery country={country} /></Suspense>
    <section className="discovery-cta shell"><Brand /><h2>Find the best movies &amp; TV shows on all your favourite streaming services</h2><Link className="violet-button" href="/country/trending" prefetch={false}>Find what to watch</Link></section>
  </main><Footer cinematic /></>;
}
