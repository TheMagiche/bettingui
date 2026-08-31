"use client";

import { useEffect, useMemo, useState } from "react";
import {
  applyGameOverrides,
  availableDateKeys,
  COVER_MULTIPLIER,
  createNineAnchorOdds,
  FAILSAFE_DEFAULT_STAKE,
  failsafeMarketsFor,
  failsafePayoutGroup,
  filterGamesByDate,
  formatAndIdentifyGames,
  formatKickoff,
  gameKickoff,
  gameTitle,
  MARKET_KEYS,
  needsCoverBoost,
  todayDateKey,
} from "@/utils/bettingLogic";
import type {
  FormattedGame,
  GameBucket,
  IdentifiedGames,
  MarketKey,
  RawGame,
} from "@/utils/bettingLogic";
import DateFilterChips from "@/app/components/DateFilterChips";
import GameSelectModal from "@/app/components/GameSelectModal";
import { ChevronLeft, ChevronRight, Plus, Search, Trash2 } from "lucide-react";

type ExtraCategory = "hedges" | "unicorns" | "others";
type GamesSource = "live" | "fallback" | "loading";
type PickerTarget = "anchorA" | "anchorB" | ExtraCategory;

type ExtraLeg = {
  id: string;
  category: Exclude<ExtraCategory, "others">;
  game: FormattedGame;
  market: MarketKey;
  failsafe: {
    d: number;
    l: number;
  };
};

type FailsafeTicket = {
  id: string;
  legId: string;
  category: Exclude<ExtraCategory, "others">;
  game: FormattedGame;
  market: "d" | "l";
  amount: number;
  odds: number;
  returnValue: number;
};

const MARKET_TITLES: Record<MarketKey, string> = {
  w: "Win",
  d: "Draw",
  l: "Loss",
};

const EXTRA_TITLES: Record<ExtraCategory, string> = {
  hedges: "Hedges",
  unicorns: "Unicorns",
  others: "Others",
};

const emptyIdentifiedGames: IdentifiedGames = {
  anchors: [],
  hedges: [],
  unicorns: [],
  others: [],
};

function SlipLeg({
  label,
  game,
  market,
}: {
  label: string;
  game: FormattedGame;
  market: MarketKey;
}) {
  return (
    <div className="rounded-lg bg-zinc-100 px-2.5 py-2 dark:bg-zinc-800">
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
        {label}
      </div>
      <div className="mt-0.5 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
        {gameTitle(game)}
      </div>
      <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
        {MARKET_TITLES[market]} @ {game[market].toFixed(2)}
      </div>
    </div>
  );
}

function SlipPayout({ stake, odds, toWin }: { stake: number; odds: number; toWin: number }) {
  return (
    <div className="mt-2 space-y-1 text-xs">
      <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
        <span>Stake</span>
        <span className="font-medium text-zinc-800 dark:text-zinc-200">${stake.toFixed(2)}</span>
      </div>
      <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
        <span>Odds</span>
        <span className="font-medium text-zinc-800 dark:text-zinc-200">{odds.toFixed(2)}</span>
      </div>
      <div className="flex items-center justify-between font-semibold text-emerald-600 dark:text-emerald-400">
        <span>Amount to win</span>
        <span>${toWin.toFixed(2)}</span>
      </div>
    </div>
  );
}

function oddsDetail(game: FormattedGame) {
  const kickoff = formatKickoff(game);
  const odds = `W ${game.w.toFixed(2)} · D ${game.d.toFixed(2)} · L ${game.l.toFixed(2)}${
    game.originalData.boosted ? " · boosted" : ""
  }`;
  return kickoff ? `${kickoff} · ${odds}` : odds;
}

function sortGames(games: FormattedGame[]) {
  return [...games].sort((a, b) => {
    const aKickoff = gameKickoff(a)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const bKickoff = gameKickoff(b)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    if (aKickoff !== bKickoff) {
      return aKickoff - bKickoff;
    }

    return `${a.originalData.home_team} ${a.originalData.away_team}`
      .toLowerCase()
      .localeCompare(
        `${b.originalData.home_team} ${b.originalData.away_team}`.toLowerCase()
      );
  });
}

