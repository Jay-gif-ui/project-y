import Link from "next/link";
import { Brand } from "@/components/brand";

export function HomeFooter() {
  return <footer className="home-footer" data-node-id="7:81">
    <div className="shell home-footer-layout">
      <div className="home-footer-intro"><Brand /><p>Discover what to watch. Find movies and shows, explore what’s trending, and discover where you can legally watch them.</p></div>
      <nav className="home-footer-links" aria-label="Footer navigation">
        <Link href="/country/trending" prefetch={false}>Explore</Link>
        <Link href="/#discover">Discover</Link>
        <details><summary>Company</summary><div className="home-footer-information">
          <p>© {new Date().getUTCFullYear()} iFynex. All rights reserved.</p>
          <p>Film &amp; TV data by <a href="https://www.themoviedb.org/" target="_blank" rel="noreferrer">TMDB</a>. Watch availability by <a href="https://www.justwatch.com/" target="_blank" rel="noreferrer">JustWatch</a>.</p>
          <p>This product uses the TMDB API but is not endorsed or certified by TMDB.</p>
          <p>Trending uses anonymous title checks by country. We do not store IP addresses or account IDs with these checks. Your browser’s Do Not Track and Global Privacy Control preferences are respected.</p>
        </div></details>
      </nav>
    </div>
  </footer>;
}
