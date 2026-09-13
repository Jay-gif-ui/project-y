"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { passwordValidationError } from "@/lib/password-policy";

export function PasswordResetForm() {
  const router = useRouter(); const [password, setPassword] = useState(""); const [ready, setReady] = useState(false); const [loading, setLoading] = useState(false); const [error, setError] = useState("");
  useEffect(() => { const supabase = getSupabaseBrowserClient(); if (!supabase) return; const check = () => supabase.auth.getSession().then(({ data }) => setReady(Boolean(data.session))); check(); const { data: listener } = supabase.auth.onAuthStateChange(event => { if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") check(); }); return () => listener.subscription.unsubscribe(); }, []);
  async function submit(event: FormEvent) { event.preventDefault(); setError(""); const validationError = passwordValidationError(password); if (validationError) { setError(validationError); return; } const supabase = getSupabaseBrowserClient(); if (!supabase) { setError("Authentication has not been configured yet."); return; } setLoading(true); const { error: updateError } = await supabase.auth.updateUser({ password }); setLoading(false); if (updateError) { setError("This reset link is invalid or has expired. Request a new link and try again."); return; } router.replace("/"); router.refresh(); }
  return <main className="auth-page shell"><section className="auth-card"><p className="eyebrow">Account recovery</p><h1>Choose a new password</h1><p>{ready ? "Use at least 12 characters, including a letter and a number." : "Checking your secure reset link…"}</p>{ready ? <form onSubmit={submit}><label>New password<input type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="new-password" minLength={12} required /></label>{error ? <p className="form-error" role="alert">{error}</p> : null}<button className="primary-link" disabled={loading}>{loading ? "Updating…" : "Update password"}</button></form> : <p className="auth-switch"><Link href="/forgot-password">Request a new reset link</Link></p>}</section></main>;
}
