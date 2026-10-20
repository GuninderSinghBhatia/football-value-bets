// Reads the JSON files the Python NBA pipeline writes to web/data/nba/ (server only).
import { promises as fs } from "fs";
import path from "path";
import type { NbaBet, NbaPerformance, NbaTonight } from "@/lib/nba";

const DIR = path.join(process.cwd(), "data", "nba");

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await fs.readFile(path.join(DIR, file), "utf8")) as T;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return fallback;
    throw e;
  }
}

export const readTonight = () =>
  readJson<NbaTonight | null>("tonight.json", null);
export const readBets = () => readJson<NbaBet[]>("bets.json", []);
export const readPerformance = () => readJson<NbaPerformance | null>("performance.json", null);
