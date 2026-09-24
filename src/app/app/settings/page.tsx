import { requireTeam } from "@/server/auth";
import { setLocale, updateSettings } from "@/server/actions";
import { LOCALES, LOCALE_LABELS } from "@/lib/i18n";
import { ExportButton } from "../exports/export-button";
import { PageHeader, Section } from "@/components/ui";
import Link from "next/link";

export default async function SettingsPage() {
  const ctx = await requireTeam();
  const s = (ctx.user.settings ?? {}) as Record<string, boolean>;
  return (
    <div className="fade-in mx-auto max-w-2xl">
      <PageHeader title="Settings" subtitle="Profile, language, notification preferences and your personal data controls." />
      <Section title="Profile">
        <form action={updateSettings} className="card space-y-3 p-4 text-sm">
          <label className="block">
            <span className="label">Display name</span>
            <input name="displayName" className="input" defaultValue={ctx.user.displayName} required maxLength={80} />
          </label>
          <label className="block">
            <span className="label">Age category (optional — never an exact birth date)</span>
            <select name="ageCategory" className="select" defaultValue={ctx.user.ageCategory}>
              <option value="unspecified">Prefer not to say</option>
              <option value="under_13">Under 13</option>
              <option value="13_17">13–17</option>
              <option value="adult">18+</option>
            </select>
          </label>
          <fieldset>
            <legend className="label">Notifications</legend>
            {[
              ["notifyExports", "Export ready"],
              ["notifyPolicy", "Competition policy updates"],
              ["notifyGaps", "Tests missing a decision (weekly at most)"],
            ].map(([k, l]) => (
              <label key={k} className="flex items-center gap-2">
                <input type="checkbox" name={k} defaultChecked={s[k] !== false} /> {l}
              </label>
            ))}
          </fieldset>
          <button className="btn btn-primary">Save</button>
        </form>
      </Section>
      <Section title="Language">
        <form action={setLocale} className="card flex items-center gap-2 p-4 text-sm">
          <select name="locale" className="select !w-auto" defaultValue={ctx.user.locale}>
            {LOCALES.map((l) => (
              <option key={l} value={l}>
                {LOCALE_LABELS[l]}
              </option>
            ))}
          </select>
          <button className="btn">Apply</button>
          <span className="hint">Official competition wording is never machine-translated without labeling.</span>
        </form>
      </Section>
      <Section title="Your data">
        <div className="card space-y-3 p-4 text-sm">
          <p className="text-text-2">You can export your own contribution evidence at any time, regardless of the organization&apos;s plan. Team evidence belongs to the team; your authorship on it is preserved even after you leave.</p>
          <ExportButton type="personal_contribution" label="Export my contribution package (JSON)" />
          <p className="hint">
            Account deletion and organization-level retention are handled by your team lead / organization admin (see <Link href="/app/org" className="text-blueprint">Organization</Link>) and documented in PRIVACY.md.
          </p>
        </div>
      </Section>
    </div>
  );
}
