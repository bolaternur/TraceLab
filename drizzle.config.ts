import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Match Next.js local env precedence: .env.local first, then .env as fallback.
config({ path: ".env.local", override: false });
config({ path: ".env", override: false });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for Drizzle commands");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  dbCredentials: { url: databaseUrl },
});
