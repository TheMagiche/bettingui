export type RawGame = {
  home_team: string;
  away_team: string;
  home_win: string | number;
  draw: string | number;
  away_win: string | number;
  boosted?: boolean;
  kickoff?: string;
};

export type FormattedGame = {
  id: string;
  w: number;
  d: number;
  l: number;
  originalData: RawGame;
};

export type MarketKey = "w" | "d" | "l";

export type GameBucket = "anchors" | "hedges" | "unicorns";

export type IdentifiedGames = {
  anchors: FormattedGame[];
  hedges: FormattedGame[];
  unicorns: FormattedGame[];
  others: FormattedGame[];
};

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

export function identifyGames(games: FormattedGame[]): IdentifiedGames {
  const anchors: FormattedGame[] = [];
  const hedges: FormattedGame[] = [];
  const unicorns: FormattedGame[] = [];
  const others: FormattedGame[] = [];

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
      continue;
    }
    others.push(game);
  }
  return { anchors, hedges, unicorns, others };
}

export function applyGameOverrides(
  identified: IdentifiedGames,
  overrides: Record<string, GameBucket>
): IdentifiedGames {
  const moved: Record<GameBucket, FormattedGame[]> = {
    anchors: [],
    hedges: [],
    unicorns: [],
  };
  const others: FormattedGame[] = [];

  for (const game of identified.others) {
    const bucket = overrides[game.id];
    if (bucket) {
      moved[bucket].push(game);
    } else {
      others.push(game);
    }
  }

  return {
    anchors: [...identified.anchors, ...moved.anchors],
    hedges: [...identified.hedges, ...moved.hedges],
    unicorns: [...identified.unicorns, ...moved.unicorns],
    others,
  };
}

export function matchesTeamSearch(game: FormattedGame, query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return true;
  }

  const { home_team, away_team, boosted } = game.originalData;
  if (needle === "boosted" || needle === "boost") {
    return Boolean(boosted);
  }

  return (
    home_team.toLowerCase().includes(needle) ||
    away_team.toLowerCase().includes(needle) ||
    `${home_team} vs ${away_team}`.toLowerCase().includes(needle)
  );
}

export function isHomeFavorite(game: FormattedGame) {
  return Number(game.originalData.home_win) <= Number(game.originalData.away_win);
}

export function parseKickoff(value?: string | number | null) {
  if (value == null || value === "") {
    return null;
  }

  const date =
    typeof value === "number"
      ? new Date(value < 1e12 ? value * 1000 : value)
      : new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

export function dateKeyFromDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function todayDateKey() {
  return dateKeyFromDate(new Date());
}

export function gameKickoff(game: FormattedGame) {
  return parseKickoff(game.originalData.kickoff);
}

export function gameDateKey(game: FormattedGame) {
  const kickoff = gameKickoff(game);
  return kickoff ? dateKeyFromDate(kickoff) : null;
}

export function formatKickoff(game: FormattedGame) {
  const kickoff = gameKickoff(game);
  if (!kickoff) {
    return null;
  }

  const key = dateKeyFromDate(kickoff);
  const time = kickoff.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (key === todayDateKey()) {
    return `Today · ${time}`;
  }

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (key === dateKeyFromDate(tomorrow)) {
    return `Tomorrow · ${time}`;
  }

  const day = kickoff.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  return `${day} · ${time}`;
}

export function formatDateChip(dateKey: string) {
  if (dateKey === "all") {
    return "All dates";
  }

  if (dateKey === todayDateKey()) {
    return "Today";
  }

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (dateKey === dateKeyFromDate(tomorrow)) {
    return "Tomorrow";
  }

  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function availableDateKeys(games: FormattedGame[]) {
  const keys = new Set<string>();
  for (const game of games) {
    const key = gameDateKey(game);
    if (key) {
      keys.add(key);
    }
  }
  return [...keys].sort();
}

export function filterGamesByDate(games: FormattedGame[], dateKey: string) {
  if (dateKey === "all") {
    return games;
  }

  const dated = games.filter((game) => gameDateKey(game));
  if (dated.length === 0) {
    return games;
  }

  return games.filter((game) => gameDateKey(game) === dateKey);
}

export const MARKET_KEYS: MarketKey[] = ["w", "d", "l"];

/** A 9x opening ticket returns the original spread when each cell is staked at spread / 9. */
export const COVER_MULTIPLIER = 9;

export function needsCoverBoost(odds: number) {
  return odds < COVER_MULTIPLIER;
}

export const FAILSAFE_MARKETS = ["d", "l"] as const;
export const FAILSAFE_DEFAULT_STAKE = 10;

export function failsafeMarketsFor(market: MarketKey) {
  return FAILSAFE_MARKETS.filter((key) => key !== market);
}

function payoutRange(values: number[]) {
  if (values.length === 0) {
    return { low: 0, high: 0 };
  }

  return {
    low: Math.min(...values),
    high: Math.max(...values),
  };
}

function leveragedEarnings(
  failsafeReturns: number[],
  unboostedReturns: number[],
  hasBoosted: boolean
) {
  if (failsafeReturns.length === 0) {
    return { low: 0, high: 0, values: [] as number[] };
  }

  const openingParts = [
    ...(hasBoosted ? [0] : []),
    ...unboostedReturns,
  ];
  if (openingParts.length === 0) {
    openingParts.push(0);
  }

  const values: number[] = [];
  for (const opening of openingParts) {
    for (const failsafe of failsafeReturns) {
      values.push(opening + failsafe);
    }
  }

  return { ...payoutRange(values), values };
}

export function failsafePayoutGroup(
  tickets: { boosted: boolean; returnValue: number }[],
  failsafeTickets: { market: "d" | "l"; amount: number; returnValue: number }[]
) {
  const boostedReturns = tickets
    .filter((ticket) => ticket.boosted)
    .map((ticket) => ticket.returnValue);
  const unboostedReturns = tickets
    .filter((ticket) => !ticket.boosted)
    .map((ticket) => ticket.returnValue);
  const fundedFailsafes = failsafeTickets.filter((ticket) => ticket.amount > 0);
  const drawReturns = fundedFailsafes
    .filter((ticket) => ticket.market === "d")
    .map((ticket) => ticket.returnValue);
  const lossReturns = fundedFailsafes
    .filter((ticket) => ticket.market === "l")
    .map((ticket) => ticket.returnValue);

  const hasBoosted = boostedReturns.length > 0;
  const boosted = payoutRange(boostedReturns);
  const unboosted = payoutRange(unboostedReturns);
  const draws = leveragedEarnings(drawReturns, unboostedReturns, hasBoosted);
  const losses = leveragedEarnings(lossReturns, unboostedReturns, hasBoosted);
  const combo = payoutRange([...draws.values, ...losses.values]);

  return {
    boostedLow: boosted.low,
    boostedHigh: boosted.high,
    unboostedLow: unboosted.low,
    unboostedHigh: unboosted.high,
    drawLow: draws.low,
    drawHigh: draws.high,
    lossLow: losses.low,
    lossHigh: losses.high,
    comboLow: combo.low,
    comboHigh: combo.high,
  };
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