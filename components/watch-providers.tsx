"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { imageUrl, type MediaType, type Provider } from "@/lib/media";
import type { TitleAvailability } from "@/lib/tmdb";
import { OFFER_TYPES, providerAction, providerClickDetail, PROVIDER_CLICK_EVENT, type OfferType } from "@/lib/watch-providers";
import type { Country } from "@/lib/countries";
import { CountrySelector } from "@/components/country-selector";
import { useCountry } from "@/components/country-provider";

type Props = { mediaType: MediaType; titleId: number; initialAvailability: TitleAvailability; initialRegion: string };
type Availability = Partial<TitleAvailability> & { loading: boolean };
const emptyMessage = {
  flatrate: "No streaming availability currently reported by TMDB.",
  rent: "No rental offer currently reported by TMDB.",
  buy: "No purchase offer currently reported by TMDB.",
  free: "No free offers currently reported by TMDB.",
  ads: "No ad-supported offers currently reported by TMDB.",
};

export function WatchProviders(props: Props) {
  const { country } = useCountry();
  return <CountryAvailability key={`${props.mediaType}:${props.titleId}:${country.code}`} {...props} country={country} />;
}

function CountryAvailability({ mediaType, titleId, initialAvailability, initialRegion, country }: Props & { country: Country }) {
  const [retry, setRetry] = useState(0);
  const [availability, setAvailability] = useState<Availability>(() => country.code === initialRegion
    ? { ...initialAvailability, loading: false } : { loading: true });
  useEffect(() => {
    if (country.code === initialRegion && retry === 0) {
      setAvailability({ ...initialAvailability, loading: false });
      return;
    }
    let active = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 35_000);
    setAvailability({ loading: true });
    fetch(`/api/title/${mediaType}/${titleId}/providers?region=${country.tmdbRegion}`, { cache: "no-store", signal: controller.signal })
      .then(async response => {
        const payload = await response.json() as TitleAvailability & { region?: string };
        if (!response.ok || payload.region !== country.code) throw new Error("Availability unavailable");
        if (active) setAvailability({ ...payload, loading: false });
      })
      .catch(() => { if (active) setAvailability({ loading: false, providerError: true, theatricalError: mediaType === "movie" }); })
      .finally(() => clearTimeout(timeout));
    return () => { active = false; clearTimeout(timeout); controller.abort(); };
  }, [country.code, country.tmdbRegion, initialRegion, initialAvailability, mediaType, titleId, retry]);

  const { providers, theatrical, loading, providerError, theatricalError } = availability;
  const groups = OFFER_TYPES.map(type => ({ ...type, providers: providers?.[type.key] ?? [] }))
    .filter(group => ["flatrate", "rent", "buy"].includes(group.key) || group.providers.length);
  const hasMissingLinks = groups.some(group => group.providers.some(provider => !providerAction(provider, group.key)));
  const hasFreeStreaming = Boolean(providers?.free.length || providers?.ads.length);
  const date = theatrical ? new Date(`${theatrical.date}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "";
  function trackProviderClick(provider: Provider, actionType: OfferType) {
    window.dispatchEvent(new CustomEvent(PROVIDER_CLICK_EVENT, {
      detail: providerClickDetail({ titleId, mediaType, country: country.code, provider, actionType }),
    }));
  }
  return <section className="detail-section watch-section" id="where-to-watch" aria-labelledby="watch-title" aria-busy={loading}>
    <div className="detail-section-heading">
      <div><p className="eyebrow">{mediaType === "movie" ? "Theatres, streaming, rental & purchase" : "Streaming, rental & purchase"}</p><h2 id="watch-title">Where to Watch in {country.name} <span className="watch-country-flag">{country.flag}</span></h2></div>
      <CountrySelector />
    </div>
    {loading ? <p className="availability-status" role="status">Checking availability in {country.name}…</p> : <>
      <div className="watch-category-list">
        {mediaType === "movie" ? <section className="watch-category" aria-labelledby="watch-theatrical">
          <h3 id="watch-theatrical">{theatrical?.status === "upcoming" ? `Coming to Theatres in ${country.name}` : theatrical ? `Released in Theatres in ${country.name}` : "Theatrical release"}</h3>
          {theatricalError ? <p className="watch-note" role="alert">We couldn’t load theatrical release dates for {country.name}.</p>
            : theatrical ? <><p>{theatrical.status === "upcoming" ? `Releases in ${country.name} on ` : `Released in ${country.name} on `}<time dateTime={theatrical.date}>{date}</time></p><p className="watch-note">TMDB theatrical release record. Current cinema screenings and showtimes are not confirmed.</p></>
            : <p className="watch-note">No theatrical release date currently reported by TMDB for {country.name}.</p>}
        </section> : null}
        {providerError ? <div className="availability-status" role="alert"><p>We couldn’t load streaming, rental or purchase offers for {country.name}.</p></div>
          : groups.map(group => <section className="watch-category" key={group.key} aria-labelledby={`watch-${group.key}`}>
            <h3 id={`watch-${group.key}`}>{group.label}</h3>
            {!group.providers.length ? <p className="watch-note">{group.key === "flatrate" && hasFreeStreaming ? "No subscription streaming offer currently reported by TMDB. See free streaming offers below." : emptyMessage[group.key]}</p>
              : <ul className="watch-offers">{group.providers.map(provider => {
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
              })}</ul>}
          </section>)}
      </div>
      {providerError || theatricalError ? <button type="button" className="secondary-link" onClick={() => setRetry(value => value + 1)}>Try again</button> : null}
      {!providerError && groups.some(group => group.providers.length) ? <p className="watch-note">Provider links open a supplied destination or the service’s official website. A title-specific page may not be available.</p> : null}
      {hasMissingLinks ? <p className="watch-note">Some offers have no supplied destination or verified official homepage, so those providers cannot be opened.</p> : null}
      {!providerError && providers?.link ? <details className="watch-reference"><summary>Availability reference</summary><a href={providers.link} target="_blank" rel="noopener noreferrer">Check this title’s availability on TMDB ↗</a><p>Reference only — TMDB is not a streaming service.</p></details> : null}
    </>}
    <p className="watch-attribution">{mediaType === "movie" ? "Release dates: TMDB. " : ""}Streaming, rental and purchase data: JustWatch via TMDB.</p>
  </section>;
}
