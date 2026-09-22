"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { COUNTRY_PREFERENCE_COOKIE, COUNTRY_PREFERENCE_STORAGE_KEY, DEFAULT_COUNTRY_CODE, isEnabledCountryCode } from "@/lib/countries";

export default function AuthCallbackPage() {
  const router = useRouter(); const searchParams = useSearchParams(); const [message, setMessage] = useState("Signing you in…");
  useEffect(() => {
    const supabase = getSupabaseBrowserClient(); const code = searchParams.get("code"); const next = searchParams.get("next"); const destination = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
    if (!supabase) { setMessage("Authentication has not been configured yet."); return; }
    const client = supabase;
    async function completeSession() { const { data: { user } } = await client.auth.getUser(); if (user) { const metadataCountry = user.user_metadata.country_code; const countryCode = typeof metadataCountry === "string" && isEnabledCountryCode(metadataCountry) ? metadataCountry.toUpperCase() : DEFAULT_COUNTRY_CODE; const { data: existingProfile } = await client.from("profiles").select("user_id").eq("user_id", user.id).maybeSingle(); if (!existingProfile) { await client.from("profiles").insert({ user_id: user.id, name: typeof user.user_metadata.full_name === "string" ? user.user_metadata.full_name : null, country_code: countryCode }); window.localStorage.setItem(COUNTRY_PREFERENCE_STORAGE_KEY, countryCode); document.cookie = `${COUNTRY_PREFERENCE_COOKIE}=${countryCode}; Path=/; Max-Age=31536000; SameSite=Lax`; } } router.replace(destination); router.refresh(); }
    if (code) { client.auth.exchangeCodeForSession(code).then(({ error }) => { if (error) { setMessage("This sign-in link is invalid or has expired. Please request a new one."); return; } completeSession(); }); return; }
    const timer = window.setTimeout(() => client.auth.getSession().then(({ data }) => { if (data.session) completeSession(); else setMessage("This link is invalid, expired, or was opened in a different browser. Please request a new one."); }), 250);
    return () => window.clearTimeout(timer);
  }, [router, searchParams]);
  return <main className="auth-page shell"><section className="auth-card"><p className="eyebrow">Project Y account</p><h1>{message}</h1><p>Please keep this page open for a moment.</p></section></main>;
}
