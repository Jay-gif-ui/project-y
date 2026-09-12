"use client";

import Link from "next/link";
import { useAuth } from "@/components/auth-provider";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <main className="shell title-error"><p className="section-status">Checking your session…</p></main>;
  if (!user) return <main className="shell auth-gate"><p className="eyebrow">Project Y account</p><h1>Sign in to explore this title</h1><p>Full title details, availability and your wishlist are available with a free account.</p><div><Link className="primary-link" href="/login">Sign in</Link><Link className="secondary-link" href="/signup">Create account</Link><Link className="text-link" href="/">Continue browsing</Link></div></main>;
  return <>{children}</>;
}
