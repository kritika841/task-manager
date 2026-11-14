"use client";

import { useEffect, useState } from "react";
import { Moon, Sun, Sparkles } from "lucide-react";

export type ThemeMode = "midnight" | "light";

export function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeMode>("midnight");
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem("satmi-theme") as string;
    const resolved: ThemeMode = stored === "light" ? "light" : "midnight";
    setTheme(resolved);
    applyTheme(resolved);
  }, []);

  const applyTheme = (mode: ThemeMode) => {
    const root = document.documentElement;
    if (mode === "light") {
      root.classList.remove("dark", "theme-midnight");
      root.dataset.theme = "light";
    } else {
      root.classList.add("dark", "theme-midnight");
      root.dataset.theme = "midnight";
    }
  };

  const toggleTheme = () => {
    const next: ThemeMode = theme === "midnight" ? "light" : "midnight";
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
      onClick={toggleTheme}
      type="button"
      className="inline-flex h-8 items-center gap-1.5 px-2.5 rounded-lg border border-border bg-card text-muted-foreground transition duration-150 hover:border-ring/50 hover:bg-muted hover:text-foreground active:scale-95 cursor-pointer shadow-2xs group"
      aria-label="Toggle theme: Midnight Blue or Light"
      title={
        theme === "midnight"
          ? "Theme: Midnight Blue (Click for Light Mode)"
          : "Theme: Light Mode (Click for Midnight Blue)"
      }
    >
      {theme === "midnight" ? (
        <>
          <div className="relative flex items-center justify-center">
            <Sparkles className="size-3.5 text-sky-400" />
            <span className="absolute -bottom-0.5 -right-0.5 size-1.5 rounded-full bg-sky-400" />
          </div>
          <span className="hidden sm:inline text-[11px] font-medium text-sky-400">Midnight</span>
        </>
      ) : (
        <>
          <Sun className="size-3.5 text-amber-500" />
          <span className="hidden sm:inline text-[11px] font-medium text-amber-600 dark:text-amber-400">Light</span>
        </>
      )}

      {/* 2-dot visual indicator */}
      <div className="flex items-center gap-1 ml-0.5 opacity-70 group-hover:opacity-100">
        <span
          className={`size-1.5 rounded-full transition-all ${
            theme === "midnight" ? "bg-sky-400 scale-125" : "bg-muted-foreground/30"
          }`}
          title="Midnight Blue (Primary)"
        />
        <span
          className={`size-1.5 rounded-full transition-all ${
            theme === "light" ? "bg-amber-500 scale-125" : "bg-muted-foreground/30"
          }`}
          title="Light Mode"
        />
      </div>
    </button>
  );
}
