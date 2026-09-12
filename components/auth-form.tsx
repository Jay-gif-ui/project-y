"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient, supabaseConfigured } from "@/lib/supabase-browser";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter(); const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [loading, setLoading] = useState(false); const [message, setMessage] = useState(""); const [error, setError] = useState("");
  const signup = mode === "signup";
  const callbackUrl = typeof window === "undefined" ? "" : `${window.location.origin}/auth/callback?next=/`;
  function friendlyError(value: string) {
    if (/rate limit/i.test(value)) return "Too many confirmation emails were requested. Please wait a few minutes, check Spam/Promotions, then try once more.";
    if (/email not confirmed/i.test(value)) return "Please confirm your email first. Check Inbox, Spam and Promotions for the latest Project Y email.";
    if (/invalid login credentials/i.test(value)) return "Email or password is incorrect.";
    return value;
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setMessage("");
    if (!supabaseConfigured()) { setError("Authentication has not been configured yet."); return; }
    if (!/^\S+@\S+\.\S+$/.test(email)) { setError("Enter a valid email address."); return; }
    if (password.length < 8) { setError("Password must contain at least 8 characters."); return; }
    setLoading(true); const supabase = getSupabaseBrowserClient();
    if (!supabase) { setError("Authentication has not been configured yet."); setLoading(false); return; }
    const result = signup ? await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/` } }) : await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (result.error) { setError(friendlyError(result.error.message)); return; }
    if (signup && !result.data.session) { setMessage("We sent one confirmation email. Check Inbox, Spam and Promotions, then open its link in this same browser."); return; }
    router.push("/"); router.refresh();
  }
  async function signInWithGoogle() {
    setError(""); setMessage(""); if (!supabaseConfigured()) { setError("Authentication has not been configured yet."); return; }
    const supabase = getSupabaseBrowserClient(); if (!supabase) return;
    setLoading(true); const { error: googleError } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: callbackUrl } });
    if (googleError) { setError(friendlyError(googleError.message)); setLoading(false); }
  }
  return <main className="auth-page shell"><section className="auth-card"><p className="eyebrow">Project Y account</p><h1>{signup ? "Create your account" : "Welcome back"}</h1><p>{signup ? "Save titles you want to watch and return to them anytime." : "Sign in to explore title details and your wishlist."}</p><button type="button" className="google-button" onClick={signInWithGoogle} disabled={loading}><span>G</span>Continue with Google</button><div className="auth-divider"><span>or continue with email</span></div><form onSubmit={submit}><label>Email<input type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" required /></label><label>Password<input type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete={signup ? "new-password" : "current-password"} minLength={8} required /></label>{error ? <p className="form-error" role="alert">{error}</p> : null}{message ? <p className="form-message" role="status">{message}</p> : null}<button className="primary-link" disabled={loading}>{loading ? "Please wait…" : signup ? "Create account" : "Sign in"}</button></form><p className="auth-switch">{signup ? "Already have an account?" : "New to Project Y?"} <Link href={signup ? "/login" : "/signup"}>{signup ? "Sign in" : "Create one"}</Link></p></section></main>;
}
