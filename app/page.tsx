"use client";

import { useEffect, useMemo, useState } from "react";
import {
  createNineAnchorOdds,
  formatAndIdentifyGames,
  gameTitle,
  MARKET_KEYS,
} from "@/utils/bettingLogic";
import type { FormattedGame, MarketKey } from "@/utils/bettingLogic";
import { ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";

type IdentifiedGames = {
  anchors: FormattedGame[];
  hedges: FormattedGame[];
  unicorns: FormattedGame[];
};

type ExtraCategory = "hedges" | "unicorns";

type ExtraLeg = {
  id: string;
  category: ExtraCategory;
  game: FormattedGame;
  market: MarketKey;
};

const MARKET_TITLES: Record<MarketKey, string> = {
  w: "Win",
  d: "Draw",
  l: "Loss",
};

const EXTRA_TITLES: Record<ExtraCategory, string> = {
  hedges: "Hedges",
  unicorns: "Unicorns",
};

function sortGames(games: FormattedGame[]) {
  return [...games].sort((a, b) =>
    `${a.originalData.home_team} ${a.originalData.away_team}`
      .toLowerCase()
      .localeCompare(
        `${b.originalData.home_team} ${b.originalData.away_team}`.toLowerCase()
      )
  );
}

export default function Home() {
  const [games, setGames] = useState<IdentifiedGames>({
    anchors: [],
    hedges: [],
    unicorns: [],
  });
  const [spread, setSpread] = useState<number>(100);
  const [anchorAId, setAnchorAId] = useState("");
  const [anchorBId, setAnchorBId] = useState("");
  const [cellAmounts, setCellAmounts] = useState<Record<string, number>>({});
  const [extraLegs, setExtraLegs] = useState<ExtraLeg[]>([]);
  const [extraCategory, setExtraCategory] = useState<ExtraCategory>("hedges");
  const [extraGameId, setExtraGameId] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  useEffect(() => {
    fetch("/betgames.json")
      .then((res) => res.json())
      .then((data) => {
        const formatted = formatAndIdentifyGames(data);
        setGames(formatted);

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
      })
      .catch((err) => console.error("Failed to load betgames.json", err));
  }, []);

  const sortedAnchors = useMemo(() => sortGames(games.anchors), [games.anchors]);
  const extraGames = useMemo(
    () => sortGames(games[extraCategory]),
    [games, extraCategory]
  );

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
    const equalStake = spread / 9;
    return combinations.map((combo) => {
      const amount = cellAmounts[combo.id] ?? equalStake;
      const odds = combo.odds * extraMultiplier;
      return {
        ...combo,
        amount: Math.max(amount, 0),
        odds,
        returnValue: Math.max(amount, 0) * odds,
      };
    });
  }, [cellAmounts, combinations, extraMultiplier, spread]);

  useEffect(() => {
    setCurrentPage(1);
  }, [anchorAId, anchorBId]);

  const totalStake = useMemo(
    () => tickets.reduce((sum, ticket) => sum + ticket.amount, 0),
    [tickets]
  );

  const lowestReturn = useMemo(
    () => (tickets.length ? Math.min(...tickets.map((ticket) => ticket.returnValue)) : 0),
    [tickets]
  );

  const highestReturn = useMemo(
    () => (tickets.length ? Math.max(...tickets.map((ticket) => ticket.returnValue)) : 0),
    [tickets]
  );

  const paginatedTickets = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return tickets.slice(start, start + itemsPerPage);
  }, [currentPage, tickets]);

  const totalPages = Math.max(1, Math.ceil(tickets.length / itemsPerPage));

  const updateCellAmount = (id: string, value: string) => {
    const parsedValue = Number(value);
    setCellAmounts((prev) => ({
      ...prev,
      [id]: Number.isFinite(parsedValue) ? Math.max(parsedValue, 0) : 0,
    }));
  };

  const addExtraLeg = () => {
    if (!selectedExtraGame) {
      return;
    }

    setExtraLegs((prev) => [
      ...prev,
      {
        id: `${extraCategory}-${selectedExtraGame.id}-${Date.now()}-${Math.random()
          .toString(16)
          .slice(2)}`,
        category: extraCategory,
        game: selectedExtraGame,
        market: "w",
      },
    ]);
  };

  const updateExtraMarket = (id: string, market: MarketKey) => {
    setExtraLegs((prev) =>
      prev.map((leg) => (leg.id === id ? { ...leg, market } : leg))
    );
  };

  const removeExtraLeg = (id: string) => {
    setExtraLegs((prev) => prev.filter((leg) => leg.id !== id));
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
    const nextGames = sortGames(games[nextCategory]);
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
                  Default stake per cell: ${(spread / 9).toFixed(2)}
                </span>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-zinc-100 px-4 py-3 text-right dark:bg-zinc-800">
                <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
                  Total stake
                </div>
                <div className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
                  ${totalStake.toFixed(2)}
                </div>
              </div>
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

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-200">
                  Anchor 1
                </span>
                <select
                  value={anchorAId}
                  onChange={(e) => {
                    setAnchorAId(e.target.value);
                    setCellAmounts({});
                  }}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                >
                  <option value="">Choose first anchor</option>
                  {sortedAnchors.map((game) => (
                    <option key={game.id} value={game.id} disabled={game.id === anchorBId}>
                      {gameTitle(game)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-200">
                  Anchor 2
                </span>
                <select
                  value={anchorBId}
                  onChange={(e) => {
                    setAnchorBId(e.target.value);
                    setCellAmounts({});
                  }}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                >
                  <option value="">Choose second anchor</option>
                  {sortedAnchors.map((game) => (
                    <option key={game.id} value={game.id} disabled={game.id === anchorAId}>
                      {gameTitle(game)}
                    </option>
                  ))}
                </select>
              </label>
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
                      Extra legs ×{extraMultiplier.toFixed(2)}
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
                            <div key={ticket.id} className="matrix-cell">
                              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
                                {row.toUpperCase()} × {col.toUpperCase()}
                              </div>
                              <div className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                                {ticket.odds.toFixed(2)}
                              </div>
                              <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                                {anchorA[row].toFixed(2)} × {anchorB[col].toFixed(2)}
                                {extraLegs.length > 0 ? ` × ${extraMultiplier.toFixed(2)}` : ""}
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
              <h3 className="text-lg font-bold">Add a hedge or unicorn</h3>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Extra legs multiply every opening ticket in this builder.
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

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-200">
                    Team selection
                  </span>
                  <select
                    value={selectedExtraGame?.id ?? ""}
                    onChange={(e) => setExtraGameId(e.target.value)}
                    disabled={!extraGames.length}
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                  >
                    {extraGames.length === 0 ? (
                      <option value="">No picks available</option>
                    ) : (
                      extraGames.map((game) => (
                        <option key={game.id} value={game.id}>
                          {gameTitle(game)}
                        </option>
                      ))
                    )}
                  </select>
                </label>
              </div>

              <button
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-zinc-300 dark:disabled:bg-zinc-700"
                onClick={addExtraLeg}
                disabled={!selectedExtraGame}
              >
                <Plus size={16} />
                Add {EXTRA_TITLES[extraCategory].slice(0, -1)}
              </button>

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
                {tickets.length}
              </span>
            </div>

            <div className="space-y-1">
              {paginatedTickets.map((ticket) => (
                <div key={ticket.id} className="betslip-item py-3">
                  <div className="font-medium text-sm">
                    {ticket.row.toUpperCase()} × {ticket.col.toUpperCase()}
                  </div>
                  <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    Odds {ticket.odds.toFixed(2)} · Stake ${ticket.amount.toFixed(2)}
                  </div>
                  <div className="mt-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    Return ${ticket.returnValue.toFixed(2)}
                  </div>
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

            <div className="mt-5 border-t border-zinc-200 pt-4 dark:border-zinc-800">
              <div className="mb-1 flex justify-between text-sm">
                <span>Tickets</span>
                <span>{tickets.length}</span>
              </div>
              <div className="flex justify-between text-lg font-bold">
                <span>Total stake</span>
                <span>${totalStake.toFixed(2)}</span>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
