"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { imageUrl, type MediaType } from "@/lib/media";

type WishlistRow = { id:string; tmdb_id:number; media_type:MediaType; title:string; poster_path:string|null; release_date:string|null; rating:number|null };
export function WishlistPage() {
  const { user, loading: authLoading } = useAuth(); const [items, setItems] = useState<WishlistRow[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  useEffect(() => { const supabase=getSupabaseBrowserClient(); if (authLoading) return; if (!user || !supabase) { setLoading(false); return; } supabase.from("wishlists").select("id,tmdb_id,media_type,title,poster_path,release_date,rating").order("created_at", { ascending:false }).then(({data,error:queryError})=>{if(queryError)setError("Wishlist is not ready yet."); else setItems((data ?? []) as WishlistRow[]); setLoading(false);}); }, [user, authLoading]);
  async function remove(item:WishlistRow){const supabase=getSupabaseBrowserClient(); if(!supabase)return; const previous=items;setItems(items.filter(entry=>entry.id!==item.id));const {error:removeError}=await supabase.from("wishlists").delete().eq("id",item.id);if(removeError){setItems(previous);setError("Could not remove this title.");}}
  if (authLoading || loading) return <main className="shell wishlist-page"><p className="section-status">Loading your wishlist…</p></main>;
  if (!user) return <main className="shell wishlist-page"><p className="eyebrow">Your list</p><h1>Sign in to see your wishlist</h1><Link href="/login" className="primary-link">Sign in</Link></main>;
  return <main className="shell wishlist-page"><p className="eyebrow">Your list</p><h1>Wishlist</h1>{error ? <p className="section-status" role="alert">{error}</p> : null}{items.length ? <div className="wishlist-grid">{items.map(item=><article key={item.id} className="wishlist-card">{item.poster_path ? <img src={imageUrl(item.poster_path)!} alt="" /> : <div className="wishlist-poster-fallback">{item.title.slice(0,1)}</div>}<div><p>{item.media_type === "movie" ? "Movie" : "TV Show"} · {item.release_date?.slice(0,4) ?? "—"}</p><h2><Link href={`/${item.media_type}/${item.tmdb_id}`}>{item.title}</Link></h2><span>★ {item.rating?.toFixed(1) ?? "—"}</span><button onClick={()=>remove(item)}>Remove</button></div></article>)}</div> : <section className="wishlist-empty"><h2>Your wishlist is empty</h2><p>Save a movie or show from its detail page to find it here later.</p><Link href="/" className="primary-link">Discover titles</Link></section>}</main>;
}
