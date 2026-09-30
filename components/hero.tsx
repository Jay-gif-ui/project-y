import Image from "next/image";
import Link from "next/link";
import { imageUrl, type Media } from "@/lib/media";

export function Hero({ title }: { title?: Media }) {
  const artwork = imageUrl(title?.posterPath ?? title?.backdropPath, "original");
  return <section className="cinema-hero" aria-labelledby="hero-title" data-node-id="7:8">
    <div className="cinema-art" aria-hidden="true">
      {artwork ? <><Image className="hero-art-right" src={artwork} alt="" width={1055} height={1562} loading="eager" sizes="(max-width: 700px) 150vw, 74vw" />
        <Image className="hero-art-left" src={artwork} alt="" width={1055} height={1562} loading="eager" sizes="(max-width: 700px) 150vw, 74vw" /></> : null}
    </div>
    <div className="cinema-shade" />
    <div className="cinema-hero-content shell">
      <h1 id="hero-title">Your streaming guide for<br className="hero-break" /> movies, TV shows &amp; more</h1>
      <p>Discover your next favourite. Explore what’s trending and find<br className="desktop-break" /> where to watch movies and TV shows in your country.</p>
      <Link className="violet-button" href="#discover">Discover Movies &amp; TV shows</Link>
    </div>
    <div className="cinema-arc" aria-hidden="true">
      {/* Exact Figma vector, kept at its intrinsic dimensions. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/figma/hero-arc.svg" alt="" width="2542.27" height="680.467" />
    </div>
  </section>;
}
