import { HomeFooter } from "@/components/home-footer";
import Link from "next/link";
import { Brand } from "@/components/brand";
import { ENABLED_COUNTRIES } from "@/lib/countries";
export function Footer({ cinematic = false }: { cinematic?: boolean }) {
  if (cinematic) return <HomeFooter />;
  return <footer className="ifynex-footer"><div className="shell">
    <div className="footer-columns"><div className="footer-intro"><Brand /><p>Discover what to watch. Find movies and shows, explore what’s trending, and discover where you can legally watch them.</p></div>
      <nav aria-label="Footer discover"><h2>Discover</h2><Link href="/country/trending" prefetch={false}>Trending now</Link><Link href="/country/trending?type=movie" prefetch={false}>Movies</Link><Link href="/country/trending?type=tv" prefetch={false}>TV shows</Link><Link href="/country/releases" prefetch={false}>New releases</Link><Link href="/wishlist">Your wishlist</Link></nav>
      <nav aria-label="Footer platforms"><h2>OTT Platforms</h2><Link href="/ott/netflix" prefetch={false}>Netflix</Link><Link href="/ott/amazon-prime-video" prefetch={false}>Amazon Prime Video</Link><Link href="/ott/disney-plus" prefetch={false}>Disney+</Link><Link href="/#ott">Explore platforms</Link></nav>
      <div><h2>Countries</h2>{ENABLED_COUNTRIES.map(country => <p className="footer-country" key={country.code}>{country.name}</p>)}<p className="footer-country-note">Personalised to your country.</p></div>
    </div>
    <div className="footer-bottom"><p>© {new Date().getUTCFullYear()} iFynex. All rights reserved.</p><p>Film &amp; TV data by <a href="https://www.themoviedb.org/" target="_blank" rel="noreferrer">TMDB</a>. Watch availability by <a href="https://www.justwatch.com/" target="_blank" rel="noreferrer">JustWatch</a>.</p></div>
    <p className="footer-attribution">This product uses the TMDB API but is not endorsed or certified by TMDB.</p>
  </div></footer>;
}

