"use client";
import Image from "next/image";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useRef, useState } from "react";
import { MenuIcon, SearchIcon } from "@/components/icons";
import { Brand } from "@/components/brand";
import { SearchForm } from "@/components/search-form";
import { useAuth } from "@/components/auth-provider";
import { CountrySelector } from "@/components/country-selector";

const navigation = [{ name: "Home", href: "/" }, { name: "Movies", href: "/country/trending?type=movie" }, { name: "TV Shows", href: "/country/trending?type=tv" }, { name: "Discover", href: "/#discover" }];
export function Navbar() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter(), pathname = usePathname();
  const mobile = useRef<HTMLDetailsElement>(null);
  const [signingOut, setSigningOut] = useState(false);
  async function handleSignOut() {
    setSigningOut(true);
    try { await signOut(); if (mobile.current) mobile.current.open = false; router.replace("/"); router.refresh(); }
    finally { setSigningOut(false); }
  }
  const accountLinks = user ? <><Link href="/wishlist">My wishlist</Link><button onClick={handleSignOut} disabled={signingOut}>{signingOut ? "Signing out…" : "Sign out"}</button></> : <><Link href="/login">Sign in</Link><Link href="/signup">Create account</Link></>;
  return <header className="site-header ifynex-header"><a className="skip-link" href="#main-content">Skip to content</a>
    <nav className="navbar shell" aria-label="Main navigation"><Brand />
      <div className="nav-links">{navigation.map(item => <Link key={item.name} href={item.href} prefetch={false} aria-current={item.href === pathname ? "page" : undefined}>{item.name}</Link>)}</div>
      <div className="nav-search"><SearchForm /></div>
      <div className="nav-actions">
        <Link className="compact-search" href="/search" aria-label="Search movies and TV shows"><SearchIcon /></Link>
        <CountrySelector compact />
        <Link className="icon-button" href="/wishlist" aria-label="Your wishlist" title="Your wishlist"><Image src="/figma/heart.png" alt="" width={35} height={35} /></Link>
        <details className="account-menu"><summary className="icon-button" aria-label={user ? "Your account" : "Sign in or create an account"}><Image src="/figma/account.png" alt="" width={30} height={30} /></summary><div className="account-menu-panel">{loading ? <span>Loading account…</span> : accountLinks}</div></details>
      </div>
      <details className="mobile-menu" ref={mobile}><summary aria-label="Open navigation"><MenuIcon /></summary>
        <div className="mobile-menu-panel" onClick={event => { if ((event.target as HTMLElement).closest("a") && mobile.current) mobile.current.open = false; }}>
          {navigation.map(item => <Link key={item.name} href={item.href} prefetch={false}>{item.name}</Link>)}
          <Link href="/search">Search</Link>{accountLinks}
        </div>
      </details>
    </nav>
  </header>;
}

