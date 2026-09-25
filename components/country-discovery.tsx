"use client";

import { useCountry } from "@/components/country-provider";
import Link from "next/link";
import { ArrowIcon } from "@/components/icons";
import { MovieGrid } from "@/components/movie-grid";
import { DISCOVERY_CONFIG } from "@/data/discovery-config";
import type { Media } from "@/lib/media";

export function CountryDiscovery({ initialRegion, movies, latest, localCount, error, partial, releaseError, releasePartial }: { initialRegion: string; movies: Media[]; latest: Media[]; localCount: number; error: boolean; partial: boolean; releaseError: boolean; releasePartial: boolean }) {
  const { country, refreshing } = useCountry();
  const updating = refreshing || country.code !== initialRegion;
  const india = country.code === "IN";
  return <>
    <section id="latest-releases" className="movie-section shell" aria-labelledby="latest-title" aria-busy={updating}>
      <div className="section-heading"><div><p className="eyebrow">01 · Fresh to discover</p>
        <h2 id="latest-title">Latest Releases in {country.name} {country.flag}</h2>
        <p className="section-description">Recent movies, series and episodes from the last {DISCOVERY_CONFIG.recentDays} days, plus releases coming in the next {DISCOVERY_CONFIG.upcomingDays} days.</p>
        <p className="discovery-note">Newest releases first, then coming soon. TV air dates may differ from local streaming dates.</p>
      </div><Link className="see-all" href="/country/releases" prefetch={false}>See All <ArrowIcon /></Link></div>
      {updating ? <p className="section-status" role="status">Updating releases for {country.name}…</p> : releaseError ? <p className="section-status">Latest releases are temporarily unavailable.</p> : <>
        {releasePartial ? <p className="discovery-note" role="status">Some release sources are temporarily unavailable; showing verified results.</p> : null}
        {latest.length ? <MovieGrid movies={latest} /> : <p className="section-status">No recent or near-upcoming releases with reported dates were found for {country.name}.</p>}
      </>}
    </section>
    <section id="country-availability" className="movie-section shell country-home-section" aria-labelledby="country-title" aria-busy={updating}>
      <div className="section-heading"><div>
        <p className="eyebrow">02 · What’s getting attention</p>
        <h2 id="country-title">Trending in {country.name} {country.flag}</h2>
        <p className="section-description">{india ? "Our India Top 10, followed by current worldwide trends relevant in India." : `Current audience interest, with titles from ${country.name} leading the selection.`}</p>
        <details className="discovery-method"><summary>How these picks work</summary><p>{india ? "India’s editorial picks lead this selection. Daily and weekly TMDB trends follow when local watch offers or a recent India theatrical/digital release are reported. Unreleased titles are kept in Latest Releases. This is an editorial discovery list, not a measured viewing chart." : `Daily and weekly TMDB trends, recent audience interest and active series, with reported watch options in ${country.name}. Up to 16 local and 8 international homepage picks. See All explores the same qualified selection. This is a discovery estimate, not a country viewing chart.`}</p></details>
        <Link className="country-origin-link" href="/country/trending?origin=local" prefetch={false}>Explore current titles from {country.name} →</Link>
      </div><Link className="see-all" href="/country/trending" prefetch={false} aria-label={`See all current picks for ${country.name}`}>See All <ArrowIcon /></Link></div>
      {updating ? <p className="section-status" role="status">Updating picks for {country.name}…</p>
        : error ? <p className="section-status" role="status">We couldn’t load current titles for {country.name}. Please try again shortly.</p>
        : <>{partial ? <p className="discovery-note" role="status">Some discovery sources are temporarily unavailable; showing the available results.</p> : null}
          {movies.length ? <><p className="discovery-note">{localCount} from {country.name} · {movies.length - localCount} international</p><MovieGrid movies={movies} /></> : <p className="section-status">No current titles with verified country relevance were found for {country.name}.</p>}</>}
    </section>
  </>;
}
