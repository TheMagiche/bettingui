import { scrapeSportpesaGames } from "@/utils/sportpesaScraper";
import type { RawGame } from "@/utils/bettingLogic";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CACHE_TTL_MS = 5 * 60 * 1000;

type GamesPayload = {
  games: RawGame[];
  source: "live" | "cache";
  fetchedAt: string;
  error?: string;
};

const CACHE_FILE = join(process.cwd(), "public", "betgames.json");
let cached: { expiresAt: number; payload: GamesPayload } | null = null;
let inflight: Promise<GamesPayload> | null = null;

async function loadGames(): Promise<GamesPayload> {
  const games = await scrapeSportpesaGames();
  try {
    await writeFile(CACHE_FILE, `${JSON.stringify(games, null, 2)}\n`, "utf8");
  } catch (error) {
    console.warn("Could not write games cache", error);
  }

  return {
    games,
    source: "live",
    fetchedAt: new Date().toISOString(),
  };
}

async function loadCachedGames(error?: unknown): Promise<GamesPayload> {
  const contents = await readFile(CACHE_FILE, "utf8");
  const games = JSON.parse(contents) as unknown;
  if (!Array.isArray(games)) {
    throw new Error("Cached games file is invalid");
  }

  return {
    games: games as RawGame[],
    source: "cache",
    fetchedAt: new Date().toISOString(),
    ...(error
      ? {
          error:
            error instanceof Error ? error.message : "Live scrape failed",
        }
      : {}),
  };
}

async function getGames(fresh = false): Promise<GamesPayload> {
  if (!fresh && cached && cached.expiresAt > Date.now()) {
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
      .catch((error) => loadCachedGames(error))
      .finally(() => {
        inflight = null;
      });
  }

  return inflight;
}

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const fresh = searchParams.has("refresh");

  try {
    if (searchParams.has("cache")) {
      const payload = await loadCachedGames();
      cached = {
        expiresAt: Date.now() + CACHE_TTL_MS,
        payload,
      };
      return Response.json(payload);
    }

    const payload = await getGames(fresh);
    return Response.json(payload);
  } catch (error) {
    return Response.json(
      {
        games: [],
        source: "live",
        fetchedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Live scrape failed",
      } satisfies GamesPayload,
      { status: 502 }
    );
  }
}
