"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { imageUrl, type MediaType, type WatchProviders as ProviderData } from "@/lib/media";
import { getProviderOffers, OFFER_TYPES, type OfferType } from "@/lib/watch-providers";
import type { Country } from "@/lib/countries";
import { CountrySelector } from "@/components/country-selector";
import { useCountry } from "@/components/country-provider";

type Props = {
  mediaType: MediaType;
  titleId: number;
  initialProviders: ProviderData;
  initialRegion: string;
  initialError?: boolean;
};
type Availability = { providers?: ProviderData; loading: boolean; error?: boolean };
const filters = [
  { key: "all", label: "All options" },
  { key: "flatrate", label: "Subscription" },
  { key: "rent", label: "Rent" },
  { key: "buy", label: "Buy" },
  { key: "free", label: "Free / ads" },
] as const;
type Filter = (typeof filters)[number]["key"];
const matchesFilter = (type: OfferType, filter: Filter) => filter === "all" || type === filter || (filter === "free" && type === "ads");

export function WatchProviders(props: Props) {
  const { country } = useCountry();
  // A country/title switch discards the previous country's rows and destinations immediately.
  return <CountryAvailability key={`${props.mediaType}:${props.titleId}:${country.code}`} {...props} country={country} />;
}

function CountryAvailability({ mediaType, titleId, initialProviders, initialRegion, initialError, country }: Props & { country: Country }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [retry, setRetry] = useState(0);
  const [availability, setAvailability] = useState<Availability>(() => country.code === initialRegion
    ? { providers: initialProviders, loading: false, error: initialError }
    : { loading: true });

  useEffect(() => {
    if (country.code === initialRegion && retry === 0) {
      setAvailability({ providers: initialProviders, loading: false, error: initialError });
      return;
    }
    let active = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 35_000);
    setAvailability({ loading: true });
    fetch(`/api/title/${mediaType}/${titleId}/providers?region=${country.tmdbRegion}`, { cache: "no-store", signal: controller.signal })
      .then(async response => {
        const payload = await response.json() as { providers?: ProviderData; region?: string };
        if (!response.ok || !payload.providers || payload.region !== country.code) throw new Error("Availability unavailable");
        if (active) setAvailability({ providers: payload.providers, loading: false });
      })
      .catch(() => { if (active) setAvailability({ loading: false, error: true }); })
      .finally(() => clearTimeout(timeout));
    return () => { active = false; clearTimeout(timeout); controller.abort(); };
  }, [country.code, country.tmdbRegion, initialRegion, initialProviders, initialError, mediaType, titleId, retry]);

  const { providers, loading, error } = availability;
  const offers = providers ? getProviderOffers(providers) : [];
  const visible = offers.filter(offer => offer.types.some(type => matchesFilter(type, filter)));
  return <section className="detail-section watch-section" id="where-to-watch" aria-labelledby="watch-title" aria-busy={loading}>
    <div className="detail-section-heading">
      <div><p className="eyebrow">Streaming, rental & purchase</p><h2 id="watch-title">Where to watch</h2></div>
      <CountrySelector />
    </div>
    <p className="watch-country">Available options in {country.flag} <strong>{country.name}</strong></p>
    {loading ? <p className="availability-status" role="status">Checking availability in {country.name}…</p>
      : error ? <div className="availability-status" role="alert"><p>We couldn’t load availability for {country.name}. Please try again.</p><button type="button" className="secondary-link" onClick={() => setRetry(value => value + 1)}>Try again</button></div>
      : offers.length ? <>
        <div className="watch-filters" role="group" aria-label="Filter watch options">
          {filters.map(item => <button key={item.key} type="button" aria-pressed={filter === item.key} onClick={() => setFilter(item.key)}>{item.label}</button>)}
        </div>
        <div aria-live="polite" aria-atomic="true" className="sr-only">{visible.length} {visible.length === 1 ? "provider" : "providers"} in {country.name}</div>
        {visible.length ? <ul className="watch-offers">
          {visible.map(offer => {
            const types = offer.types.filter(type => matchesFilter(type, filter));
            const action = types.some(type => ["flatrate", "free", "ads"].includes(type)) ? "Watch options" : types.includes("rent") && types.includes("buy") ? "Rent / Buy" : types.includes("rent") ? "Rent" : "Buy";
            return <li className="watch-offer" key={offer.id}>
              <div className="watch-provider-identity">
                {offer.logoPath ? <Image src={imageUrl(offer.logoPath, "w92")!} alt="" width={44} height={44} /> : <span className="provider-initial" aria-hidden="true">{offer.name.slice(0, 1)}</span>}
                <div><h3>{offer.name}</h3><p>{OFFER_TYPES.filter(type => types.includes(type.key)).map(type => type.label).join(" · ")}</p></div>
              </div>
              {providers?.link ? <a className="watch-action" href={providers.link} target="_blank" rel="noopener noreferrer" aria-label={`${action} for ${offer.name} on TMDB (opens in a new tab)`} aria-describedby="watch-destination">{action} <span aria-hidden="true">↗</span></a> : <span className="watch-link-unavailable">Link unavailable</span>}
            </li>;
          })}
        </ul> : <p className="availability-status">No {filters.find(item => item.key === filter)?.label.toLowerCase()} options are reported for this title in {country.name}. Try another filter.</p>}
        {providers?.link ? <p className="watch-note" id="watch-destination">Actions open this title’s TMDB watch page for {country.name}, where you can choose a provider. Confirm current availability and pricing there.</p> : null}
      </> : <div className="availability-status"><p>No streaming, rental or purchase options are currently reported for this title in {country.name}.</p><p>Availability can change. Try another country or check back later.</p></div>}
    <p className="watch-attribution">Availability data from <a href="https://www.justwatch.com/" target="_blank" rel="noopener noreferrer">JustWatch</a> via <a href="https://www.themoviedb.org/" target="_blank" rel="noopener noreferrer">TMDB</a>.</p>
  </section>;
}
