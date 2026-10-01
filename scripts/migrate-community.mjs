import { config } from "dotenv";
import pg from "pg";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
const connection = new URL(process.env.DATABASE_URL);
if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(connection.hostname)) throw new Error("This helper only migrates the local development database.");
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query(`BEGIN;
    CREATE TABLE IF NOT EXISTS product_reviews (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      body text NOT NULL CHECK (length(btrim(body)) BETWEEN 10 AND 1500),
      rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
      created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS product_reviews_team_user_idx ON product_reviews(team_id,user_id);
    CREATE TABLE IF NOT EXISTS product_usage_days (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      day text NOT NULL CHECK (day ~ '^\\d{4}-\\d{2}-\\d{2}$')
    );
    CREATE UNIQUE INDEX IF NOT EXISTS product_usage_days_team_user_day_idx ON product_usage_days(team_id,user_id,day);
    COMMIT;`);
  console.log("Community tables ready; existing records preserved.");
} catch (error) { await client.query("ROLLBACK"); throw error; }
finally { await client.end(); }
