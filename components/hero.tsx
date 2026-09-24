import Link from "next/link";
import { SearchForm } from "@/components/search-form";

export function Hero() {
  return <section className="hero discovery-hero" aria-labelledby="hero-title">
    <div className="hero-noise" /><div className="hero-orbit hero-orbit-one" />
    <div className="shell hero-content">
      <div><p className="eyebrow">Your watchlist starts here</p>
        <h1 id="hero-title">What’s worth watching <em>right now.</em></h1>
        <p className="hero-copy">Current movies, new series and where to watch them in your country.</p>
      </div>
      <div className="discovery-hero-search"><SearchForm />
        <nav className="discovery-shortcuts" aria-label="Explore current entertainment">
          <Link href="#country-availability">Trending now</Link><Link href="#latest-releases">Latest releases</Link><Link href="#global-title">Global trends</Link>
        </nav>
      </div>
    </div>
  </section>;
}
