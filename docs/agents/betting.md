# Next.js Betting Strategy Analyzer: Agent Implementation Guide

## Project Overview
Create a Next.js (App Router) web application that implements a football betting risk-mitigation strategy. The app will ingest a JSON file of football matches, identify specific betting structures (Anchors, Hedges, Unicorns), and display an interactive 3x3 matrix and a paginated betslip viewer to distribute a user-defined monetary spread.

## Tech Stack
*   **Framework:** Next.js (React)
*   **Styling:** Tailwind CSS
*   **Icons:** Lucide-React
*   **State Management:** React Hooks (`useState`, `useMemo`, `useEffect`)

## 1. Data Ingestion & Formatting
The app must read from a local file named `betgames.json` (place this in the `/public` directory for easy fetching).

The raw JSON objects contain the following keys that must be parsed[cite: 1]:
*   `home_team` (string)[cite: 1]
*   `away_team` (string)[cite: 1]
*   `home_win` (float)[cite: 1]
*   `draw` (float)[cite: 1]
*   `away_win` (float)[cite: 1]

### Required Core Logic (Utility Functions)
Create `utils/bettingLogic.ts` and include the following parser and identifier functions:

```typescript
export function formatAndIdentifyGames(rawJsonData: any[]) {
  const formattedGames = rawJsonData.map((game) => {
    const hw = parseFloat(game.home_win);
    const aw = parseFloat(game.away_win);
    const draw = parseFloat(game.draw);
    
    // The favorite is assigned to 'w', the underdog to 'l'
    const isHomeFav = hw <= aw;
    const w = isHomeFav ? hw : aw;
    const l = isHomeFav ? aw : hw;
    const favTag = isHomeFav ? "(Home Fav)" : "(Away Fav)";

    return {
      id: `${game.home_team} vs ${game.away_team} ${favTag}`,
      w: w,
      d: draw,
      l: l,
      originalData: game 
    };
  });

  return identifyGames(formattedGames);
}

export function identifyGames(games: any[]) {
  const anchors = [];
  const hedges = [];
  const unicorns = [];

  for (const game of games) {
    const { w, d, l } = game;
    // 1. Anchors: w, d, l all between 2.1 and 3.9
    if (w >= 2.1 && w <= 3.9 && d >= 2.1 && d <= 3.9 && l >= 2.1 && l <= 3.9) {
      anchors.push(game);
      continue;
    }
    // 2. Unicorns: d >= 5*w AND l >= 1.5*d
    if (d >= 5 * w && l >= 1.5 * d) {
      unicorns.push(game);
      continue;
    }
    // 3. Hedges: d >= 3*w AND l >= 1.5*d
    if (d >= 3 * w && l >= 1.5 * d) {
      hedges.push(game);
    }
  }
  return { anchors, hedges, unicorns };
}