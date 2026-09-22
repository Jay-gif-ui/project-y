"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { MenuIcon, SearchIcon } from "@/components/icons";
import { useAuth } from "@/components/auth-provider";
import { CountrySelector } from "@/components/country-selector";
const navigation = ["Home", "Movies", "TV Shows", "Discover"];
const hrefFor = (item: string) => item === "Home" ? "/" : `#${item.toLowerCase().replaceAll(" ", "-")}`;
export function Navbar() { const { user, loading, signOut } = useAuth(); const router = useRouter(); async function handleSignOut() { await signOut(); router.replace("/"); router.refresh(); } const account = loading ? null : user ? <><Link href="/wishlist">Wishlist</Link><button className="sign-in" onClick={handleSignOut}>Log out</button></> : <><Link className="sign-in" href="/login">Sign in</Link><Link className="sign-up-link" href="/signup">Sign up</Link></>; return <header className="site-header"><nav className="shell navbar" aria-label="Main navigation"><Link className="brand" href="/" aria-label="Project Y home">PROJECT<span>Y</span></Link><div className="nav-links">{navigation.map((item) => <Link key={item} href={hrefFor(item)}>{item}</Link>)}</div><div className="nav-actions"><CountrySelector /><Link className="icon-button" href="/search" aria-label="Search"><SearchIcon /></Link>{account}</div><details className="mobile-menu"><summary aria-label="Open navigation"><MenuIcon /></summary><div className="mobile-menu-panel"><CountrySelector />{navigation.map((item) => <Link key={item} href={hrefFor(item)}>{item}</Link>)}{account}</div></details></nav></header>; }
