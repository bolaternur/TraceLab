import Link from "next/link";
import { brand } from "@/lib/brand";
import { LOCALE_LABELS, LOCALES, type Locale } from "@/lib/i18n";
import { setLocale } from "@/server/actions";
import { TraceMark } from "@/components/tracelab/brand-mark";

export function PublicNav({ signedIn, locale }: { signedIn: boolean; locale: Locale }) {
  return (
    <nav className="sticky top-0 z-50 border-b border-border-subtle bg-surface/90 backdrop-blur-xl" aria-label="Primary">
      <div className="mx-auto flex min-h-16 max-w-[1280px] items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" className="flex min-h-11 items-center gap-2.5 rounded-full pr-2 font-semibold">
          <span className="grid h-9 w-9 place-items-center rounded-[12px] border border-border-subtle bg-canvas text-blueprint"><TraceMark width={25} height={25} /></span>
          <span className="hidden sm:inline">{brand.productName}</span>
        </Link>
        <div className="hidden items-center gap-6 text-sm text-text-2 lg:flex">
          <Link href="/#how" className="hover:text-ink">How it works</Link>
          <Link href="/showcase" className="hover:text-ink">Showcase</Link>
          <Link href="/research" className="hover:text-ink">Research</Link>
          <Link href="/trust" className="hover:text-ink">Trust</Link>
          <Link href="/pricing" className="hover:text-ink">Pricing</Link>
          <Link href="/docs" className="hover:text-ink">Docs</Link>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <form action={setLocale} className="hidden items-center sm:flex">
            <label className="sr-only" htmlFor="lang">Language</label>
            <select id="lang" name="locale" defaultValue={locale} className="select !min-h-11 !w-auto rounded-full !py-0 text-xs">
              {LOCALES.map((l) => <option key={l} value={l}>{LOCALE_LABELS[l]}</option>)}
            </select>
            <button className="trace-button ml-1 min-h-11 rounded-full px-3 text-xs" type="submit">Set</button>
          </form>
          {signedIn ? (
            <Link href="/app" className="trace-button trace-button-primary min-h-11 rounded-full px-4">Workspace</Link>
          ) : (
            <>
              <Link href="/auth?mode=signin" className="trace-button min-h-11 rounded-full px-3 sm:px-4">Sign in</Link>
              <Link href="/auth?mode=signup" className="trace-button trace-button-primary min-h-11 rounded-full px-3 sm:px-4"><span className="hidden sm:inline">Create account</span><span className="sm:hidden">Join</span></Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-8 text-xs text-text-3 md:flex-row md:items-center md:justify-between">
        <div>
          {brand.productName} — {brand.tagline} · Student engineering evidence platform. Commercial naming clearance remains pending.
        </div>
        <div className="max-w-xl">
          GitHub, Onshape, Telegram, Discord, FIRST®, FTC®, VEX®, RECF and ISEF are trademarks of their respective owners. Their use here describes integrations and competition
          programs only and does not imply endorsement, affiliation or certification.
        </div>
      </div>
    </footer>
  );
}
