import { promises as fs } from "node:fs";
import path from "node:path";

/* ----------------------------------------------------------------------------
 * Minimal JSON file store for user data (watchlist / alerts / journal).
 *
 * No database required: collections persist to `.data/<name>.json`. When a
 * DATABASE_URL is configured you'd swap this for a real DB — the API routes
 * only depend on these functions.
 * -------------------------------------------------------------------------- */

const DATA_DIR = path.join(process.cwd(), ".data");

async function ensureDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

function file(name: string) {
  return path.join(DATA_DIR, `${name.replace(/[^a-z0-9_-]/gi, "")}.json`);
}

export async function readCollection<T>(name: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(file(name), "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function writeCollection<T>(name: string, value: T): Promise<void> {
  await ensureDir();
  await fs.writeFile(file(name), JSON.stringify(value, null, 2), "utf8");
}

/** Simple unique id (sufficient for local single-user persistence). */
export function makeId(prefix = "id"): string {
  return `${prefix}_${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
}
