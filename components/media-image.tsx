"use client";
import Image from "next/image";
import { useState } from "react";
export function MediaImage({ src, alt, sizes, priority = false, className = "" }: { src?: string; alt: string; sizes: string; priority?: boolean; className?: string }) {
  const [failedSource, setFailedSource] = useState<string>();
  return src && failedSource !== src ? <Image src={src} alt={alt} fill sizes={sizes} priority={priority} className={className} onError={() => setFailedSource(src)} /> : <div className="media-image-fallback"><span aria-hidden="true">{alt.slice(0, 1)}</span><span>Artwork unavailable</span></div>;
}

