"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Search, X } from "lucide-react";
import {
  classForGame,
  flattenIdentifiedGames,
  formatKickoff,
  gameTitle,
  isHomeFavorite,
  MARKET_KEYS,
  matchesTeamSearch,
} from "@/utils/bettingLogic";
import type {
  FormattedGame,
  GameBucket,
  GameClass,
  IdentifiedGames,
  RawGame,
} from "@/utils/bettingLogic";
import DateFilterChips from "@/app/components/DateFilterChips";

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

const CLASS_LABELS: Record<GameClass | "all", string> = {
  all: "All",
  anchors: "Anchors",
  hedges: "Hedge",
  unicorns: "Unicorn",
  others: "Others/unclassified",
};

const BUCKET_FILTERS: Array<GameClass | "all"> = [
  "all",
  "anchors",
  "hedges",
  "unicorns",
  "others",
];

type GameSelectModalProps = {
  open: boolean;
  title: string;
  description?: string;
  buckets: IdentifiedGames;
  selectedId?: string;
  disabledIds?: string[];
  emptyLabel?: string;
  mode?: "select" | "classify";
  initialBucket?: GameClass | "all";
  dateFilter?: string;
  dates?: string[];
  onDateFilterChange?: (value: string) => void;
  onClose: () => void;
  onSelect?: (game: FormattedGame) => void;
  onClassify?: (game: FormattedGame, bucket: GameBucket) => void;
  onAddMatch?: (game: RawGame) => FormattedGame | void;
};

type DraftMatch = {
  home_team: string;
  away_team: string;
  home_win: string;
  draw: string;
  away_win: string;
  kickoff: string;
};

const emptyDraft = (): DraftMatch => ({
  home_team: "",
  away_team: "",
  home_win: "",
  draw: "",
  away_win: "",
  kickoff: "",
});

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

function ClassBadge({ value }: { value: GameClass }) {
  return (
    <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
      {CLASS_LABELS[value]}
    </span>
  );
}

