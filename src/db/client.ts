import { Kysely, PostgresDialect } from "kysely";
import pg from "pg";
import { config } from "../config.js";
import type { Database } from "./types.js";

const pool = new pg.Pool(config.db);

export const db = new Kysely<Database>({
  dialect: new PostgresDialect({ pool }),
});
