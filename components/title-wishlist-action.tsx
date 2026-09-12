"use client";

import { useEffect, useState } from "react";
import { WishlistButton } from "@/components/wishlist-button";
import type { Media, MediaType } from "@/lib/media";

export function TitleWishlistAction({ mediaType, titleId }: { mediaType: MediaType; titleId: number }) {
  const [title, setTitle] = useState<Media | null>(null);
  useEffect(() => { let live = true; fetch(`/api/title/${mediaType}/${titleId}`, { cache: "no-store" }).then(async response => response.ok ? response.json() as Promise<{ title?: Media }> : null).then(payload => { if (live) setTitle(payload?.title ?? null); }).catch(() => {}); return () => { live = false; }; }, [mediaType, titleId]);
  return title ? <WishlistButton title={title} /> : null;
}
