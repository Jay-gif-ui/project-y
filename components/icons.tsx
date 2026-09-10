import type { SVGProps } from "react";
type IconProps = SVGProps<SVGSVGElement>;
export function SearchIcon(props: IconProps) { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" {...props}><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" strokeLinecap="round" /></svg>; }
export function MenuIcon(props: IconProps) { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" {...props}><path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" /></svg>; }
export function PlayIcon(props: IconProps) { return <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}><path d="M8 5.5v13l10-6.5-10-6.5Z" /></svg>; }
export function ArrowIcon(props: IconProps) { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" {...props}><path d="M5 12h13M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>; }
