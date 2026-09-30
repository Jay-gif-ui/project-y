import Link from "next/link";
import { MediaImage } from "@/components/media-image";
import { imageUrl } from "@/lib/media";
import type { OttPlatform } from "@/lib/ott";
export function OttPlatforms({ platforms, countryName, error = false }: { platforms: OttPlatform[]; countryName: string; error?: boolean }) {
  return <section id="ott" className="ott-section shell" aria-labelledby="ott-title">
    <h2 id="ott-title">Discover Movies &amp; Shows on OTT</h2><p>Explore your streaming platforms in {countryName}.</p>
    {error ? <p className="section-status" role="status">Streaming platforms are temporarily unavailable. Please try again shortly.</p> : platforms.length ? <div className="platform-strip">{platforms.map(platform => <Link key={platform.slug} href={`/ott/${platform.slug}`} prefetch={false} className="platform-entry" aria-label={`Explore ${platform.name} in ${countryName}`}><span className="platform-logo"><MediaImage src={imageUrl(platform.logoPath, "w154")} alt={platform.name} sizes="72px" /></span><span>{platform.name}</span></Link>)}</div> : <p className="section-status">No supported streaming platforms were reported for {countryName}.</p>}
  </section>;
}

