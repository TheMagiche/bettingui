import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import CDP from "chrome-remote-interface";
import type { RawGame } from "./bettingLogic";

const SPORTPESA_PAGE =
  "https://www.ke.sportpesa.com/en/sports-betting/football-1/";
const PAGE_SIZE = 15;
const SPORTPESA_ENDPOINTS = [
  `https://www.ke.sportpesa.com/api/upcoming/games?type=prematch&sportId=1&section=upcoming&markets_layout=multiple&o=startTime&pag_count=${PAGE_SIZE}&pag_min=`,
  `https://www.ke.sportpesa.com/api/todays/1/games?type=prematch&section=today&markets_layout=multiple&o=startTime&pag_count=${PAGE_SIZE}&pag_min=`,
];
const CHROME_VERSION = "143.0.0.0";

function isServerless() {
  return Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
}

function userAgent() {
  if (process.env.CHROME_USER_AGENT) {
    return process.env.CHROME_USER_AGENT;
  }

  if (isServerless() || process.platform === "linux") {
    return `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROME_VERSION} Safari/537.36`;
  }

  if (process.platform === "win32") {
    return `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROME_VERSION} Safari/537.36`;
  }

  return `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROME_VERSION} Safari/537.36`;
}

function userAgentPlatform() {
  if (isServerless() || process.platform === "linux") {
    return "Linux x86_64";
  }

  if (process.platform === "win32") {
    return "Win32";
  }

  return "MacIntel";
}

type SportpesaCompetitor = {
  name?: string;
  home?: boolean;
};

type SportpesaSelection = {
  name?: string;
  shortName?: string;
  odds?: number | string;
};

type SportpesaMarket = {
  name?: string;
  selections?: SportpesaSelection[];
};

type SportpesaEvent = {
  id?: number | string;
  boosted?: boolean;
  date?: string;
  dateTimestamp?: number;
  competitors?: SportpesaCompetitor[];
  markets?: SportpesaMarket[];
};

