// locale-wired
import { UiText } from "@/components/locale-provider";
import { requireTeam } from "@/server/auth";
import { updateSettings } from "@/server/actions";
import { isLocale } from "@/lib/i18n";
import { cookies } from "next/headers";
import { LanguageSelect } from "@/components/language-select";
import { ExportButton } from "../exports/export-button";
import { PageHeader, Section } from "@/components/ui";
import Link from "next/link";
import { SecureSignOut } from "@/components/secure-sign-out";

export default async function SettingsPage() {
  const ctx = await requireTeam();
  const rawLocale = (await cookies()).get("pt_lang")?.value ?? ctx.user.locale;
  const locale = isLocale(rawLocale) ? rawLocale : "en";
  const s = (ctx.user.settings ?? {}) as Record<string, boolean>;
  return (
    <div className="fade-in mx-auto max-w-2xl">
      <PageHeader title="Settings" subtitle="Profile, language, notification preferences and your personal data controls." />
      <Section title="Profile">
        <form action={updateSettings} className="card space-y-3 p-4 text-sm">
          <label className="block">
            <span className="label"><UiText text="Display name" /></span>
            <input name="displayName" className="input" defaultValue={ctx.user.displayName} required maxLength={80} />
          </label>
          <label className="block">
            <span className="label"><UiText text="Age category (optional — never an exact birth date)" /></span>
            <select name="ageCategory" className="select" defaultValue={ctx.user.ageCategory}>
              <option value="unspecified"><UiText text="Prefer not to say" /></option>
              <option value="under_13"><UiText text="Under 13" /></option>
              <option value="13_17">13–17</option>
              <option value="adult">18+</option>
            </select>
          </label>
          <fieldset>
            <legend className="label"><UiText text="Notifications" /></legend>
            {[
              ["notifyExports", "Export ready"],
              ["notifyPolicy", "Competition policy updates"],
              ["notifyGaps", "Tests missing a decision (weekly at most)"],
            ].map(([k, l]) => (
              <label key={k} className="flex items-center gap-2">
                <input type="checkbox" name={k} defaultChecked={s[k] !== false} /> <UiText text={l} />
              </label>
            ))}
          </fieldset>
          <button className="btn btn-primary"><UiText text="Save" /></button>
        </form>
      </Section>
      <Section title="Language">
        <div className="card p-4"><LanguageSelect locale={locale} /></div>
      </Section>
      <Section title="Your data">
        <div className="card space-y-3 p-4 text-sm">
          <p className="text-text-2"><UiText text="You can export your own contribution evidence at any time, regardless of the organization's plan. Team evidence belongs to the team; your authorship on it is preserved even after you leave." /></p>
          <ExportButton type="personal_contribution" label="Export my contribution package (JSON)" />
          <p className="hint"><UiText text="Account deletion and organization-level retention are handled by your team lead / organization admin (see " /><Link href="/app/org" className="text-blueprint"><UiText text="Organization" /></Link><UiText text=") and documented in PRIVACY.md. " /></p>
        </div>
      </Section>
      <Section title="Session">
        <div className="card space-y-2 p-4 text-sm">
          <p className="text-text-2"><UiText text="Signing out clears queued offline captures and cached browser data on this device." /></p>
          <SecureSignOut />
        </div>
      </Section>
    </div>
  );
}
