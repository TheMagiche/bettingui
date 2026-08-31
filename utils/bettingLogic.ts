export type RawGame = {
  home_team: string;
  away_team: string;
  home_win: string | number;
  draw: string | number;
  away_win: string | number;
};

export type FormattedGame = {
  id: string;
  w: number;
  d: number;
  l: number;
  originalData: RawGame;
};

export type MarketKey = "w" | "d" | "l";

export type AnchorCombo = {
  id: string;
  row: MarketKey;
  col: MarketKey;
  odds: number;
};

export function formatAndIdentifyGames(rawJsonData: RawGame[]) {
  const formattedGames = rawJsonData.map((game) => {
    const hw = parseFloat(String(game.home_win));
    const aw = parseFloat(String(game.away_win));
    const draw = parseFloat(String(game.draw));

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
      originalData: game,
    } as FormattedGame;
  });

  return identifyGames(formattedGames);
}

export function identifyGames(games: FormattedGame[]) {
  const anchors: FormattedGame[] = [];
  const hedges: FormattedGame[] = [];
  const unicorns: FormattedGame[] = [];

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

export const MARKET_KEYS: MarketKey[] = ["w", "d", "l"];

/** A 9x opening ticket returns the original spread when each cell is staked at spread / 9. */
export const COVER_MULTIPLIER = 9;

export function needsCoverBoost(odds: number) {
  return odds < COVER_MULTIPLIER;
}

export const FAILSAFE_MARKETS = ["d", "l"] as const;

export function failsafeMarketsFor(market: MarketKey) {
  return FAILSAFE_MARKETS.filter((key) => key !== market);
}

export function createNineAnchorOdds(
  anchorA: FormattedGame,
  anchorB: FormattedGame
): AnchorCombo[] {
  return MARKET_KEYS.flatMap((row) =>
    MARKET_KEYS.map((col) => ({
      id: `${row}-${col}`,
      row,
      col,
      odds: anchorA[row] * anchorB[col],
    }))
  );
}

export function gameTitle(game: FormattedGame) {
  return `${game.originalData.home_team} vs ${game.originalData.away_team}`;
}