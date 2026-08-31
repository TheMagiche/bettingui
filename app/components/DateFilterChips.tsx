"use client";

import { formatDateChip, todayDateKey } from "@/utils/bettingLogic";

type DateFilterChipsProps = {
  dates: string[];
  value: string;
  onChange: (value: string) => void;
};

export default function DateFilterChips({
  dates,
  value,
  onChange,
}: DateFilterChipsProps) {
  const today = todayDateKey();
  const chips = [today, ...dates.filter((date) => date !== today), "all"];

  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((date) => {
        const selected = value === date;
        return (
          <button
            key={date}
            type="button"
            onClick={() => onChange(date)}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
              selected
                ? "bg-blue-600 text-white"
                : "border border-zinc-200 bg-white text-zinc-600 hover:border-blue-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
            }`}
          >
            {formatDateChip(date)}
          </button>
        );
      })}
    </div>
  );
}
