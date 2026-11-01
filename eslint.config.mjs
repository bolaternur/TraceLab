import { defineConfig, globalIgnores } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

export default defineConfig([
  // Keep the starter on the flat config export that actually runs under the pinned ESLint/Next toolchain.
  ...nextCoreWebVitals,
  // Generated presentation output is checked at its website/tracelab source.
  globalIgnores([".next/**", "public/_presentation/**", "out/**", "build/**", "next-env.d.ts"]),
  { files:["website/**/*.js","website/**/*.mjs"],rules:{
    // These are standalone HTML modules, not React routes: full document navigation is required.
    "@next/next/no-location-assign-relative-destination":"off",
  }},
]);