function localChromePath() {
  if (process.env.CHROME_PATH) {
    return process.env.CHROME_PATH;
  }

  if (process.platform === "darwin") {
    return "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  }

  if (process.platform === "win32") {
    return "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  }

  return "google-chrome";
}

function localChromeArgs() {
  const args = [
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-dev-shm-usage",
    "--disable-background-networking",
    "--window-size=1920,1080",
  ];

  if (process.env.CHROME_NO_SANDBOX === "1") {
    args.push("--no-sandbox", "--disable-setuid-sandbox");
  }

  return args;
}

async function resolveBrowser() {
  if (isServerless() && !process.env.CHROME_PATH) {
    const { default: chromium } = await import("@sparticuz/chromium");
    chromium.setGraphicsMode = false;
    return {
      executablePath: await chromium.executablePath(),
      args: [...chromium.args, "--disable-dev-shm-usage", "--window-size=1920,1080"],
    };
  }

  return {
    executablePath: localChromePath(),
    args: localChromeArgs(),
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForDebugger(port: number, timeoutMs = 15000) {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (response.ok) {
        return;
      }
    } catch {
      // Chrome is still starting
    }

    await sleep(200);
  }

  throw new Error(`Chrome debugger did not start on port ${port}`);
}

function parseOdds(value: unknown) {
  const odds =
    typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  return Number.isFinite(odds) && odds > 1 ? odds : null;
}

function marketLooksLike1x2(market: SportpesaMarket) {
  const name = market.name?.toLowerCase() ?? "";
  return /1\s*x\s*2|3\s*-?\s*way|match result|full time/.test(name);
}

function selectionKey(selection: SportpesaSelection) {
  return `${selection.shortName ?? ""} ${selection.name ?? ""}`.trim();
}

function mapEvent(event: SportpesaEvent): RawGame | null {
  const competitors = event.competitors ?? [];
  const home = competitors.find((team) => team.home) ?? competitors[0];
  const away = competitors.find((team) => team !== home) ?? competitors[1];

  if (!home?.name || !away?.name) {
    return null;
  }

  const markets = event.markets ?? [];
  const market = markets.find(marketLooksLike1x2) ?? markets[0];
  const selections = market?.selections ?? [];

  if (selections.length < 3) {
    return null;
  }

  const byPattern = (pattern: RegExp) =>
    selections.find((selection) => pattern.test(selectionKey(selection)));

  const homeWin =
    parseOdds(byPattern(/^1\b|home/i)?.odds) ?? parseOdds(selections[0]?.odds);
  const draw =
    parseOdds(byPattern(/^x\b|draw/i)?.odds) ?? parseOdds(selections[1]?.odds);
  const awayWin =
    parseOdds(byPattern(/^2\b|away/i)?.odds) ?? parseOdds(selections[2]?.odds);

  if (homeWin === null || draw === null || awayWin === null) {
    return null;
  }

  const kickoffDate =
    event.date ||
    (typeof event.dateTimestamp === "number"
      ? new Date(event.dateTimestamp * 1000).toISOString()
      : undefined);

  return {
    home_team: home.name.trim(),
    away_team: away.name.trim(),
    home_win: homeWin,
    draw,
    away_win: awayWin,
    boosted: Boolean(event.boosted),
    kickoff: kickoffDate,
  };
}

async function launchChrome(port: number, userDataDir: string): Promise<ChildProcess> {
  const browser = await resolveBrowser();
  const agent = userAgent();

  return spawn(
    /* turbopackIgnore: true */ browser.executablePath,
    [
      ...browser.args,
      `--user-agent=${agent}`,
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${userDataDir}`,
    ],
    {
      stdio: "ignore",
    }
  );
}

const FETCH_GAMES_SCRIPT = `
(async () => {
  const endpoints = ${JSON.stringify(SPORTPESA_ENDPOINTS)};
  const pageSize = ${PAGE_SIZE};
  const events = [];
  const seen = new Set();

  const addEvents = (batch, boosted) => {
    for (const event of batch || []) {
      const key = String(event.id ?? JSON.stringify(event.competitors));
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      if (boosted) {
        event.boosted = true;
      }
      events.push(event);
    }
  };

  const attachMarkets = async (batch) => {
    const missing = (batch || []).filter((event) => !event.markets || event.markets.length === 0);
    if (missing.length === 0) {
      return;
    }
    const ids = missing.map((event) => event.id).filter(Boolean).join(",");
    const response = await fetch("https://www.ke.sportpesa.com/api/games/markets?games=" + ids + "&markets=10", {
      headers: { Accept: "application/json" },
    });
    if (response.status !== 200 && response.status !== 206) {
      return;
    }
    const markets = await response.json();
    for (const event of missing) {
      event.markets = markets[String(event.id)] || markets[event.id] || [];
    }
  };

  try {
    const popularResponse = await fetch("https://www.ke.sportpesa.com/api/populars/1/games", {
      headers: { Accept: "application/json" },
    });
    if (popularResponse.status === 200 || popularResponse.status === 206) {
      const popular = await popularResponse.json();
      if (Array.isArray(popular) && popular.length > 0) {
        await attachMarkets(popular);
        addEvents(popular, true);
      }
    }
  } catch (error) {
    // Popular/boosted feed is optional; upcoming and today still load.
  }

  for (const base of endpoints) {
    for (let page = 0; page < 8; page += 1) {
      try {
        const response = await fetch(base + (page * pageSize + 1), {
          headers: { Accept: "application/json" },
        });
        if (response.status !== 200 && response.status !== 206) {
          break;
        }
        const data = await response.json();
        if (!Array.isArray(data) || data.length === 0) {
          break;
        }
        addEvents(data, false);
        if (data.length < pageSize) {
          break;
        }
      } catch (error) {
        break;
      }
    }
  }

  return JSON.stringify(events);
})()
`;

export async function scrapeSportpesaGames(): Promise<RawGame[]> {
  const port = 9300 + Math.floor(Math.random() * 700);
  const userDataDir = await mkdtemp(join(tmpdir(), "sportpesa-chrome-"));
  const chrome = await launchChrome(port, userDataDir);
  let client: CDP.Client | undefined;

  try {
    await waitForDebugger(port, isServerless() ? 20000 : 15000);
    client = await CDP({ host: "127.0.0.1", port });
    const { Page, Runtime, Network } = client;
    await Page.enable();
    await Runtime.enable();
    await Network.enable();
    await Network.setUserAgentOverride({
      userAgent: userAgent(),
      acceptLanguage: "en-KE,en;q=0.9",
      platform: userAgentPlatform(),
    });
    await Page.navigate({ url: SPORTPESA_PAGE });
    await Page.loadEventFired();

    const deadline = Date.now() + 25000;
    let payload = "[]";

    while (Date.now() < deadline) {
      const result = await Runtime.evaluate({
        expression: FETCH_GAMES_SCRIPT,
        awaitPromise: true,
        returnByValue: true,
      });

      if (result.exceptionDetails) {
        await sleep(1500);
        continue;
      }

      const value = result.result.value;
      if (typeof value === "string" && value.length > 2) {
        payload = value;
        break;
      }

      await sleep(1500);
    }

    const events = JSON.parse(payload) as SportpesaEvent[];
    if (!Array.isArray(events)) {
      throw new Error("SportPesa returned an unexpected payload");
    }

    const games = events
      .map(mapEvent)
      .filter((game): game is RawGame => game !== null);

    if (games.length === 0) {
      throw new Error("SportPesa scrape returned no 1X2 markets");
    }

    return games;
  } finally {
    await client?.close().catch(() => undefined);
    chrome.kill("SIGTERM");
    await rm(userDataDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
