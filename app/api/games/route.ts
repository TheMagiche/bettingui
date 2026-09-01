import { scrapeSportpesaGames } from "@/utils/sportpesaScraper";
import type { RawGame } from "@/utils/bettingLogic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CACHE_TTL_MS = 5 * 60 * 1000;

type GamesPayload = {
  games: RawGame[];
  source: "live";
  fetchedAt: string;
  error?: string;
};

let cached: { expiresAt: number; payload: GamesPayload } | null = null;
let inflight: Promise<GamesPayload> | null = null;

async function loadGames(): Promise<GamesPayload> {
  const games = await scrapeSportpesaGames();
  return {
    games,
    source: "live",
    fetchedAt: new Date().toISOString(),
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
      .finally(() => {
        inflight = null;
      });
  }

  return inflight;
}

export async function GET(request: Request) {
  const fresh = new URL(request.url).searchParams.has("refresh");

  try {
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
