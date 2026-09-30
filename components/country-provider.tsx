"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { COUNTRY_PREFERENCE_COOKIE, COUNTRY_PREFERENCE_STORAGE_KEY, getCountry, isEnabledCountryCode, resolveAccountCountry, type Country } from "@/lib/countries";
import { useAuth } from "@/components/auth-provider";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

type CountryValue = { country: Country; accountCountry: Country | null; setCountry: (code: string) => void; loading: boolean; refreshing: boolean };
const CountryContext = createContext<CountryValue | null>(null);

export function CountryProvider({ children, initialCountryCode }: { children: React.ReactNode; initialCountryCode?: string }) {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [countryCode, setCountryCode] = useState(() => getCountry(initialCountryCode).code);
  const currentCode = useRef(countryCode);
  const [account, setAccount] = useState<{ userId: string; code: string | null } | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [refreshing, startTransition] = useTransition();
  const persist = useCallback((code: string) => {
    try { window.localStorage.setItem(COUNTRY_PREFERENCE_STORAGE_KEY, code); } catch { /* The cookie remains available. */ }
    document.cookie = `${COUNTRY_PREFERENCE_COOKIE}=${code}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
  }, []);
  const applyCountry = useCallback((code: string) => {
    persist(code);
    if (currentCode.current === code) return;
    currentCode.current = code;
    setCountryCode(code);
    startTransition(() => router.refresh());
  }, [persist, router]);
  const setCountry = useCallback((code: string) => {
    // Signed-in discovery follows the saved onboarding/profile country.
    if (user || authLoading || !isEnabledCountryCode(code)) return;
    applyCountry(code.toUpperCase());
  }, [user, authLoading, applyCountry]);

  useEffect(() => {
    let saved: string | null = null;
    try { saved = window.localStorage.getItem(COUNTRY_PREFERENCE_STORAGE_KEY); } catch { /* Fall back to cookie. */ }
    applyCountry(isEnabledCountryCode(initialCountryCode) ? initialCountryCode.toUpperCase() : getCountry(saved).code);
    setInitialized(true);
  }, [initialCountryCode, applyCountry]);

  const userId = user?.id;
  const signupCountry = user?.user_metadata?.country_code;
  useEffect(() => {
    if (authLoading || !initialized || !userId) return;
    let active = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    async function reconcileProfile() {
      let profileCode: unknown;
      try {
        const supabase = getSupabaseBrowserClient();
        const result = await supabase?.from("profiles").select("country_code").eq("user_id", userId!).abortSignal(controller.signal).maybeSingle();
        profileCode = result?.data?.country_code;
      } catch { /* Signup metadata also records the user's country. */ }
      finally { clearTimeout(timeout); }
      if (!active) return;
      const code = resolveAccountCountry(profileCode, signupCountry);
      if (code) applyCountry(code);
      setAccount({ userId: userId!, code });
    }
    void reconcileProfile();
    return () => { active = false; clearTimeout(timeout); controller.abort(); };
  }, [authLoading, initialized, userId, signupCountry, applyCountry]);
  const accountCode = account?.userId === userId ? account?.code : null;
  const loading = authLoading || !initialized || Boolean(userId && account?.userId !== userId);
  const value = useMemo(() => ({ country: getCountry(countryCode), accountCountry: accountCode ? getCountry(accountCode) : null, setCountry, loading, refreshing }), [countryCode, accountCode, setCountry, loading, refreshing]);
  return <CountryContext.Provider value={value}>{children}</CountryContext.Provider>;
}
export function useCountry() {
  const value = useContext(CountryContext);
  if (!value) throw new Error("useCountry must be used inside CountryProvider");
  return value;
}

