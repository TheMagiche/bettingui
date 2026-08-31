"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import {
  gameTitle,
  isHomeFavorite,
  MARKET_KEYS,
  matchesTeamSearch,
} from "@/utils/bettingLogic";
import type { FormattedGame, GameBucket } from "@/utils/bettingLogic";

const MARKET_LABELS = {
  w: "Win",
  d: "Draw",
  l: "Loss",
} as const;

const CLASSIFY_LABELS: Record<GameBucket, string> = {
  anchors: "Anchor",
  hedges: "Hedge",
  unicorns: "Unicorn",
};

type GameSelectModalProps = {
  open: boolean;
  title: string;
  description?: string;
  games: FormattedGame[];
  selectedId?: string;
  disabledIds?: string[];
  emptyLabel?: string;
  mode?: "select" | "classify";
  onClose: () => void;
  onSelect?: (game: FormattedGame) => void;
  onClassify?: (game: FormattedGame, bucket: GameBucket) => void;
};

function GameDetails({ game }: { game: FormattedGame }) {
  const favorite = isHomeFavorite(game) ? "Home favorite" : "Away favorite";

  return (
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
          SportPesa 1X2
        </div>
        <div className="mt-1 flex flex-wrap gap-2 text-xs text-zinc-600 dark:text-zinc-300">
          <span>1 {Number(game.originalData.home_win).toFixed(2)}</span>
          <span>X {Number(game.originalData.draw).toFixed(2)}</span>
          <span>2 {Number(game.originalData.away_win).toFixed(2)}</span>
        </div>
      </div>
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
          Strategy markets · {favorite}
        </div>
        <div className="mt-1 flex flex-wrap gap-2 text-xs text-zinc-600 dark:text-zinc-300">
          {MARKET_KEYS.map((key) => (
            <span key={key}>
              {MARKET_LABELS[key]} {game[key].toFixed(2)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function GameSelectModal({
  open,
  title,
  description,
  games,
  selectedId,
  disabledIds = [],
  emptyLabel = "No matches found",
  mode = "select",
  onClose,
  onSelect,
  onClassify,
}: GameSelectModalProps) {
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(
    () => games.filter((game) => matchesTeamSearch(game, query)),
    [games, query]
  );

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }

    const frame = window.requestAnimationFrame(() => searchRef.current?.focus());
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-zinc-950/50"
        aria-label="Close match picker"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="game-select-title"
        className="relative z-10 flex max-h-[88vh] w-full max-w-2xl flex-col rounded-t-2xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-900 sm:rounded-2xl"
      >
        <div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="game-select-title" className="text-lg font-bold">
                {title}
              </h2>
              {description ? (
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  {description}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1.5 text-zinc-500 transition hover:bg-zinc-100 dark:hover:bg-zinc-800"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>

          <label className="mt-4 flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800">
            <Search size={16} className="shrink-0 text-zinc-400" />
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by team name"
              className="w-full bg-transparent text-sm text-zinc-900 outline-none dark:text-zinc-50"
            />
          </label>
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            {filtered.length} of {games.length} matches
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {filtered.length === 0 ? (
            <p className="py-10 text-center text-sm text-zinc-500 dark:text-zinc-400">
              {emptyLabel}
            </p>
          ) : (
            <div className="space-y-3">
              {filtered.map((game) => {
                const disabled = disabledIds.includes(game.id);
                const selected = selectedId === game.id;

                return (
                  <div
                    key={game.id}
                    className={`rounded-2xl border p-4 ${
                      selected
                        ? "border-blue-500 bg-blue-50/70 dark:border-blue-400 dark:bg-blue-950/30"
                        : "border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950"
                    } ${disabled ? "opacity-50" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">
                          {gameTitle(game)}
                        </h3>
                        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                          {game.originalData.home_team} (home) ·{" "}
                          {game.originalData.away_team} (away)
                        </p>
                      </div>
                      {mode === "select" ? (
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => onSelect?.(game)}
                          className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-zinc-300 dark:disabled:bg-zinc-700"
                        >
                          {selected ? "Selected" : "Select"}
                        </button>
                      ) : null}
                    </div>
                    <GameDetails game={game} />
                    {mode === "classify" ? (
                      <div className="mt-4 grid grid-cols-3 gap-2">
                        {(Object.keys(CLASSIFY_LABELS) as GameBucket[]).map(
                          (bucket) => (
                            <button
                              key={`${game.id}-${bucket}`}
                              type="button"
                              onClick={() => onClassify?.(game, bucket)}
                              className="rounded-lg border border-zinc-200 bg-white px-2 py-2 text-xs font-semibold text-zinc-700 transition hover:border-blue-400 hover:text-blue-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-blue-400 dark:hover:text-blue-300"
                            >
                              {CLASSIFY_LABELS[bucket]}
                            </button>
                          )
                        )}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
