"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { getSupabaseBrowserClient, supabaseConfigured } from "@/lib/supabase-browser";

export function PasswordRecoveryRequest() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault(); setError(""); setMessage("");
    if (!/^\S+@\S+\.\S+$/.test(email)) { setError("Enter a valid email address."); return; }
    const supabase = getSupabaseBrowserClient();
    if (!supabaseConfigured() || !supabase) { setError("Authentication has not been configured yet."); return; }
    setLoading(true);
    const { error: requestError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
    setLoading(false);
    if (requestError) { setError(/rate limit/i.test(requestError.message) ? "Too many email requests. Please wait a few minutes before trying again." : "We could not send a reset email. Please try again later."); return; }
    setMessage("If an account exists for this email, a password-reset link has been sent. Check Inbox, Spam and Promotions.");
  }

  return <main className="auth-page shell"><section className="auth-card"><p className="eyebrow">Account recovery</p><h1>Reset your password</h1><p>Enter your email and we&apos;ll send a secure reset link.</p><form onSubmit={submit}><label>Email<input type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" required /></label>{error ? <p className="form-error" role="alert">{error}</p> : null}{message ? <p className="form-message" role="status">{message}</p> : null}<button className="primary-link" disabled={loading}>{loading ? "Sending…" : "Send reset link"}</button></form><p className="auth-switch"><Link href="/login">Back to sign in</Link></p></section></main>;
}
