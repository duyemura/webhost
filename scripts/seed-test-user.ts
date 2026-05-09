/**
 * Creates a dev test user and prints a valid JWT.
 * Use this to get a token without going through Google OAuth.
 *
 *   pnpm tsx scripts/seed-test-user.ts
 */
import "dotenv/config";
import pg from "pg";
import { createSigner } from "fast-jwt";
import { config } from "../src/config.js";

const client = new pg.Client(config.db);
await client.connect();

const { rows } = await client.query<{ id: string; email: string }>(`
  INSERT INTO users (email, name, google_id)
  VALUES ('dev@test.com', 'Dev User', 'dev-google-test-123')
  ON CONFLICT (email) DO UPDATE SET google_id = EXCLUDED.google_id
  RETURNING id, email
`);

await client.end();

const user = rows[0]!;
const sign = createSigner({ key: config.jwtSecret, expiresIn: "30d" });
const token = sign({ sub: user.id, email: user.email });

console.log("\n✓ Test user ready");
console.log(`  id:    ${user.id}`);
console.log(`  email: ${user.email}`);
console.log(`\nToken (valid 30 days):\n`);
console.log(token);
console.log();
