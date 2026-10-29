import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import "./globals.css";
import "./fieldnotes.css";
import "./unified-ui.css";
import localFont from "next/font/local";
import { brand } from "@/lib/brand";
import { isLocale } from "@/lib/i18n";
import { PwaRegister } from "@/components/pwa-register";
import { LocaleProvider } from "@/components/locale-provider";

const plexSans = localFont({ src: "./fonts/PlexSans.ttf", variable: "--font-plex-sans", weight: "100 700", display: "swap" });
const plexMono = localFont({ src: "./fonts/PlexMono.ttf", variable: "--font-plex-mono", weight: "400", display: "swap", preload: false });

export const metadata: Metadata = {
  title: { default: brand.productName, template: `%s · ${brand.productName}` },
  description: brand.tagline,
  manifest: "/manifest.webmanifest",
  applicationName: brand.productName,
  icons: {
    icon: [{ url: "/brand/iznera-mark.svg", type: "image/svg+xml" }, { url: "/brand/iznera-icon-192.png", type: "image/png", sizes: "192x192" }],
    shortcut: "/brand/iznera-mark.svg",
    apple: "/brand/iznera-apple-touch.png",
  },
  appleWebApp: { capable: true, title: brand.productName, statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#0b0b0e",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const jar = await cookies();
  const lang = jar.get("pt_lang")?.value;
  return (
    <html lang={isLocale(lang) ? lang : "en"} className={`${plexSans.variable} ${plexMono.variable}`}>
      <body className="bg-canvas text-ink antialiased">
        <a href="#main" className="skip-link">
          {lang === "ru" ? "Перейти к содержимому" : lang === "kk" ? "Мазмұнға өту" : "Skip to content"}
        </a>
        <LocaleProvider locale={isLocale(lang) ? lang : "en"}>{children}</LocaleProvider>
        <PwaRegister />
      </body>
    </html>
  );
}
