import { getAiProvider } from "@/modules/ai/provider";

/** Startup validation reads names/flags only and never reports configured secret values. */
export function assertProductionConfiguration(env: NodeJS.ProcessEnv = process.env) {
  if (env.NODE_ENV !== "production") return;
  const forbidden = [
    env.DEV_AUTH_BYPASS === "true", env.ENABLE_DEV_SIMULATOR === "true",
    env.BILLING_ADAPTER === "development", env.MAIL_TRANSPORT === "local", env.MAIL_PREVIEW_ENABLED === "true",
  ];
  if (forbidden.some(Boolean)) throw new Error("production_development_configuration_forbidden");
  // Disabled AI is valid; a selected but unusable provider must not silently fall back.
  getAiProvider(env);
}
