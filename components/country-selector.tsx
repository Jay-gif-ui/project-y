"use client";
import Image from "next/image";
import { ENABLED_COUNTRIES } from "@/lib/countries";
import { useAuth } from "@/components/auth-provider";
import { useCountry } from "@/components/country-provider";
export function CountrySelector({ compact = false }: { compact?: boolean }) {
  const { country, setCountry, loading } = useCountry();
  const { user } = useAuth();
  if (loading) return <span className={`country-loading ${compact ? "compact" : ""}`} role="status" aria-label="Loading your country" />;
  const flag = <Image src={`/flags/${country.code.toLowerCase()}.svg`} width={28} height={21} alt={country.flag} unoptimized />;
  if (user) return <span className={`selected-country ${compact ? "compact" : ""}`} title={`Your country: ${country.name}`} aria-label={`Your country: ${country.name}`}>{flag}{compact ? null : country.name}</span>;
  return <label className={`country-selector ${compact ? "compact" : ""}`} title={`Browsing in ${country.name}`}>
    {compact ? flag : null}<span className="sr-only">Browsing country</span>
    <select value={country.code} onChange={event => setCountry(event.target.value)} aria-label="Browsing country">
      {ENABLED_COUNTRIES.map(item => <option key={item.code} value={item.code}>{item.name}</option>)}
    </select>
  </label>;
}

