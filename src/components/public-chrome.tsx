// locale-wired
import { UiText, UiElement } from "@/components/locale-provider";
import Link from "next/link";
import { cookies } from "next/headers";
import { brand } from "@/lib/brand";
import { isLocale, type Locale } from "@/lib/i18n";
import { LanguageSelect } from "@/components/language-select";
import { TraceMark } from "@/components/tracelab/brand-mark";

export async function PublicNav({ signedIn, locale: fallback }: { signedIn: boolean; locale: Locale }) {
  const raw = (await cookies()).get("pt_lang")?.value;
  const locale = isLocale(raw) ? raw : fallback;
  return (
    <UiElement as="nav" className="sticky top-0 z-50 border-b border-border-subtle bg-surface/90 backdrop-blur-xl" aria-label="Primary">
      <div className="mx-auto flex min-h-16 max-w-[1280px] items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" className="flex min-h-11 items-center gap-2.5 rounded-full pr-2 font-semibold">
          <span className="grid h-9 w-9 place-items-center rounded-[12px] border border-border-subtle bg-canvas text-blueprint"><TraceMark width={25} height={25} /></span>
          <span className="hidden sm:inline"><UiText text={brand.productName} /></span>
        </Link>
        <div className="hidden items-center gap-6 text-sm text-text-2 lg:flex">
          <Link href="/#how" className="hover:text-ink"><UiText text="How it works" /></Link>
          <Link href="/app/models" className="hover:text-ink"><UiText text="3D models" /></Link>
          <Link href="/research" className="hover:text-ink"><UiText text="Research" /></Link>
          <Link href="/trust" className="hover:text-ink"><UiText text="Trust" /></Link>
          <Link href="/pricing" className="hover:text-ink"><UiText text="Pricing" /></Link>
          <Link href="/docs" className="hover:text-ink"><UiText text="Docs" /></Link>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <LanguageSelect locale={locale} />
          {signedIn ? (
            <Link href="/app" className="trace-button trace-button-primary min-h-11 rounded-full px-4"><UiText text="Workspace" /></Link>
          ) : (
            <>
              <Link href="/auth?mode=signin" className="trace-button !hidden min-h-11 rounded-full px-3 sm:!inline-flex sm:px-4"><UiText text="Sign in" /></Link>
              <Link href="/auth?mode=signup" className="trace-button trace-button-primary min-h-11 rounded-full px-3 sm:px-4"><span className="hidden sm:inline"><UiText text="Create account" /></span><span className="sm:hidden"><UiText text="Join" /></span></Link>
            </>
          )}
        </div>
      </div>
    </UiElement>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-8 text-xs text-text-3 md:flex-row md:items-center md:justify-between">
        <div>
          <UiText text={brand.productName} /> — <UiText text={brand.tagline} /><UiText text="· Student engineering evidence platform. Commercial naming clearance remains pending. " /></div>
        <div className="max-w-xl"><UiText text="GitHub, Onshape, Telegram, Discord, FIRST®, FTC®, VEX®, RECF and ISEF are trademarks of their respective owners. Their use here describes integrations and competition programs only and does not imply endorsement, affiliation or certification. " /></div>
      </div>
    </footer>
  );
}
