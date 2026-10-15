"use client";

import { useEffect, useState } from "react";
import { Moon, Sun, Sparkles } from "lucide-react";

export type ThemeMode = "obsidian" | "light" | "midnight";

export function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeMode>("obsidian");
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
    const stored = (localStorage.getItem("satmi-theme") as ThemeMode) || "obsidian";
    setTheme(stored);
    applyTheme(stored);
  }, []);

  const applyTheme = (mode: ThemeMode) => {
    const root = document.documentElement;
    if (mode === "light") {
      root.classList.remove("dark", "theme-midnight");
      root.dataset.theme = "light";
    } else if (mode === "midnight") {
      root.classList.add("dark", "theme-midnight");
      root.dataset.theme = "midnight";
    } else {
      // Default: obsidian (Grey Teal Dark)
      root.classList.add("dark");
      root.classList.remove("theme-midnight");
      root.dataset.theme = "obsidian";
    }
  };

  const cycleTheme = () => {
    let next: ThemeMode = "obsidian";
    if (theme === "obsidian") next = "light";
    else if (theme === "light") next = "midnight";
    else if (theme === "midnight") next = "obsidian";

    setTheme(next);
    applyTheme(next);
    try {
      localStorage.setItem("satmi-theme", next);
    } catch {}
  };

  if (!mounted) {
    return (
      <div className="size-8 rounded-lg border border-border bg-card p-0 opacity-50" />
    );
  }

  return (
    <button
      onClick={cycleTheme}
      type="button"
      className="inline-flex h-8 items-center gap-1.5 px-2.5 rounded-lg border border-border bg-card text-muted-foreground transition duration-150 hover:border-ring/50 hover:bg-muted hover:text-foreground active:scale-95 cursor-pointer shadow-2xs group"
      aria-label="Toggle theme: Grey Teal, Light, Midnight Blue"
      title={
        theme === "obsidian"
          ? "Theme: Grey Teal Dark (Click for Light Mode)"
          : theme === "light"
          ? "Theme: Light Mode (Click for Midnight Blue)"
          : "Theme: Midnight Blue (Click for Grey Teal Dark)"
      }
    >
      {theme === "obsidian" && (
        <>
          <div className="relative flex items-center justify-center">
            <Moon className="size-3.5 text-teal-400" />
            <span className="absolute -bottom-0.5 -right-0.5 size-1.5 rounded-full bg-teal-400" />
          </div>
          <span className="hidden sm:inline text-[11px] font-medium text-teal-400">Grey Teal</span>
        </>
      )}

      {theme === "light" && (
        <>
          <Sun className="size-3.5 text-amber-500" />
          <span className="hidden sm:inline text-[11px] font-medium text-amber-600 dark:text-amber-400">Light</span>
        </>
      )}

      {theme === "midnight" && (
        <>
          <div className="relative flex items-center justify-center">
            <Sparkles className="size-3.5 text-sky-400" />
            <span className="absolute -bottom-0.5 -right-0.5 size-1.5 rounded-full bg-sky-400" />
          </div>
          <span className="hidden sm:inline text-[11px] font-medium text-sky-400">Midnight</span>
        </>
      )}

      {/* 3-dot visual indicator */}
      <div className="flex items-center gap-1 ml-0.5 opacity-60 group-hover:opacity-100">
        <span
          className={`size-1.5 rounded-full transition-all ${
            theme === "obsidian" ? "bg-teal-400 scale-125" : "bg-muted-foreground/30"
          }`}
          title="Grey Teal (Default)"
        />
        <span
          className={`size-1.5 rounded-full transition-all ${
            theme === "light" ? "bg-amber-500 scale-125" : "bg-muted-foreground/30"
          }`}
          title="Light Mode"
        />
        <span
          className={`size-1.5 rounded-full transition-all ${
            theme === "midnight" ? "bg-sky-400 scale-125" : "bg-muted-foreground/30"
          }`}
          title="Midnight Blue (Original Preset)"
        />
      </div>
    </button>
  );
}
