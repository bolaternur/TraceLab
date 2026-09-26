import { z } from "zod";

export const ENTITY_TYPES = ["source_event", "artifact", "iteration", "test", "decision", "subsystem", "project"] as const;
export const entityTypeSchema = z.enum(ENTITY_TYPES);
export type EntityType = z.infer<typeof entityTypeSchema>;

/** Accept only same-origin application paths. Protocol-relative and backslash forms are rejected. */
export function safeInternalPath(value: unknown, fallback = "/app"): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 2048) return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\") || /[\u0000-\u001f\u007f]/.test(value)) return fallback;
  try {
    const parsed = new URL(value, "https://internal.invalid");
    if (parsed.origin !== "https://internal.invalid") return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

export function devSimulatorEnabled(env: { NODE_ENV?: string; ENABLE_DEV_SIMULATOR?: string } = process.env): boolean {
  return env.NODE_ENV !== "production" && env.ENABLE_DEV_SIMULATOR === "true";
}

export function developmentBillingEnabled(env: { NODE_ENV?: string; BILLING_ADAPTER?: string } = process.env): boolean {
  return env.NODE_ENV !== "production" && env.BILLING_ADAPTER === "development";
}

export type TeamRole = "student" | "student_lead" | "coach";

/** A student lead can invite students/leads, but cannot mint a coach account. */
export function canInviteRole(actor: TeamRole | "org_admin" | "platform_admin", invited: TeamRole): boolean {
  if (actor === "platform_admin" || actor === "org_admin" || actor === "coach") return true;
  if (actor === "student_lead") return invited !== "coach";
  return false;
}
