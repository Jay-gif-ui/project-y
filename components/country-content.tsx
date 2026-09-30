"use client";
import { useAuth } from "@/components/auth-provider";
import { useCountry } from "@/components/country-provider";
export function CountryContent({ region, children }: { region: string; children: React.ReactNode }) {
  const { country, loading, refreshing } = useCountry();
  const { user } = useAuth();
  const updating = refreshing || country.code !== region || Boolean(user && loading);
  if (updating) return <div className="country-updating shell" role="status" aria-busy="true"><p>Finding titles for {loading ? "your country" : country.name}…</p><div className="shelf-skeleton">{[0, 1, 2, 3].map(index => <div key={index} />)}</div></div>;
  return children;
}

