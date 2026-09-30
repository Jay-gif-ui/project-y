export type Country = { code: string; name: string; flag: string; tmdbRegion: string; locale: string; enabled: boolean };
export const DEFAULT_COUNTRY_CODE = "IN";
export const COUNTRY_PREFERENCE_COOKIE = "ifynex_country";
export const COUNTRY_PREFERENCE_STORAGE_KEY = "ifynex.current-country";
// Add future markets here; discovery and onboarding share this configuration.
export const COUNTRIES: readonly Country[] = [
  { code: "IN", name: "India", flag: "🇮🇳", tmdbRegion: "IN", locale: "en-IN", enabled: true },
  { code: "GB", name: "United Kingdom", flag: "🇬🇧", tmdbRegion: "GB", locale: "en-GB", enabled: true },
  { code: "US", name: "United States", flag: "🇺🇸", tmdbRegion: "US", locale: "en-US", enabled: true },
];
export const ENABLED_COUNTRIES = COUNTRIES.filter(country => country.enabled);
export function getCountry(code?: string | null): Country {
  return ENABLED_COUNTRIES.find(country => country.code === code?.toUpperCase()) ?? ENABLED_COUNTRIES.find(country => country.code === DEFAULT_COUNTRY_CODE)!;
}
export function isEnabledCountryCode(code?: string | null): code is string {
  return Boolean(code && ENABLED_COUNTRIES.some(country => country.code === code.toUpperCase()));
}
export function resolveAccountCountry(profileCode: unknown, signupCode: unknown): string | null {
  for (const code of [profileCode, signupCode]) {
    if (typeof code === "string" && isEnabledCountryCode(code)) return code.toUpperCase();
  }
  return null;
}

