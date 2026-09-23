import { cookies } from "next/headers";
import { COUNTRY_PREFERENCE_COOKIE } from "@/lib/countries";
import type { Metadata } from "next";
import { AuthProvider } from "@/components/auth-provider";
import { CountryProvider } from "@/components/country-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Project Y — Find something worth watching",
  description: "A cinematic guide to the movies and series worth your time.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const initialCountryCode = (await cookies()).get(COUNTRY_PREFERENCE_COOKIE)?.value;
  return (
    <html
      lang="en"
      className="h-full antialiased"
    >
      <body className="min-h-full"><AuthProvider><CountryProvider initialCountryCode={initialCountryCode}>{children}</CountryProvider></AuthProvider></body>
    </html>
  );
}
