import type { Metadata } from "next";
import { AuthProvider } from "@/components/auth-provider";
import { CountryProvider } from "@/components/country-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Project Y — Find something worth watching",
  description: "A cinematic guide to the movies and series worth your time.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
    >
      <body className="min-h-full"><AuthProvider><CountryProvider>{children}</CountryProvider></AuthProvider></body>
    </html>
  );
}
