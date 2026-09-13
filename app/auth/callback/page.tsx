"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

export default function AuthCallbackPage() {
  const router = useRouter(); const searchParams = useSearchParams(); const [message, setMessage] = useState("Confirming your account…");
  useEffect(() => {
    const supabase = getSupabaseBrowserClient(); const code = searchParams.get("code"); const next = searchParams.get("next");
    const destination = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
    if (!supabase) { setMessage("Authentication has not been configured yet."); return; }
    if (code) { supabase.auth.exchangeCodeForSession(code).then(({ error }) => { if (error) { setMessage("This confirmation link is invalid or has expired. Please request a new one."); return; } router.replace(destination); router.refresh(); }); return; }
    const timer = window.setTimeout(() => supabase.auth.getSession().then(({ data }) => { if (data.session) { router.replace(destination); router.refresh(); } else setMessage("This link is invalid, expired, or was opened in a different browser. Please request a new one."); }), 250);
    return () => window.clearTimeout(timer);
  }, [router, searchParams]);
  return <main className="auth-page shell"><section className="auth-card"><p className="eyebrow">Project Y account</p><h1>{message}</h1><p>Please keep this page open for a moment.</p></section></main>;
}
