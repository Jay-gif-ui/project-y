import { cookies } from "next/headers";
import { COUNTRY_PREFERENCE_COOKIE } from "@/lib/countries";
import type { Metadata } from "next";
import localFont from "next/font/local";
import { AuthProvider } from "@/components/auth-provider";
import { CountryProvider } from "@/components/country-provider";
import "./globals.css";

const poppins = localFont({ src: [
  { path: "../public/fonts/poppins-regular.ttf", weight: "400", style: "normal" },
  { path: "../public/fonts/poppins-medium.ttf", weight: "500", style: "normal" },
  { path: "../public/fonts/poppins-semibold.ttf", weight: "600", style: "normal" },
  { path: "../public/fonts/poppins-bold.ttf", weight: "700", style: "normal" },
], variable: "--font-poppins", display: "swap" });
const inter = localFont({ src: [
  { path: "../public/fonts/inter-regular.ttf", weight: "400", style: "normal" },
  { path: "../public/fonts/inter-extrabold.ttf", weight: "800", style: "normal" },
], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "iFynex — Your guide to movies, TV shows & streaming",
  description: "Discover what to watch, explore trending movies and TV shows, and find streaming options in India, the United Kingdom and the United States.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const initialCountryCode = (await cookies()).get(COUNTRY_PREFERENCE_COOKIE)?.value;
  return (
    <html
      lang="en"
      className={`${poppins.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full"><AuthProvider><CountryProvider initialCountryCode={initialCountryCode}>{children}</CountryProvider></AuthProvider></body>
    </html>
  );
}
