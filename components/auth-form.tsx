"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseBrowserClient, supabaseConfigured } from "@/lib/supabase-browser";
import { passwordValidationError } from "@/lib/password-policy";

const RESEND_COOLDOWN_SECONDS = 60;

function friendlyError(value: string) {
  if (/rate limit|too many requests/i.test(value)) return "Too many requests. Please wait a little before requesting another email.";
  if (/email not confirmed/i.test(value)) return "Please confirm your email first. Check Inbox, Spam and Promotions for the latest Project Y email.";
  if (/invalid login credentials/i.test(value)) return "Email or password is incorrect.";
  if (/already registered|already exists/i.test(value)) return "This email is already registered. Please sign in instead.";
  if (/password/i.test(value) && /weak|least|short/i.test(value)) return "Choose a stronger password with at least 12 characters, including a letter and a number.";
  if (/network|fetch/i.test(value)) return "We could not reach the sign-in service. Check your connection and try again.";
  if (/provider.*not enabled|unsupported provider|google/i.test(value)) return "Google sign-in is not enabled yet. Please use email sign-in or finish the Google OAuth dashboard setup.";
  return "We couldn't complete that request. Please try again.";
}

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const signup = mode === "signup";
  const requestedNext = searchParams.get("next");
  const destination = requestedNext?.startsWith("/") && !requestedNext.startsWith("//") ? requestedNext : "/";
  const callbackUrl = typeof window === "undefined" ? "" : `${window.location.origin}/auth/callback?next=${encodeURIComponent(destination)}`;
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const timer = window.setTimeout(() => setResendSeconds((seconds) => seconds - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendSeconds]);

  function clearFeedback() { setError(""); setMessage(""); }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearFeedback();
    if (!supabaseConfigured()) { setError("Authentication has not been configured yet."); return; }
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) { setError("Enter a valid email address."); return; }
    if (signup) {
      const validationError = passwordValidationError(password);
      if (validationError) { setError(validationError); return; }
    } else if (!password) { setError("Enter your password."); return; }
    const supabase = getSupabaseBrowserClient();
    if (!supabase) { setError("Authentication has not been configured yet."); return; }
    setLoading(true);
    const result = signup
      ? await supabase.auth.signUp({ email: normalizedEmail, password, options: { emailRedirectTo: callbackUrl, data: name.trim() ? { full_name: name.trim() } : undefined } })
      : await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
    setLoading(false);
    if (result.error) { setError(friendlyError(result.error.message)); return; }
    if (signup && !result.data.session) {
      setAwaitingConfirmation(true);
      setResendSeconds(RESEND_COOLDOWN_SECONDS);
      setMessage(`We sent a confirmation link to ${normalizedEmail}. Open it in this browser to activate your account.`);
      return;
    }
    router.replace(destination);
    router.refresh();
  }

  async function resendConfirmation() {
    if (loading || resendSeconds > 0) return;
    clearFeedback();
    const supabase = getSupabaseBrowserClient();
    if (!supabase) { setError("Authentication has not been configured yet."); return; }
    setLoading(true);
    const result = await supabase.auth.resend({ type: "signup", email: email.trim().toLowerCase(), options: { emailRedirectTo: callbackUrl } });
    setLoading(false);
    if (result.error) { setError(friendlyError(result.error.message)); return; }
    setResendSeconds(RESEND_COOLDOWN_SECONDS);
    setMessage("A new confirmation email has been sent. Check Inbox, Spam and Promotions.");
  }

  async function signInWithGoogle() {
    clearFeedback();
    if (!supabaseConfigured()) { setError("Authentication has not been configured yet."); return; }
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    setLoading(true);
    const { error: googleError } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: callbackUrl } });
    if (googleError) { setError(friendlyError(googleError.message)); setLoading(false); }
  }

  if (signup && awaitingConfirmation) {
    return <main className="auth-page shell"><section className="auth-card"><p className="eyebrow">Project Y account</p><h1>Confirm your email</h1><p>We sent a secure confirmation link to <strong>{email.trim().toLowerCase()}</strong>. Open it in this browser to activate your account.</p>{error ? <p className="form-error" role="alert">{error}</p> : null}{message ? <p className="form-message" role="status">{message}</p> : null}<div className="otp-actions"><button type="button" className="text-button" onClick={resendConfirmation} disabled={loading || resendSeconds > 0}>{resendSeconds > 0 ? `Resend email in ${resendSeconds}s` : "Didn't receive it? Resend confirmation email"}</button><button type="button" className="text-button" onClick={() => { setAwaitingConfirmation(false); clearFeedback(); }} disabled={loading}>Use a different email</button><Link className="text-link" href={`/login?next=${encodeURIComponent(destination)}`}>Already confirmed? Sign in</Link></div></section></main>;
  }

  return <main className="auth-page shell"><section className="auth-card"><p className="eyebrow">Project Y account</p><h1>{signup ? "Create your account" : "Welcome back"}</h1><p>{signup ? "Save titles you want to watch and return to them anytime." : "Sign in to explore title details and your wishlist."}</p><button type="button" className="google-button" onClick={signInWithGoogle} disabled={loading}><span>G</span>Continue with Google</button><div className="auth-divider"><span>or continue with email</span></div><form onSubmit={submit}>{signup ? <label>Name <span className="optional-label">(optional)</span><input type="text" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" maxLength={80} /></label> : null}<label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label><label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={signup ? "new-password" : "current-password"} minLength={signup ? 12 : undefined} required /></label>{signup ? <p className="input-help">Use at least 12 characters, including a letter and a number.</p> : null}{error ? <p className="form-error" role="alert">{error}</p> : null}{message ? <p className="form-message" role="status">{message}</p> : null}<button className="primary-link" disabled={loading}>{loading ? "Please wait…" : signup ? "Create account" : "Sign in"}</button></form>{!signup ? <Link className="forgot-link" href="/forgot-password">Forgot password?</Link> : null}<p className="auth-switch">{signup ? "Already have an account?" : "New to Project Y?"} <Link href={`${signup ? "/login" : "/signup"}?next=${encodeURIComponent(destination)}`}>{signup ? "Sign in" : "Create one"}</Link></p></section></main>;
}
