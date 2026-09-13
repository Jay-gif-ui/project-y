"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import type { Media } from "@/lib/media";

export function WishlistButton({ title }: { title: Media }) {
  const { user } = useAuth();
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [prompt, setPrompt] = useState(false);
  const [error, setError] = useState("");
  const returnTo = `/${title.mediaType}/${title.id}`;

  useEffect(() => {
    let live = true;
    const supabase = getSupabaseBrowserClient();
    if (!user || !supabase) { setLoading(false); return; }
    supabase.from("wishlists").select("id").eq("user_id", user.id).eq("tmdb_id", title.id).eq("media_type", title.mediaType).maybeSingle().then(({ data, error: queryError }) => {
      if (!live) return;
      if (queryError) setError("Wishlist is not ready yet."); else setSaved(Boolean(data));
      setLoading(false);
    });
    return () => { live = false; };
  }, [user, title.id, title.mediaType]);

  async function toggle() {
    const supabase = getSupabaseBrowserClient();
    if (!user || !supabase) return;
    setLoading(true); setError("");
    if (saved) {
      const { error: removeError } = await supabase.from("wishlists").delete().eq("user_id", user.id).eq("tmdb_id", title.id).eq("media_type", title.mediaType);
      if (removeError) setError("Could not remove this title."); else setSaved(false);
    } else {
      const { error: addError } = await supabase.from("wishlists").insert({ user_id: user.id, tmdb_id: title.id, media_type: title.mediaType, title: title.title, poster_path: title.posterPath ?? null, release_date: title.releaseDate ?? null, rating: title.rating });
      if (addError) setError("Could not save this title. Please try again."); else setSaved(true);
    }
    setLoading(false);
  }

  if (!user) return <div className="wishlist-action"><button type="button" className="secondary-link" onClick={() => setPrompt(true)}>+ Add to wishlist</button>{prompt ? <div className="auth-modal" role="dialog" aria-modal="true" aria-label="Sign in to save to your wishlist"><div><button className="modal-close" onClick={() => setPrompt(false)} aria-label="Close">×</button><p className="eyebrow">Project Y account</p><h2>Save this title</h2><p>Create a free account to add it to your wishlist and return to it anytime.</p><Link className="primary-link" href={`/login?next=${encodeURIComponent(returnTo)}`}>Sign in</Link><Link className="secondary-link" href={`/signup?next=${encodeURIComponent(returnTo)}`}>Create account</Link></div></div> : null}</div>;

  return <div className="wishlist-action"><button type="button" className="secondary-link" onClick={toggle} disabled={loading}>{loading ? "Checking…" : saved ? "✓ Saved to wishlist" : "+ Add to wishlist"}</button>{error ? <p role="alert">{error}</p> : null}</div>;
}
