import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import "./globals.css";
import { brand } from "@/lib/brand";
import { isLocale } from "@/lib/i18n";
import { PwaRegister } from "@/components/pwa-register";

export const metadata: Metadata = {
  title: { default: brand.productName, template: `%s · ${brand.productName}` },
  description: brand.tagline,
  manifest: "/manifest.webmanifest",
  applicationName: brand.productName,
  appleWebApp: { capable: true, title: brand.productName, statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f7f4" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1118" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const jar = await cookies();
  const lang = jar.get("pt_lang")?.value;
  return (
    <html lang={isLocale(lang) ? lang : "en"}>
      <body className="bg-canvas text-ink antialiased">
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