export default function Home() {
  const [classified, setClassified] = useState<IdentifiedGames>(emptyIdentifiedGames);
  const [overrides, setOverrides] = useState<Record<string, GameBucket>>({});
  const [spread, setSpread] = useState<number>(90);
  const [anchorAId, setAnchorAId] = useState("");
  const [anchorBId, setAnchorBId] = useState("");
  const [cellAmounts, setCellAmounts] = useState<Record<string, number>>({});
  const [extraLegs, setExtraLegs] = useState<ExtraLeg[]>([]);
  const [extraCategory, setExtraCategory] = useState<ExtraCategory>("hedges");
  const [extraGameId, setExtraGameId] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [gamesSource, setGamesSource] = useState<GamesSource>("loading");
  const [picker, setPicker] = useState<PickerTarget | null>(null);
  const [dateFilter, setDateFilter] = useState(todayDateKey);
  const itemsPerPage = 5;

  const games = useMemo(
    () => applyGameOverrides(classified, overrides),
    [classified, overrides]
  );

  const allGames = useMemo(
    () => [...games.anchors, ...games.hedges, ...games.unicorns, ...games.others],
    [games]
  );
  const matchDates = useMemo(() => availableDateKeys(allGames), [allGames]);
  const visibleGames = useMemo(
    () => ({
      anchors: filterGamesByDate(games.anchors, dateFilter),
      hedges: filterGamesByDate(games.hedges, dateFilter),
      unicorns: filterGamesByDate(games.unicorns, dateFilter),
      others: filterGamesByDate(games.others, dateFilter),
    }),
    [dateFilter, games]
  );

  useEffect(() => {
    let cancelled = false;
    let liveApplied = false;

    const applyGames = (data: RawGame[]) => {
      const formatted = formatAndIdentifyGames(data);
      setClassified(formatted);
      setOverrides((current) => {
        const otherIds = new Set(formatted.others.map((game) => game.id));
        return Object.fromEntries(
          Object.entries(current).filter(([id]) => otherIds.has(id))
        );
      });

      const sortedAnchors = sortGames(formatted.anchors);
      setAnchorAId((current) =>
        current && sortedAnchors.some((game) => game.id === current)
          ? current
          : ""
      );
      setAnchorBId((current) =>
        current && sortedAnchors.some((game) => game.id === current)
          ? current
          : ""
      );

      const sortedExtras = sortGames(formatted.hedges);
      setExtraGameId((current) =>
        current && sortedExtras.some((game) => game.id === current)
          ? current
          : sortedExtras[0]?.id ?? ""
      );
    };

    const loadFallback = fetch("/betgames.json")
      .then((res) => {
        if (!res.ok) {
          throw new Error("Failed to load betgames.json");
        }
        return res.json() as Promise<RawGame[]>;
      })
      .then((data) => {
        if (!cancelled && !liveApplied) {
          applyGames(data);
          setGamesSource((current) => (current === "live" ? current : "fallback"));
        }
      })
      .catch((err) => console.error("Failed to load fallback matches", err));

    const loadLive = fetch("/api/games")
      .then((res) => {
        if (!res.ok) {
          throw new Error("Failed to load live matches");
        }
        return res.json() as Promise<{ games: RawGame[]; source: "live" | "fallback" }>;
      })
      .then((payload) => {
        if (!cancelled && Array.isArray(payload.games) && payload.games.length > 0) {
          if (payload.source === "live") {
            liveApplied = true;
          }
          applyGames(payload.games);
          setGamesSource(payload.source);
        }
      })
      .catch((err) => console.error("Failed to load live matches", err));

    Promise.allSettled([loadFallback, loadLive]).then(() => {
      if (!cancelled) {
        setGamesSource((current) => (current === "loading" ? "fallback" : current));
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const sortedAnchors = useMemo(
    () => sortGames(visibleGames.anchors),
    [visibleGames.anchors]
  );
  const extraGames = useMemo(() => {
    if (extraCategory === "others") {
      return sortGames(visibleGames.others);
    }
    return sortGames(visibleGames[extraCategory]);
  }, [extraCategory, visibleGames]);

  const selectedExtraGame = useMemo(
    () => extraGames.find((game) => game.id === extraGameId) ?? extraGames[0] ?? null,
    [extraGames, extraGameId]
  );

  const anchorA = useMemo(
    () => sortedAnchors.find((game) => game.id === anchorAId) ?? null,
    [sortedAnchors, anchorAId]
  );
  const anchorB = useMemo(
    () => sortedAnchors.find((game) => game.id === anchorBId) ?? null,
    [sortedAnchors, anchorBId]
  );

  const combinations = useMemo(() => {
    if (!anchorA || !anchorB || anchorA.id === anchorB.id) {
      return [];
    }

    return createNineAnchorOdds(anchorA, anchorB);
  }, [anchorA, anchorB]);

  const extraMultiplier = useMemo(
    () => extraLegs.reduce((product, leg) => product * leg.game[leg.market], 1),
    [extraLegs]
  );

  const tickets = useMemo(() => {
    const equalStake = spread / COVER_MULTIPLIER;
    return combinations.map((combo) => {
      const amount = Math.max(cellAmounts[combo.id] ?? equalStake, 0);
      const boosted = extraLegs.length > 0 && needsCoverBoost(combo.odds);
      const odds = boosted ? combo.odds * extraMultiplier : combo.odds;
      return {
        ...combo,
        amount,
        boosted,
        baseOdds: combo.odds,
        odds,
        returnValue: amount * odds,
      };
    });
  }, [cellAmounts, combinations, extraLegs.length, extraMultiplier, spread]);

  const failsafeTickets = useMemo<FailsafeTicket[]>(
    () =>
      extraLegs
        .flatMap((leg) =>
          failsafeMarketsFor(leg.market).map((market) => {
            const amount = Math.max(leg.failsafe[market], 0);
            const odds = leg.game[market];
            return {
              id: `${leg.id}-${market}`,
              legId: leg.id,
              category: leg.category,
              game: leg.game,
              market,
              amount,
              odds,
              returnValue: amount * odds,
            };
          })
        )
        .sort((a, b) => b.returnValue - a.returnValue),
    [extraLegs]
  );

  const failsafeStake = useMemo(
    () => failsafeTickets.reduce((sum, ticket) => sum + ticket.amount, 0),
    [failsafeTickets]
  );

  const openingStake = useMemo(
    () => tickets.reduce((sum, ticket) => sum + ticket.amount, 0),
    [tickets]
  );

  const totalStake = openingStake + failsafeStake;

  const workingSpread = spread + failsafeStake;

  const payoutGroup = useMemo(
    () => failsafePayoutGroup(tickets, failsafeTickets),
    [failsafeTickets, tickets]
  );

  const lowestReturn = useMemo(
    () => (tickets.length ? Math.min(...tickets.map((ticket) => ticket.returnValue)) : 0),
    [tickets]
  );

  const highestReturn = useMemo(
    () => (tickets.length ? Math.max(...tickets.map((ticket) => ticket.returnValue)) : 0),
    [tickets]
  );

  const sortedTickets = useMemo(
    () => [...tickets].sort((a, b) => b.returnValue - a.returnValue),
    [tickets]
  );

  const paginatedTickets = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return sortedTickets.slice(start, start + itemsPerPage);
  }, [currentPage, sortedTickets]);

  const totalPages = Math.max(1, Math.ceil(sortedTickets.length / itemsPerPage));

  const updateCellAmount = (id: string, value: string) => {
    const parsedValue = Number(value);
    setCellAmounts((prev) => ({
      ...prev,
      [id]: Number.isFinite(parsedValue) ? Math.max(parsedValue, 0) : 0,
    }));
  };

  const addExtraLeg = (game = selectedExtraGame, category = extraCategory) => {
    if (!game || category === "others") {
      return;
    }

    setExtraLegs((prev) => [
      ...prev,
      {
        id: `${category}-${game.id}-${Date.now()}-${Math.random()
          .toString(16)
          .slice(2)}`,
        category,
        game,
        market: "w",
        failsafe: { d: FAILSAFE_DEFAULT_STAKE, l: FAILSAFE_DEFAULT_STAKE },
      },
    ]);
  };

  const classifyOther = (game: FormattedGame, bucket: GameBucket) => {
    setOverrides((current) => ({ ...current, [game.id]: bucket }));
    if (bucket === "anchors") {
      setPicker(null);
      return;
    }

    setExtraCategory(bucket);
    setExtraGameId(game.id);
    setPicker(null);
  };

  const handlePickerSelect = (game: FormattedGame) => {
    if (picker === "anchorA") {
      setAnchorAId(game.id);
      setCellAmounts({});
      setCurrentPage(1);
    } else if (picker === "anchorB") {
      setAnchorBId(game.id);
      setCellAmounts({});
      setCurrentPage(1);
    } else if (picker === "hedges" || picker === "unicorns") {
      setExtraGameId(game.id);
    }
    setPicker(null);
  };

  const updateExtraMarket = (id: string, market: MarketKey) => {
    setExtraLegs((prev) =>
      prev.map((leg) => (leg.id === id ? { ...leg, market } : leg))
    );
  };

  const removeExtraLeg = (id: string) => {
    setExtraLegs((prev) => prev.filter((leg) => leg.id !== id));
  };

  const updateFailsafeAmount = (id: string, market: "d" | "l", value: string) => {
    const parsedValue = Number(value);
    const nextAmount = Number.isFinite(parsedValue) ? Math.max(parsedValue, 0) : 0;
    setExtraLegs((prev) =>
      prev.map((leg) =>
        leg.id === id
          ? { ...leg, failsafe: { ...leg.failsafe, [market]: nextAmount } }
          : leg
      )
    );
  };

  const clearBuilder = () => {
    setAnchorAId("");
    setAnchorBId("");
    setCellAmounts({});
    setExtraLegs([]);
    setCurrentPage(1);
  };

  const handleExtraCategoryChange = (nextCategory: ExtraCategory) => {
    setExtraCategory(nextCategory);
    const nextGames = sortGames(visibleGames[nextCategory]);
    setExtraGameId(nextGames[0]?.id ?? "");
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-zinc-100">
      <header className="border-b border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto max-w-6xl px-6 py-4">
          <h1 className="text-2xl font-bold">Betting Strategy Analyzer</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Two anchors create the 9 opening odds in a unified builder
          </p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {gamesSource === "live"
              ? "Live SportPesa matches loaded"
              : gamesSource === "loading"
                ? "Loading live SportPesa matches…"
                : "Using saved sample matches"}
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-8 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-200">
                Monetary Spread ($)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="1"
                  value={spread}
                  onChange={(e) => {
                    setSpread(Number(e.target.value) || 0);
                    setCellAmounts({});
                  }}
                  className="w-32 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                />
                <span className="text-sm text-zinc-500 dark:text-zinc-400">
                  Default stake per cell: ${(spread / COVER_MULTIPLIER).toFixed(2)}
                  {extraLegs.length > 0
                    ? ` · each failsafe draw/loss starts at $${FAILSAFE_DEFAULT_STAKE.toFixed(2)}`
                    : ""}
                </span>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-zinc-100 px-4 py-3 text-right dark:bg-zinc-800">
                <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
                  Lowest return
                </div>
                <div className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
                  ${lowestReturn.toFixed(2)}
                </div>
              </div>
              <div className="rounded-xl bg-zinc-100 px-4 py-3 text-right dark:bg-zinc-800">
                <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
                  Highest return
                </div>
                <div className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
                  ${highestReturn.toFixed(2)}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 lg:col-span-2">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                  Bet Builder
                </div>
                <h2 className="mt-1 text-2xl font-bold">Unified cover</h2>
              </div>
              <button
                onClick={clearBuilder}
                className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-600 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                <Trash2 size={14} />
                Clear
              </button>
            </div>

            <div className="mb-5">
              <div className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-200">
                Match date
              </div>
              <DateFilterChips
                dates={matchDates}
                value={dateFilter}
                onChange={setDateFilter}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <span className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-200">
                  Anchor 1
                </span>
                <PickerButton
                  label={anchorA ? gameTitle(anchorA) : "Search and choose first anchor"}
                  detail={
                    anchorA
                      ? oddsDetail(anchorA)
                      : `${sortedAnchors.length} anchors available`
                  }
                  onClick={() => setPicker("anchorA")}
                />
              </div>
              <div>
                <span className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-200">
                  Anchor 2
                </span>
                <PickerButton
                  label={anchorB ? gameTitle(anchorB) : "Search and choose second anchor"}
                  detail={
                    anchorB
                      ? oddsDetail(anchorB)
                      : `${sortedAnchors.length} anchors available`
                  }
                  onClick={() => setPicker("anchorB")}
                />
              </div>
            </div>

            {anchorA && anchorB && tickets.length === 9 ? (
              <div className="mt-6">
                <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <h3 className="text-lg font-bold">9 opening odds</h3>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      Every Win / Draw / Loss pairing of the two anchors
                    </p>
                  </div>
                  {extraLegs.length > 0 && (
                    <div className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                      Extra legs ×{extraMultiplier.toFixed(2)} on tickets below {COVER_MULTIPLIER}×
                    </div>
                  )}
                </div>

                <div className="overflow-x-auto">
                  <div className="grid min-w-160 grid-cols-[7rem_repeat(3,minmax(0,1fr))] gap-3">
                    <div />
                    {MARKET_KEYS.map((key) => (
                      <div key={`col-${key}`} className="text-center">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                          {MARKET_TITLES[key]}
                        </div>
                        <div className="mt-1 truncate text-xs font-medium text-zinc-700 dark:text-zinc-300">
                          {anchorB.originalData.home_team}
                        </div>
                      </div>
                    ))}

                    {MARKET_KEYS.map((row) => (
                      <div key={`row-${row}`} className="contents">
                        <div className="flex flex-col justify-center">
                          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                            {MARKET_TITLES[row]}
                          </div>
                          <div className="mt-1 truncate text-xs font-medium text-zinc-700 dark:text-zinc-300">
                            {anchorA.originalData.home_team}
                          </div>
                        </div>

                        {MARKET_KEYS.map((col) => {
                          const ticket = tickets.find(
                            (item) => item.row === row && item.col === col
                          );
                          if (!ticket) {
                            return null;
                          }

                          return (
                            <div
                              key={ticket.id}
                              className={`matrix-cell ${ticket.boosted ? "matrix-cell-boosted" : ""}`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
                                  {row.toUpperCase()} × {col.toUpperCase()}
                                </div>
                                {ticket.boosted ? (
                                  <span className="rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                                    Boosted
                                  </span>
                                ) : ticket.baseOdds >= COVER_MULTIPLIER ? (
                                  <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                                    {COVER_MULTIPLIER}× cover
                                  </span>
                                ) : null}
                              </div>
                              <div className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                                {ticket.odds.toFixed(2)}
                              </div>
                              <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                                {anchorA[row].toFixed(2)} × {anchorB[col].toFixed(2)}
                                {ticket.boosted ? ` × ${extraMultiplier.toFixed(2)}` : ""}
                              </div>
                              <label className="mt-3 block">
                                <span className="mb-1 block text-[10px] uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400">
                                  Stake
                                </span>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={ticket.amount}
                                  onChange={(event) =>
                                    updateCellAmount(ticket.id, event.target.value)
                                  }
                                  className="w-full rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                                />
                              </label>
                              <div className="mt-2 flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-300">
                                <span>Return</span>
                                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                  ${ticket.returnValue.toFixed(2)}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-6 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-10 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400">
                Choose two different anchors to create the 9 opening odds.
              </div>
            )}

            <div className="mt-8 border-t border-zinc-200 pt-6 dark:border-zinc-800">
              <h3 className="text-lg font-bold">Add a hedge, unicorn, or other</h3>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Extra legs apply only when an opening ticket is below {COVER_MULTIPLIER}×,
                so its return would be less than the original spread. Others are matches
                the auto-rules did not classify.
              </p>

              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-200">
                    Category
                  </span>
                  <select
                    value={extraCategory}
                    onChange={(e) =>
                      handleExtraCategoryChange(e.target.value as ExtraCategory)
                    }
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                  >
                    {Object.entries(EXTRA_TITLES).map(([key, value]) => (
                      <option key={key} value={key}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>

                <div>
                  <span className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-200">
                    Team selection
                  </span>
                  <PickerButton
                    label={
                      extraCategory === "others"
                        ? "Search unclassified matches"
                        : selectedExtraGame
                          ? gameTitle(selectedExtraGame)
                          : `Search and choose a ${EXTRA_TITLES[extraCategory].slice(0, -1).toLowerCase()}`
                    }
                    detail={
                      extraCategory === "others"
                        ? `${visibleGames.others.length} matches not auto-classified`
                        : selectedExtraGame
                          ? oddsDetail(selectedExtraGame)
                          : extraGames.length
                            ? `${extraGames.length} available`
                            : "No picks available"
                    }
                    disabled={!extraGames.length}
                    onClick={() => setPicker(extraCategory)}
                  />
                </div>
              </div>

              {extraCategory === "others" ? (
                <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
                  Classify an unclassified match as an anchor, hedge, or unicorn.
                  Hedges and unicorns stay selected here so you can add them next.
                </p>
              ) : (
                <button
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-zinc-300 dark:disabled:bg-zinc-700"
                  onClick={() => addExtraLeg()}
                  disabled={!selectedExtraGame}
                >
                  <Plus size={16} />
                  Add {EXTRA_TITLES[extraCategory].slice(0, -1)}
                </button>
              )}

              {extraLegs.length > 0 && (
                <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
                  {extraLegs.map((leg) => (
                    <div key={leg.id} className="bet-builder-card">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                            {EXTRA_TITLES[leg.category].slice(0, -1)}
                          </div>
                          <h4 className="mt-1 text-sm font-bold text-zinc-900 dark:text-zinc-50">
                            {gameTitle(leg.game)}
                          </h4>
                          {formatKickoff(leg.game) ? (
                            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                              {formatKickoff(leg.game)}
                            </p>
                          ) : null}
                        </div>
                        <button
                          className="rounded-md p-1.5 text-red-500 transition hover:bg-red-50 dark:hover:bg-red-950/30"
                          onClick={() => removeExtraLeg(leg.id)}
                          aria-label={`Remove ${gameTitle(leg.game)}`}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      <div className="mt-3 grid grid-cols-3 gap-2">
                        {MARKET_KEYS.map((key) => (
                          <button
                            key={`${leg.id}-${key}`}
                            type="button"
                            onClick={() => updateExtraMarket(leg.id, key)}
                            className={`bet-multiplier-toggle ${leg.market === key ? "selected" : ""}`}
                          >
                            {key.toUpperCase()}
                          </button>
                        ))}
                      </div>
                      <div className="mt-2 grid grid-cols-3 gap-2">
                        {MARKET_KEYS.map((key) => (
                          <div key={`${leg.id}-${key}-value`} className="bet-multiplier-value">
                            {leg.game[key].toFixed(2)}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          <aside className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">Betslip</h2>
              <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                {tickets.length + failsafeTickets.length}
              </span>
            </div>

            <div className="space-y-3">
              {paginatedTickets.map((ticket) => (
                <div key={ticket.id} className="betslip-item py-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium text-sm">
                      {ticket.row.toUpperCase()} × {ticket.col.toUpperCase()}
                    </div>
                    <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400">
                      {ticket.boosted
                        ? "Boosted"
                        : ticket.baseOdds >= COVER_MULTIPLIER
                          ? `${COVER_MULTIPLIER}× cover`
                          : "Opening"}
                    </span>
                  </div>

                  {anchorA && anchorB && (
                    <div className="mt-2 space-y-1.5">
                      <SlipLeg label="Anchor 1" game={anchorA} market={ticket.row} />
                      <SlipLeg label="Anchor 2" game={anchorB} market={ticket.col} />
                      {ticket.boosted &&
                        extraLegs.map((leg) => (
                          <SlipLeg
                            key={`${ticket.id}-${leg.id}`}
                            label={EXTRA_TITLES[leg.category].slice(0, -1)}
                            game={leg.game}
                            market={leg.market}
                          />
                        ))}
                    </div>
                  )}

                  <SlipPayout
                    stake={ticket.amount}
                    odds={ticket.odds}
                    toWin={ticket.returnValue}
                  />
                </div>
              ))}
              {tickets.length === 0 && (
                <p className="py-6 text-sm text-zinc-400">
                  The 9 opening tickets appear here after both anchors are chosen.
                </p>
              )}
            </div>

            {tickets.length > itemsPerPage && (
              <div className="mt-4 flex items-center justify-center gap-2">
                <button
                  onClick={() => setCurrentPage((page) => Math.max(page - 1, 1))}
                  disabled={currentPage === 1}
                  className="rounded p-1 hover:bg-zinc-200 disabled:opacity-50 dark:hover:bg-zinc-800"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-sm">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((page) => Math.min(page + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="rounded p-1 hover:bg-zinc-200 disabled:opacity-50 dark:hover:bg-zinc-800"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}

            {failsafeTickets.length > 0 && (
              <div className="mt-4 border-t border-zinc-200 pt-4 dark:border-zinc-800">
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                  Failsafe
                </div>
                {failsafeTickets.map((ticket) => (
                  <div key={ticket.id} className="betslip-item py-3">
                    <SlipLeg
                      label={`${EXTRA_TITLES[ticket.category].slice(0, -1)} failsafe`}
                      game={ticket.game}
                      market={ticket.market}
                    />
                    <SlipPayout
                      stake={ticket.amount}
                      odds={ticket.odds}
                      toWin={ticket.returnValue}
                    />
                  </div>
                ))}
              </div>
            )}

            <div className="mt-5 border-t border-zinc-200 pt-4 dark:border-zinc-800">
              <div className="mb-1 flex justify-between text-sm">
                <span>Opening tickets</span>
                <span>{tickets.length}</span>
              </div>
              <div className="mb-1 flex justify-between text-sm">
                <span>Opening stake</span>
                <span>${openingStake.toFixed(2)}</span>
              </div>
              <div className="mb-1 flex justify-between text-sm">
                <span>Failsafe added</span>
                <span>${failsafeStake.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold">
                <span>Total stake</span>
                <span>${totalStake.toFixed(2)}</span>
              </div>
            </div>
          </aside>
        </div>

        {extraLegs.length > 0 && (
          <section className="mt-8 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                  Failsafe
                </div>
                <h2 className="mt-1 text-2xl font-bold">Draw and loss cover</h2>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  If a hedge or unicorn misses, boosted tickets pay nothing. Either
                  draw or loss still hits, and that failsafe is a given in the payout
                  group. Each side starts at ${FAILSAFE_DEFAULT_STAKE.toFixed(2)}.
                </p>
              </div>
              <div className="rounded-xl bg-zinc-100 px-4 py-3 text-right dark:bg-zinc-800">
                <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
                  Spread + failsafe
                </div>
                <div className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
                  ${workingSpread.toFixed(2)}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {extraLegs.map((leg) => {
                const markets = failsafeMarketsFor(leg.market);
                return (
                  <div key={`${leg.id}-failsafe`} className="bet-builder-card">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                      {EXTRA_TITLES[leg.category].slice(0, -1)} failsafe
                    </div>
                    <h3 className="mt-1 text-base font-bold text-zinc-900 dark:text-zinc-50">
                      {gameTitle(leg.game)}
                    </h3>
                    {formatKickoff(leg.game) ? (
                      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                        {formatKickoff(leg.game)}
                      </p>
                    ) : null}
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      Extra leg uses {MARKET_TITLES[leg.market]}. Cover the remaining
                      outcomes below.
                    </p>

                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {markets.map((market) => {
                        const amount = leg.failsafe[market];
                        const odds = leg.game[market];
                        return (
                          <div
                            key={`${leg.id}-${market}`}
                            className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
                                {MARKET_TITLES[market]}
                              </span>
                              <span className="text-sm font-bold text-zinc-900 dark:text-zinc-50">
                                {odds.toFixed(2)}
                              </span>
                            </div>
                            <label className="mt-3 block">
                              <span className="mb-1 block text-[10px] uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400">
                                Failsafe stake
                              </span>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={amount}
                                onChange={(event) =>
                                  updateFailsafeAmount(leg.id, market, event.target.value)
                                }
                                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                              />
                            </label>
                            <div className="mt-2 flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-300">
                              <span>Return</span>
                              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                ${(amount * odds).toFixed(2)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <section className="mt-8 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
            <div className="rounded-xl bg-zinc-100 px-4 py-3 text-right dark:bg-zinc-800">
              <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
                Total stake
              </div>
              <div className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
                ${totalStake.toFixed(2)}
              </div>
              <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Opening ${openingStake.toFixed(2)}
                {failsafeStake > 0 ? ` + failsafe $${failsafeStake.toFixed(2)}` : ""}
              </div>
            </div>

            {extraLegs.length > 0 ? (
              <>
                <PayoutScenario
                  title="Boosted wins"
                  detail="Boosted tickets including extras"
                  low={payoutGroup.boostedLow}
                  high={payoutGroup.boostedHigh}
                />
                <PayoutScenario
                  title="Unboosted wins"
                  detail={
                    payoutGroup.unboostedHigh === 0 && payoutGroup.unboostedLow === 0
                      ? "No unboosted tickets"
                      : "9× cover tickets"
                  }
                  low={payoutGroup.unboostedLow}
                  high={payoutGroup.unboostedHigh}
                />
                <PayoutScenario
                  title="Failsafe draws"
                  detail="Failsafe draw, from boosted miss up to unboosted"
                  low={payoutGroup.drawLow}
                  high={payoutGroup.drawHigh}
                />
                <PayoutScenario
                  title="Failsafe losses"
                  detail="Failsafe loss, from boosted miss up to unboosted"
                  low={payoutGroup.lossLow}
                  high={payoutGroup.lossHigh}
                />
                <PayoutScenario
                  title="Combo wins"
                  detail="Failsafe floor, up to unboosted plus draw or loss"
                  low={payoutGroup.comboLow}
                  high={payoutGroup.comboHigh}
                />
              </>
            ) : (
              <div className="rounded-xl bg-zinc-100 px-4 py-3 text-right dark:bg-zinc-800 sm:col-span-1 xl:col-span-2 2xl:col-span-5">
                <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
                  Total payout group
                </div>
                <div className="text-xl font-bold text-zinc-400 dark:text-zinc-500">—</div>
              </div>
            )}
          </div>
        </section>
      </main>

      <GameSelectModal
        open={picker !== null}
        title={
          picker === "anchorA"
            ? "Choose first anchor"
            : picker === "anchorB"
              ? "Choose second anchor"
              : picker === "others"
                ? "Unclassified matches"
                : `Choose a ${picker ? EXTRA_TITLES[picker].slice(0, -1).toLowerCase() : "match"}`
        }
        description={
          picker === "others"
            ? "Search by team name, then classify a match as an anchor, hedge, or unicorn."
            : "Search by team name and review the 1X2 and strategy odds before selecting."
        }
        games={
          picker === "anchorA" || picker === "anchorB"
            ? sortedAnchors
            : picker
              ? extraCategory === picker
                ? extraGames
                : sortGames(visibleGames[picker])
              : []
        }
        selectedId={
          picker === "anchorA"
            ? anchorAId
            : picker === "anchorB"
              ? anchorBId
              : extraGameId
        }
        disabledIds={
          picker === "anchorA"
            ? [anchorBId]
            : picker === "anchorB"
              ? [anchorAId]
              : []
        }
        emptyLabel={
          picker === "others"
            ? "No unclassified matches match that team or date"
            : "No matches match that team or date"
        }
        mode={picker === "others" ? "classify" : "select"}
        dateFilter={dateFilter}
        dates={matchDates}
        onDateFilterChange={setDateFilter}
        onClose={() => setPicker(null)}
        onSelect={handlePickerSelect}
        onClassify={classifyOther}
      />
    </div>
  );
}

function PayoutScenario({
  title,
  detail,
  low,
  high,
}: {
  title: string;
  detail: string;
  low: number;
  high: number;
}) {
  const range =
    Math.abs(high - low) < 0.005
      ? `$${low.toFixed(2)}`
      : `$${low.toFixed(2)} – $${high.toFixed(2)}`;

  return (
    <div className="rounded-xl bg-zinc-100 px-4 py-3 text-right dark:bg-zinc-800">
      <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
        {title}
      </div>
      <div className="text-xl font-bold text-zinc-900 dark:text-zinc-50">{range}</div>
      <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{detail}</div>
    </div>
  );
}

function PickerButton({
  label,
  detail,
  disabled,
  onClick,
}: {
  label: string;
  detail: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center justify-between gap-3 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-left outline-none transition hover:border-blue-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800"
    >
      <span>
        <span className="block text-sm font-medium text-zinc-900 dark:text-zinc-50">
          {label}
        </span>
        <span className="mt-0.5 block text-xs text-zinc-500 dark:text-zinc-400">
          {detail}
        </span>
      </span>
      <Search size={16} className="shrink-0 text-zinc-400" />
    </button>
  );
}
