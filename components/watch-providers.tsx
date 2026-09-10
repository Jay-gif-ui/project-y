"use client";

import { useState } from "react";
import Image from "next/image";
import { SUPPORTED_REGIONS } from "@/lib/regions";
import { imageUrl, type MediaType, type WatchProviders } from "@/lib/media";

type Props = { mediaType: MediaType; titleId: number; initialProviders: WatchProviders; initialRegion: string };

export function WatchProviders({ mediaType, titleId, initialProviders, initialRegion }: Props) {
  const [region, setRegion] = useState(initialRegion);
  const [providers, setProviders] = useState(initialProviders);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function changeRegion(nextRegion: string) {
    setRegion(nextRegion); setLoading(true); setError("");
    try {
      const response = await fetch(`/api/title/${mediaType}/${titleId}/providers?region=${nextRegion}`, { cache: "no-store" });
      const payload = await response.json() as { providers?: WatchProviders; error?: string };
      if (!response.ok || !payload.providers) throw new Error(payload.error);
      setProviders(payload.providers);
    } catch { setError("Provider availability is temporarily unavailable. Please try again."); }
    finally { setLoading(false); }
  }
  const groups = [["Stream", providers.flatrate], ["Rent", providers.rent], ["Buy", providers.buy], ["Free / ads", [...providers.free, ...providers.ads]]] as const;
  const hasProviders = groups.some(([, items]) => items.length > 0);
  return <section className="detail-section" aria-labelledby="watch-title"><div className="detail-section-heading"><div><p className="eyebrow">Availability</p><h2 id="watch-title">Where to watch</h2></div><label className="region-select">Country <select value={region} onChange={event => changeRegion(event.target.value)} disabled={loading}>{SUPPORTED_REGIONS.map(([code, name]) => <option key={code} value={code}>{name}</option>)}</select></label></div>{loading ? <p className="section-status">Checking availability…</p> : error ? <p className="section-status">{error}</p> : hasProviders ? <div className="provider-groups">{groups.map(([label, items]) => items.length ? <div key={label} className="provider-group"><h3>{label}</h3><div>{items.map(provider => <span className="provider" key={`${label}-${provider.id}`}>{provider.logoPath ? <Image src={imageUrl(provider.logoPath, "w92")!} alt="" width={30} height={30} /> : null}<span>{provider.name}</span></span>)}</div></div> : null)}</div> : <p className="section-status">No provider availability is reported for this country right now.</p>}{providers.link ? <a className="provider-link" href={providers.link} target="_blank" rel="noreferrer">View availability details on TMDB ↗</a> : null}</section>;
}
