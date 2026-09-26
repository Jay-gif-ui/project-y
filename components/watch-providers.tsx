"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { imageUrl, type MediaType, type WatchProviders as ProviderData } from "@/lib/media";
import { OFFER_TYPES, providerAction, providerClickDetail, PROVIDER_CLICK_EVENT, type OfferType } from "@/lib/watch-providers";
import type { Provider } from "@/lib/media";
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

export function WatchProviders(props: Props) {
  const { country } = useCountry();
  // A country/title switch discards the previous country's rows and destinations immediately.
  return <CountryAvailability key={`${props.mediaType}:${props.titleId}:${country.code}`} {...props} country={country} />;
}

function CountryAvailability({ mediaType, titleId, initialProviders, initialRegion, initialError, country }: Props & { country: Country }) {
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
  const groups = OFFER_TYPES.map(type => ({ ...type, providers: providers?.[type.key] ?? [] })).filter(group => group.providers.length);
  const hasMissingLinks = groups.some(group => group.providers.some(provider => !providerAction(provider, group.key)));
  function trackProviderClick(provider: Provider, actionType: OfferType) {
    // Local integration hook only: no analytics requests, cookies or affiliate rewriting.
    window.dispatchEvent(new CustomEvent(PROVIDER_CLICK_EVENT, {
      detail: providerClickDetail({ titleId, mediaType, country: country.code, provider, actionType }),
    }));
  }
  return <section className="detail-section watch-section" id="where-to-watch" aria-labelledby="watch-title" aria-busy={loading}>
    <div className="detail-section-heading">
      <div><p className="eyebrow">Streaming, rental & purchase</p><h2 id="watch-title">Where to Watch in {country.name} <span className="watch-country-flag">{country.flag}</span></h2></div>
      <CountrySelector />
    </div>
    {loading ? <p className="availability-status" role="status">Checking availability in {country.name}…</p>
      : error ? <div className="availability-status" role="alert"><p>We couldn’t load availability for {country.name}. Please try again.</p><button type="button" className="secondary-link" onClick={() => setRetry(value => value + 1)}>Try again</button></div>
      : groups.length ? <>
        <div className="watch-category-list">{groups.map(group => <section className="watch-category" key={group.key} aria-labelledby={`watch-${group.key}`}>
          <h3 id={`watch-${group.key}`}>{group.label}</h3>
          <ul className="watch-offers">{group.providers.map(provider => {
            const action = providerAction(provider, group.key);
            const content = <>
              <div className="watch-provider-identity">
                {provider.logoPath ? <Image src={imageUrl(provider.logoPath, "w92")!} alt="" width={44} height={44} /> : <span className="provider-initial" aria-hidden="true">{provider.name.slice(0, 1)}</span>}
                <div><h4>{provider.name}</h4><p>{group.key === "flatrate" ? "Subscription" : group.label}</p></div>
              </div>
              {action ? <span className="watch-action">{action.label} <span aria-hidden="true">↗</span></span> : <span className="watch-link-unavailable">Provider link unavailable</span>}
            </>;
            return <li className="watch-offer" key={provider.id}>{action
              ? <a className="watch-offer-content" href={action.href} target="_blank" rel="noopener noreferrer" aria-label={`${action.label} (opens in a new tab)`} onClick={() => trackProviderClick(provider, group.key)} onAuxClick={event => { if (event.button === 1) trackProviderClick(provider, group.key); }}>{content}</a>
              : <div className="watch-offer-content">{content}</div>}</li>;
          })}</ul>
        </section>)}</div>
        {hasMissingLinks ? <p className="watch-note">TMDB reports availability on these services, but has not supplied a provider destination for every offer. Offers without a destination cannot be opened.{providers?.link ? " You can check the availability reference below." : ""}</p> : null}
      </> : <div className="availability-status"><p>Streaming availability not found in {country.name}.</p><p>TMDB currently reports no streaming, rental or purchase offers for this title. A theatrical release may still be available; missing streaming data does not mean the title is unreleased.</p></div>}
    {!loading && !error && providers?.link ? <details className="watch-reference"><summary>Availability reference</summary><a href={providers.link} target="_blank" rel="noopener noreferrer">Check this title’s availability on TMDB ↗</a><p>Reference only — TMDB is not a streaming service.</p></details> : null}
    <p className="watch-attribution">Availability data: JustWatch via TMDB.</p>
  </section>;
}
