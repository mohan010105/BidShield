import { drizzle } from "drizzle-orm/node-postgres";
import pg, { type PoolConfig } from "pg";
import * as schema from "./schema";

const { Pool } = pg;

export function buildPoolConfig(rawUrl?: string): PoolConfig {
  if (!rawUrl || !rawUrl.trim()) {
    return {
      connectionString: "postgres://postgres:postgres@localhost:5432/bidshield",
      connectionTimeoutMillis: 2000,
    };
  }

  const trimmed = rawUrl.trim().replace(/^["']|["']$/g, "");

  // Match: postgresql://user:password@host:port/database
  const match = trimmed.match(/^postgres(?:ql)?:\/\/([^:]+):(.*)@([^:/]+)(?::(\d+))?(\/.*)?$/);

  if (match) {
    const user = match[1];
    let password = match[2];
    const host = match[3];
    const port = match[4] ? parseInt(match[4], 10) : 5432;
    const database = (match[5] || "/postgres").replace(/^\//, "").split("?")[0] || "postgres";

    // Strip square brackets if user copied [YOUR-PASSWORD] format
    if (password.startsWith("[") && password.endsWith("]")) {
      password = password.slice(1, -1);
    }
    try {
      password = decodeURIComponent(password);
    } catch {
      // ignore
    }

    const isRemote = host.includes(".") && !host.includes("localhost") && !host.includes("127.0.0.1");

    return {
      user,
      password,
      host,
      port,
      database,
      ssl: isRemote ? { rejectUnauthorized: false } : undefined,
      connectionTimeoutMillis: 6000,
    };
  }

  const isRemote = trimmed.includes(".") && !trimmed.includes("localhost") && !trimmed.includes("127.0.0.1");
  return {
    connectionString: trimmed,
    ssl: isRemote ? { rejectUnauthorized: false } : undefined,
    connectionTimeoutMillis: 6000,
  };
}

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  if (process.env.NODE_ENV !== "test") {
    console.info(
      "[BidShield DB] Notice: DATABASE_URL is not set. BidShield will use the built-in demo dataset.",
    );
  }
}

export const pool = new Pool(buildPoolConfig(databaseUrl));

pool.on("error", (err) => {
  if (process.env.NODE_ENV !== "test") {
    console.debug("[BidShield DB] Pool connection notice:", err.message);
  }
});

let _connectionChecked = false;
let _connectionWorking = false;

export async function checkDatabaseConnection(forceRefresh = false): Promise<boolean> {
  if (!process.env.DATABASE_URL) return false;
  if (!forceRefresh && _connectionChecked && !_connectionWorking) return false;

  try {
    const connectPromise = pool.connect();
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Database connection timed out")), 2500)
    );

    const client = await Promise.race([connectPromise, timeoutPromise]);
    try {
      await client.query("SELECT 1");
      _connectionWorking = true;
      _connectionChecked = true;
      return true;
    } finally {
      client.release();
    }
  } catch (err: any) {
    _connectionWorking = false;
    _connectionChecked = true;
    if (process.env.NODE_ENV !== "test") {
      console.info("[BidShield DB] Database connection notice:", err.message);
    }
    return false;
  }
}

export const db = drizzle(pool, { schema });

export * from "./schema";


