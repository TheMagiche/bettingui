import { spawn } from "node:child_process";
import { join } from "node:path";
import type { RawGame } from "./bettingLogic";

const SCRAPE_TIMEOUT_MS = 55_000;

function stopLeftoverChrome() {
  const killer = spawn("pkill", ["-f", "sportpesa-chrome-"], {
    stdio: "ignore",
  });
  killer.unref();
}

export function scrapeSportpesaGames(): Promise<RawGame[]> {
  const script = join(process.cwd(), "utils", "sportpesaScraper.ts");

  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ["--experimental-strip-types", "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", script],
      {
        env: {
          ...process.env,
          SPORTPESA_SCRAPE_CHILD: "1",
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

    let stdout = "";
    let stderr = "";
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      stopLeftoverChrome();
      callback();
    };
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      finish(() => reject(new Error("SportPesa scrape timed out")));
    }, SCRAPE_TIMEOUT_MS);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });

    child.on("error", (error) => {
      finish(() => reject(error));
    });

    child.on("close", (code, signal) => {
      finish(() => {
        if (code === 0) {
          try {
            const games = JSON.parse(stdout) as RawGame[];
            if (!Array.isArray(games)) {
              reject(new Error("SportPesa scrape returned an unexpected payload"));
              return;
            }
            resolve(games);
          } catch {
            reject(new Error("SportPesa scrape returned invalid JSON"));
          }
          return;
        }

        const detail = stderr.trim() || signal || `exit ${code ?? "unknown"}`;
        reject(new Error(`SportPesa scrape failed (${detail})`));
      });
    });
  });
}
