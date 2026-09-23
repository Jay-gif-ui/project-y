"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { COUNTRY_PREFERENCE_COOKIE, COUNTRY_PREFERENCE_STORAGE_KEY, getCountry, isEnabledCountryCode, type Country } from "@/lib/countries";
import { useAuth } from "@/components/auth-provider";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

type CountryValue = { country: Country; accountCountry: Country | null; setCountry: (code: string) => void; loading: boolean; refreshing: boolean };
const CountryContext = createContext<CountryValue | null>(null);

export function CountryProvider({ children, initialCountryCode }: { children: React.ReactNode; initialCountryCode?: string }) {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [countryCode, setCountryCode] = useState(() => getCountry(initialCountryCode).code);
  const [accountCountryCode, setAccountCountryCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, startTransition] = useTransition();
  const hasSavedPreference = useRef(isEnabledCountryCode(initialCountryCode));
  const initialized = useRef(false);
  const persist = useCallback((code: string) => {
    try { window.localStorage.setItem(COUNTRY_PREFERENCE_STORAGE_KEY, code); } catch { /* Cookies still work if browser storage is disabled. */ }
    document.cookie = `${COUNTRY_PREFERENCE_COOKIE}=${code}; Path=/; Max-Age=31536000; SameSite=Lax`;
  }, []);
  const applyCountry = useCallback((code: string) => {
    setCountryCode(code);
    persist(code);
    startTransition(() => router.refresh());
  }, [persist, router]);
  const setCountry = useCallback((code: string) => {
    if (!isEnabledCountryCode(code)) return;
    // Mark immediately so a pending profile lookup cannot replace a navbar choice.
    hasSavedPreference.current = true;
    applyCountry(code.toUpperCase());
  }, [applyCountry]);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    let saved: string | null = null;
    try { saved = window.localStorage.getItem(COUNTRY_PREFERENCE_STORAGE_KEY); } catch { /* Fall back to the server cookie. */ }
    if (!hasSavedPreference.current && isEnabledCountryCode(saved)) {
      hasSavedPreference.current = true;
      applyCountry(saved.toUpperCase());
    } else {
      persist(getCountry(initialCountryCode).code);
    }
    setLoading(false);
  }, [initialCountryCode, applyCountry, persist]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setAccountCountryCode(null); return; }
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    let active = true;
    supabase.from("profiles").select("country_code").eq("user_id", user.id).maybeSingle().then(({ data }) => {
      if (!active) return;
      const code = data && isEnabledCountryCode(data.country_code) ? data.country_code.toUpperCase() : null;
      setAccountCountryCode(code);
      if (code && !hasSavedPreference.current) {
        hasSavedPreference.current = true;
        applyCountry(code);
      }
    });
    return () => { active = false; };
  }, [authLoading, user, applyCountry]);
  const value = useMemo(() => ({ country: getCountry(countryCode), accountCountry: accountCountryCode ? getCountry(accountCountryCode) : null, setCountry, loading, refreshing }), [countryCode, accountCountryCode, setCountry, loading, refreshing]);
  return <CountryContext.Provider value={value}>{children}</CountryContext.Provider>;
}

export function useCountry() {
  const value = useContext(CountryContext);
  if (!value) throw new Error("useCountry must be used inside CountryProvider");
  return value;
}
