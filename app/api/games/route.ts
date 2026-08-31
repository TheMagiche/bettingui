import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { scrapeSportpesaGames } from "@/utils/sportpesaScraper";
import type { RawGame } from "@/utils/bettingLogic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE_TTL_MS = 5 * 60 * 1000;

type GamesSource = "live" | "fallback";

type GamesPayload = {
  games: RawGame[];
  source: GamesSource;
  fetchedAt: string;
  error?: string;
};

let cached: { expiresAt: number; payload: GamesPayload } | null = null;
let inflight: Promise<GamesPayload> | null = null;

async function readFallbackGames(): Promise<RawGame[]> {
  const filePath = join(process.cwd(), "public", "betgames.json");
  const contents = await readFile(filePath, "utf8");
  const games = JSON.parse(contents) as RawGame[];

  if (!Array.isArray(games) || games.length === 0) {
    throw new Error("Fallback betgames.json is empty");
  }

  return games;
}

async function loadGames(): Promise<GamesPayload> {
  try {
    const games = await scrapeSportpesaGames();
    return {
      games,
      source: "live",
      fetchedAt: new Date().toISOString(),
    };
  } catch (error) {
    const games = await readFallbackGames();
    return {
      games,
      source: "fallback",
      fetchedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Live scrape failed",
    };
  }
}

async function getGames(): Promise<GamesPayload> {
  if (cached && cached.expiresAt > Date.now()) {
    return cached.payload;
  }

  if (!inflight) {
    inflight = loadGames()
      .then((payload) => {
        cached = {
          expiresAt: Date.now() + CACHE_TTL_MS,
          payload,
        };
        return payload;
      })
      .finally(() => {
        inflight = null;
      });
  }

  return inflight;
}

export async function GET() {
  const payload = await getGames();
  return Response.json(payload);
}
