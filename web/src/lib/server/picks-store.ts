// Saved picks live in web/data/picks.json (gitignored). Single-user, local storage until the backend
// database exists; the functions here are the only place that touches the file.
import { promises as fs } from "fs";
import path from "path";
import type { SavedPick } from "@/lib/types";

const FILE = path.join(process.cwd(), "data", "picks.json");

// Serialise writes within this process so concurrent requests can't interleave read-modify-write.
let queue: Promise<unknown> = Promise.resolve();
function locked<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn);
  queue = run.catch(() => {});
  return run;
}

export async function readPicks(): Promise<SavedPick[]> {
  try {
    return JSON.parse(await fs.readFile(FILE, "utf8")) as SavedPick[];
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw e;
  }
}

async function writePicks(picks: SavedPick[]) {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  // Write to a temp file then rename, so a crash never leaves a half-written file.
  const tmp = `${FILE}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(picks, null, 2));
  await fs.rename(tmp, FILE);
}

/** Read, change and write the picks atomically. */
export function updatePicks<T>(fn: (picks: SavedPick[]) => { picks: SavedPick[]; result: T }): Promise<T> {
  return locked(async () => {
    const { picks, result } = fn(await readPicks());
    await writePicks(picks);
    return result;
  });
}
