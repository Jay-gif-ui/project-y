"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { MediaImage } from "@/components/media-image";
import { imageUrl, type Media } from "@/lib/media";

export function HomeBanner({ titles }: { titles: Media[] }) {
  const [selected, setSelected] = useState(0);
  const slides = titles.slice(0, 4);
  const active = slides[selected] ?? slides[0];
  if (!active) return <p className="cinema-empty">Popular titles are temporarily unavailable.</p>;
  return <div className="discovery-banner" aria-roledescription="carousel" aria-label="Popular movies and shows">
    <div className="banner-art"><MediaImage src={imageUrl(active.backdropPath ?? active.posterPath, "w1280")} alt="" sizes="(max-width: 700px) 100vw, 1286px" /></div>
    <div className="banner-copy" aria-live="polite"><h3>{active.title}</h3><Link className="violet-button" prefetch={false} href={`/${active.mediaType}/${active.id}`}>Explore now</Link></div>
    {slides.length > 1 ? <div className="banner-pagination">
      <span className="banner-current" aria-hidden="true" />
      <span className="banner-dots-art" aria-hidden="true"><Image src="/figma/banner-dots.svg" alt="" width={75} height={15} /></span>
      <button className="banner-active-control" aria-label={`Showing ${active.title}`} aria-pressed="true" />
      {slides.filter((_, index) => index !== selected).map((title, index) => <button className={`banner-dot-control dot-${index}`} key={`${title.mediaType}:${title.id}`} onClick={() => setSelected(slides.indexOf(title))} aria-label={`Show ${title.title}`} aria-pressed="false" />)}
    </div> : null}
  </div>;
}