function AddMatchForm({
  draft,
  error,
  autoFocus,
  onChange,
  onSubmit,
}: {
  draft: DraftMatch;
  error: string;
  autoFocus?: boolean;
  onChange: (field: keyof DraftMatch, value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <form
      className="grid gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950 sm:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">
        Home team
        <input
          autoFocus={autoFocus}
          value={draft.home_team}
          onChange={(event) => onChange("home_team", event.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
        />
      </label>
      <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">
        Away team
        <input
          value={draft.away_team}
          onChange={(event) => onChange("away_team", event.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
        />
      </label>
      <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">
        Home win (1)
        <input
          type="number"
          min="1.01"
          step="0.01"
          value={draft.home_win}
          onChange={(event) => onChange("home_win", event.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
        />
      </label>
      <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">
        Draw (X)
        <input
          type="number"
          min="1.01"
          step="0.01"
          value={draft.draw}
          onChange={(event) => onChange("draw", event.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
        />
      </label>
      <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">
        Away win (2)
        <input
          type="number"
          min="1.01"
          step="0.01"
          value={draft.away_win}
          onChange={(event) => onChange("away_win", event.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
        />
      </label>
      <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">
        Kickoff
        <input
          type="datetime-local"
          value={draft.kickoff}
          onChange={(event) => onChange("kickoff", event.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
        />
      </label>
      {error ? (
        <p className="text-xs font-medium text-red-600 dark:text-red-400 sm:col-span-2">
          {error}
        </p>
      ) : (
        <p className="text-xs text-zinc-500 dark:text-zinc-400 sm:col-span-2">
          Uses the same 1X2 fields as SportPesa. The match is classified from
          those odds. Kickoff defaults to now if left blank.
        </p>
      )}
      <button
        type="submit"
        className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-500 sm:col-span-2"
      >
        <Plus size={14} />
        Add match
      </button>
    </form>
  );
}

export default function GameSelectModal({
  open,
  title,
  description,
  buckets,
  selectedId,
  disabledIds = [],
  emptyLabel = "No matches found",
  mode = "select",
  initialBucket = "all",
  dateFilter,
  dates = [],
  onDateFilterChange,
  onClose,
  onSelect,
  onClassify,
  onAddMatch,
}: GameSelectModalProps) {
  const [query, setQuery] = useState("");
  const [bucketFilter, setBucketFilter] = useState<GameClass | "all">("all");
  const [showAddForm, setShowAddForm] = useState(false);
  const [draft, setDraft] = useState<DraftMatch>(emptyDraft);
  const [addError, setAddError] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  const allGames = useMemo(() => flattenIdentifiedGames(buckets), [buckets]);
  const pool = useMemo(
    () => (bucketFilter === "all" ? allGames : buckets[bucketFilter]),
    [allGames, bucketFilter, buckets],
  );
  const filtered = useMemo(
    () => pool.filter((game) => matchesTeamSearch(game, query)),
    [pool, query],
  );
  const listEmpty = allGames.length === 0;

  useEffect(() => {
    if (!open) {
      setQuery("");
      setBucketFilter(initialBucket);
      setShowAddForm(false);
      setDraft(emptyDraft());
      setAddError("");
      return;
    }

    setBucketFilter(initialBucket);
    const frame = window.requestAnimationFrame(() => {
      if (!listEmpty) {
        searchRef.current?.focus();
      }
    });
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
  }, [open, onClose, initialBucket, listEmpty]);

  const updateDraft = (field: keyof DraftMatch, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setAddError("");
  };

  const submitMatch = () => {
    const home_team = draft.home_team.trim();
    const away_team = draft.away_team.trim();
    const home_win = Number(draft.home_win);
    const draw = Number(draft.draw);
    const away_win = Number(draft.away_win);

    if (!home_team || !away_team) {
      setAddError("Home and away team names are required.");
      return;
    }
    if (home_team.toLowerCase() === away_team.toLowerCase()) {
      setAddError("Home and away teams must be different.");
      return;
    }
    if (
      ![home_win, draw, away_win].every((value) => Number.isFinite(value) && value > 1)
    ) {
      setAddError("Enter 1, X, and 2 odds greater than 1.");
      return;
    }

    const kickoff = draft.kickoff
      ? new Date(draft.kickoff)
      : new Date();
    if (Number.isNaN(kickoff.getTime())) {
      setAddError("Kickoff must be a valid date and time.");
      return;
    }

    const added = onAddMatch?.({
      home_team,
      away_team,
      home_win,
      draw,
      away_win,
      kickoff: kickoff.toISOString(),
    });
    setDraft(emptyDraft());
    setAddError("");
    setShowAddForm(false);

    if (listEmpty && added && mode === "select") {
      onSelect?.(added);
      onClose();
    }
  };

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
                {listEmpty ? "Add a match" : title}
              </h2>
              {listEmpty ? (
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  No matches are loaded yet. Add one with the same 1X2 fields as
                  SportPesa, or refresh from the header.
                </p>
              ) : description ? (
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

          {listEmpty ? null : (
            <>
              {onDateFilterChange && dateFilter ? (
                <div className="mt-4">
                  <DateFilterChips
                    dates={dates}
                    value={dateFilter}
                    onChange={onDateFilterChange}
                  />
                </div>
              ) : null}

              <div className="mt-3 flex flex-wrap gap-2">
                {BUCKET_FILTERS.map((key) => {
                  const count =
                    key === "all" ? allGames.length : buckets[key].length;
                  const selected = bucketFilter === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setBucketFilter(key)}
                      className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                        selected
                          ? "bg-blue-600 text-white"
                          : "border border-zinc-200 bg-white text-zinc-600 hover:border-blue-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                      }`}
                    >
                      {CLASS_LABELS[key]} · {count}
                    </button>
                  );
                })}
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
              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {filtered.length} of {pool.length} matches
                </p>
                {onAddMatch ? (
                  <button
                    type="button"
                    onClick={() => setShowAddForm((openForm) => !openForm)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 transition hover:text-blue-600 dark:text-blue-300"
                  >
                    <Plus size={12} />
                    {showAddForm ? "Cancel new match" : "Add match"}
                  </button>
                ) : null}
              </div>

              {showAddForm && onAddMatch ? (
                <div className="mt-3">
                  <AddMatchForm
                    draft={draft}
                    error={addError}
                    onChange={updateDraft}
                    onSubmit={submitMatch}
                  />
                </div>
              ) : null}
            </>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {listEmpty ? (
            <AddMatchForm
              draft={draft}
              error={addError}
              autoFocus
              onChange={updateDraft}
              onSubmit={submitMatch}
            />
          ) : filtered.length === 0 ? (
            <p className="py-10 text-center text-sm text-zinc-500 dark:text-zinc-400">
              {emptyLabel}
            </p>
          ) : (
            <div className="space-y-3">
              {filtered.map((game) => {
                const disabled = disabledIds.includes(game.id);
                const selected = selectedId === game.id;
                const kickoff = formatKickoff(game);
                const gameClass = classForGame(game.id, buckets);

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
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">
                            {gameTitle(game)}
                          </h3>
                          <ClassBadge value={gameClass} />
                          {game.originalData.boosted ? (
                            <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                              Boosted odds
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                          {kickoff ? `${kickoff} · ` : ""}
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
                          ),
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
