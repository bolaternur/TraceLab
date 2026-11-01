export async function register() {
  // Building an artifact must not require production secrets or change local development settings.
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.NEXT_PHASE !== "phase-production-build") {
    const { assertProductionConfiguration } = await import("@/server/runtime-config");
    assertProductionConfiguration();
  }
}
