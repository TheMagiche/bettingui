"use client";

import { useEffect, useMemo, useState } from "react";
import { formatAndIdentifyGames } from "@/utils/bettingLogic";
import type { FormattedGame } from "@/utils/bettingLogic";
import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";

type IdentifiedGames = {
  anchors: FormattedGame[];
  hedges: FormattedGame[];
  unicorns: FormattedGame[];
};

type BetItem = {
  game: FormattedGame;
  market: "w" | "d" | "l";
  stake: number;
};

const MATRIX_LABELS = ["w", "d", "l"] as const;
const MATRIX_TITLES = { w: "Win", d: "Draw", l: "Loss" };

export default function Home() {
  const [games, setGames] = useState<IdentifiedGames>({
    anchors: [],
    hedges: [],
    unicorns: [],
  });
  const [spread, setSpread] = useState<number>(100);
  const [selectedCell, setSelectedCell] = useState<{
    category: "anchors" | "hedges" | "unicorns";
    gameId: string;
  } | null>(null);
  const [betslip, setBetslip] = useState<BetItem[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  useEffect(() => {
    fetch("/betgames.json")
      .then((res) => res.json())
      .then((data) => setGames(formatAndIdentifyGames(data)))
      .catch((err) => console.error("Failed to load betgames.json", err));
  }, []);

  const handleCellClick = (
    category: "anchors" | "hedges" | "unicorns",
    game: FormattedGame
  ) => {
    setSelectedCell({ category, gameId: game.id });
  };

  const addToBetslip = (game: FormattedGame, market: "w" | "d" | "l") => {
    const stake = spread / 9;
    setBetslip((prev) => [...prev, { game, market, stake }]);
  };

  const removeFromBetslip = (index: number) => {
    setBetslip((prev) => prev.filter((_, i) => i !== index));
  };

  const clearBetslip = () => {
    setBetslip([]);
  };

  const totalStake = useMemo(
    () => betslip.reduce((sum, bet) => sum + bet.stake, 0),
    [betslip]
  );

  const paginatedBets = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return betslip.slice(start, start + itemsPerPage);
  }, [betslip, currentPage]);

  const totalPages = Math.ceil(betslip.length / itemsPerPage);

  const renderMatrix = (
    category: "anchors" | "hedges" | "unicorns",
    title: string,
    color: string
  ) => {
    const categoryGames = games[category];
    return (
      <div className="mb-8">
        <h2 className={`text-xl font-bold mb-4 text-${color}`}>
          {title} ({categoryGames.length})
        </h2>
        <div className="grid grid-cols-3 gap-4">
          {categoryGames.map((game) =>
            MATRIX_LABELS.map((row) =>
              MATRIX_LABELS.map((col) => {
                const isSelected =
                  selectedCell?.category === category &&
                  selectedCell?.gameId === game.id;
                return (
                  <div
                    key={`${game.id}-${row}-${col}`}
                    className={`matrix-cell ${isSelected ? "matrix-cell-selected" : ""} cursor-pointer`}
                    onClick={() => handleCellClick(category, game)}
                  >
                    <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                      {MATRIX_TITLES[row]} / {MATRIX_TITLES[col]}
                    </div>
                    <div className="text-sm font-bold">
                      {game[row].toFixed(2)} / {game[col].toFixed(2)}
                    </div>
                    <div className="text-xs text-zinc-400 mt-1 truncate">
                      {game.id}
                    </div>
                    <button
                      className="mt-2 px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        addToBetslip(game, col);
                      }}
                    >
                      Bet {col.toUpperCase()}
                    </button>
                  </div>
                );
              })
            )
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-zinc-100">
      <header className="bg-white dark:bg-zinc-900 shadow-sm border-b border-zinc-200 dark:border-zinc-800">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <h1 className="text-2xl font-bold">Betting Strategy Analyzer</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Football betting risk-mitigation strategy with 3x3 matrix and betslip
          </p>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">
            Monetary Spread ($)
          </label>
          <input
            type="number"
            min="1"
            value={spread}
            onChange={(e) => setSpread(Number(e.target.value) || 0)}
            className="w-32 px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span className="ml-4 text-sm text-zinc-500 dark:text-zinc-400">
            Per-bet stake: ${(spread / 9).toFixed(2)}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            {renderMatrix("anchors", "Anchors", "blue-500")}
            {renderMatrix("hedges", "Hedges", "amber-500")}
            {renderMatrix("unicorns", "Unicorns", "purple-500")}
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-lg border border-zinc-200 dark:border-zinc-800 p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Betslip</h2>
              <button
                onClick={clearBetslip}
                className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                title="Clear betslip"
              >
                <Trash2 size={16} />
              </button>
            </div>

            <div className="space-y-2 mb-4">
              {paginatedBets.map((bet, index) => (
                <div
                  key={index}
                  className="betslip-item py-3"
                >
                  <div className="font-medium text-sm">
                    {bet.game.id}
                  </div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    Market: {bet.market.toUpperCase()} | Stake: ${bet.stake.toFixed(2)}
                  </div>
                  <button
                    onClick={() => removeFromBetslip((currentPage - 1) * itemsPerPage + index)}
                    className="mt-1 text-xs text-red-500 hover:underline"
                  >
                    Remove
                  </button>
                </div>
              ))}
              {betslip.length === 0 && (
                <p className="text-sm text-zinc-400">No bets added yet.</p>
              )}
            </div>

            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-2 mb-4">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                  disabled={currentPage === 1}
                  className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 disabled:opacity-50"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-sm">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 disabled:opacity-50"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}

            <div className="border-t border-zinc-200 dark:border-zinc-800 pt-4">
              <div className="flex justify-between text-sm mb-1">
                <span>Total Bets:</span>
                <span>{betslip.length}</span>
              </div>
              <div className="flex justify-between text-lg font-bold">
                <span>Total Stake:</span>
                <span>${totalStake.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
