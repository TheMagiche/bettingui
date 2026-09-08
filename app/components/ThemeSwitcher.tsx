"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { useTheme } from "@/app/components/ThemeProvider";

export default function ThemeSwitcher() {
  const { resolvedTheme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = resolvedTheme === "dark";

  const handleClick = () => {
    setIsAnimating(true);
    toggleTheme();
    setTimeout(() => setIsAnimating(false), 300);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="Toggle theme"
      aria-pressed={isDark}
      title="Toggle theme"
      className={"inline-flex shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-white p-2 text-zinc-700 transition-all duration-300 ease-in-out hover:border-blue-400 hover:text-blue-700 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:border-blue-400 dark:hover:text-blue-300 " + (isAnimating ? "scale-110 rotate-180" : "")}
    >
      {mounted && isDark ? (
        <Sun 
          size={18} 
          aria-hidden="true" 
          className={"transition-transform duration-300 " + (isAnimating ? "animate-spin" : "")}
        />
      ) : (
        <Moon 
          size={18} 
          aria-hidden="true" 
          className={"transition-transform duration-300 " + (isAnimating ? "-rotate-12" : "")}
        />
      )}
    </button>
  );
}